import asyncio
import logging
import re
import traceback
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import Client, create_client

from app.config import settings
from app.limiter import limiter
from app.models.requests import PlanRequest
from app.services.auth import verify_token
from app.services.provider_ladder import get_ladder

logger = logging.getLogger("roam.plan")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/plan", tags=["plan"])

# ---------------------------------------------------------------------------
# Lazy Supabase client — created once, reused across requests
# ---------------------------------------------------------------------------
_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase_client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_trip_duration_days(message: str) -> int | None:
    """Extract user-stated trip duration in days from freeform message.
    Returns None if no duration pattern matches."""
    text = message.lower()
    # Priority 1: explicit "N day" / "N-day" patterns
    m = re.search(r"(\d+)\s*[-\s]*day", text)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 90:
            return n
    # Priority 2: "N week" → N*7 days
    m = re.search(r"(\d+)\s*[-\s]*week", text)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 12:
            return n * 7
    # Priority 3: word-number patterns
    WORD_DAYS = {
        "a day": 1, "two days": 2, "three days": 3, "four days": 4,
        "five days": 5, "six days": 6, "seven days": 7, "a week": 7,
        "ten days": 10, "two weeks": 14,
    }
    for phrase, days in WORD_DAYS.items():
        if phrase in text:
            return days
    return None


def normalize_priority(val: str) -> str:
    if not val:
        return "nice_to_have"
    v = val.strip().lower().replace(" ", "_")
    valid = {"must_do", "nice_to_have", "flexible"}
    return v if v in valid else "nice_to_have"


VALID_ACTIVITY_TYPES = {
    "transport", "accommodation", "food", "sightseeing", "entertainment",
    "outdoor", "nightlife", "shopping", "wellness", "nature",
}

_NORMALIZE_DIRECT = {
    "activity": "outdoor",
    "music": "entertainment",
    "concert": "entertainment",
    "sport": "entertainment",
    "sports": "entertainment",
    "culture": "entertainment",
    "museum": "entertainment",
    "gallery": "entertainment",
    "theater": "entertainment",
    "theatre": "entertainment",
    "dinner": "food",
    "lunch": "food",
    "breakfast": "food",
    "brunch": "food",
    "cafe": "food",
    "bar": "nightlife",
    "club": "nightlife",
    "beach": "nature",
    "park": "nature",
    "garden": "nature",
    "hike": "outdoor",
    "hiking": "outdoor",
    "spa": "wellness",
    "yoga": "wellness",
    "shop": "shopping",
    "market": "shopping",
    "hotel": "accommodation",
    "flight": "transport",
    "train": "transport",
    "taxi": "transport",
}

_TITLE_KEYWORDS = [
    ("hike", "outdoor"),
    ("trail", "outdoor"),
    ("kayak", "outdoor"),
    ("surf", "outdoor"),
    ("climb", "outdoor"),
    ("bike", "outdoor"),
    ("museum", "entertainment"),
    ("gallery", "entertainment"),
    ("concert", "entertainment"),
    ("symphony", "entertainment"),
    ("orchestra", "entertainment"),
    ("opera", "entertainment"),
    ("ballet", "entertainment"),
    ("theater", "entertainment"),
    ("theatre", "entertainment"),
    ("game", "entertainment"),
    ("match", "entertainment"),
    ("stadium", "entertainment"),
    ("beach", "nature"),
    ("park", "nature"),
    ("garden", "nature"),
    ("lake", "nature"),
    ("spa", "wellness"),
    ("hammam", "wellness"),
    ("onsen", "wellness"),
    ("yoga", "wellness"),
    ("market", "shopping"),
    ("mall", "shopping"),
    ("boutique", "shopping"),
    ("restaurant", "food"),
    ("cafe", "food"),
    ("café", "food"),
    ("dinner", "food"),
    ("lunch", "food"),
    ("bar ", "nightlife"),
    ("rooftop", "nightlife"),
    ("club", "nightlife"),
    ("hotel", "accommodation"),
    ("resort", "accommodation"),
    ("flight", "transport"),
    ("airport", "transport"),
    ("train", "transport"),
    ("metro", "transport"),
]


def normalize_activity_type(raw_type: str | None, title: str = "", description: str = "") -> str:
    """Map AI-returned activity_type to a valid enum value. Fallback: 'sightseeing'."""
    t = (raw_type or "").strip().lower()

    if t in VALID_ACTIVITY_TYPES:
        return t

    if t in _NORMALIZE_DIRECT:
        return _NORMALIZE_DIRECT[t]

    haystack = f"{title} {description}".lower()
    for kw, mapped in _TITLE_KEYWORDS:
        if kw in haystack:
            return mapped

    return "sightseeing"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_plan(
    request: Request,
    body: PlanRequest,
    token_payload: dict[str, Any] | None = Depends(verify_token),
):
    # Prefer token's user_id over body's user_id when both present
    effective_user_id: str | None = None
    if token_payload is not None:
        effective_user_id = token_payload.get("sub")
    if effective_user_id is None and body.user_id is not None:
        effective_user_id = str(body.user_id)

    logger.info(
        f"/plan/generate | user_id={effective_user_id} | session_id={body.session_id} "
        f"| message_preview={body.message[:40]!r}"
    )

    try:
        ladder = get_ladder()

        try:
            logger.info(f"Calling ladder | status={ladder.status()}")
            context: dict[str, Any] = {
                "sliders": body.sliders,
                "user_timezone": body.user_timezone,
            }
            plan = await ladder.generate_plan(body.message, context)
        except ValueError as e:
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:
            logger.error(f"Ladder exhausted: {type(e).__name__}: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"All AI providers currently unavailable. Please retry shortly. ({type(e).__name__})",
            )

        logger.info(
            f"AI plan received | destination={plan.get('destination')} "
            f"| items_count={len(plan.get('plan_items', plan.get('items', [])))}"
        )
        logger.debug(f"AI returned plan keys: {list(plan.keys())}")
        logger.debug(
            f"Plan items key: {'plan_items' if 'plan_items' in plan else 'items' if 'items' in plan else 'MISSING'}"
        )

        # Cross-validation: user-stated duration vs AI end_date vs items day count
        user_stated_days = parse_trip_duration_days(body.message)

        items_raw = plan.get("plan_items", plan.get("items", []))
        items_max_day = None
        if items_raw:
            day_numbers = [
                int(it.get("day_number", 1))
                for it in items_raw
                if it.get("day_number") is not None
            ]
            if day_numbers:
                items_max_day = max(day_numbers)

        ai_days = None
        start_str = plan.get("start_date")
        ai_end_str = plan.get("end_date")
        if start_str and ai_end_str:
            try:
                s = datetime.strptime(start_str, "%Y-%m-%d")
                e = datetime.strptime(ai_end_str, "%Y-%m-%d")
                ai_days = (e - s).days + 1
            except ValueError:
                pass

        # Decide authoritative day count
        authoritative_days = None
        source = None
        if user_stated_days is not None:
            authoritative_days = user_stated_days
            source = "user_stated"
        elif items_max_day is not None:
            authoritative_days = items_max_day
            source = "items_max"
        elif ai_days is not None:
            authoritative_days = ai_days
            source = "ai_end_date"

        logger.info(
            f"Duration cross-check | user_stated={user_stated_days} | ai_days={ai_days} "
            f"| items_max={items_max_day} | authoritative={authoritative_days} | source={source}"
        )

        disagreements = []
        if user_stated_days is not None and ai_days is not None and user_stated_days != ai_days:
            disagreements.append(f"user({user_stated_days})!=ai({ai_days})")
        if user_stated_days is not None and items_max_day is not None and user_stated_days != items_max_day:
            disagreements.append(f"user({user_stated_days})!=items({items_max_day})")
        if ai_days is not None and items_max_day is not None and ai_days != items_max_day:
            disagreements.append(f"ai({ai_days})!=items({items_max_day})")

        if disagreements:
            logger.warning(f"Trip duration disagreement | {' | '.join(disagreements)} | using {source}={authoritative_days}")

        if authoritative_days is not None and start_str:
            try:
                start_dt = datetime.strptime(start_str, "%Y-%m-%d")
                computed_end_dt = start_dt + timedelta(days=authoritative_days - 1)
                plan["end_date"] = computed_end_dt.strftime("%Y-%m-%d")

                if items_raw:
                    filtered_items = [
                        it for it in items_raw
                        if int(it.get("day_number", 1)) <= authoritative_days
                    ]
                    dropped_count = len(items_raw) - len(filtered_items)
                    if dropped_count > 0:
                        logger.warning(f"Dropped {dropped_count} plan_items with day_number > {authoritative_days}")
                    if "plan_items" in plan:
                        plan["plan_items"] = filtered_items
                    elif "items" in plan:
                        plan["items"] = filtered_items
            except ValueError as e:
                logger.error(f"Failed to reconcile dates: {e}")

        # Normalize activity_type on every item
        normalized_items = plan.get("plan_items", plan.get("items", []))
        remap_counts: dict[str, int] = {}
        for it in normalized_items:
            raw = it.get("activity_type")
            title = it.get("title", "")
            description = it.get("description", "")
            normalized = normalize_activity_type(raw, title, description)
            if normalized != raw:
                key = f"{raw}->{normalized}"
                remap_counts[key] = remap_counts.get(key, 0) + 1
                it["activity_type"] = normalized

        if remap_counts:
            remap_summary = ", ".join(f"{k}({v})" for k, v in remap_counts.items())
            logger.warning(f"activity_type remapped | {remap_summary}")

        if "plan_items" in plan:
            plan["plan_items"] = normalized_items
        elif "items" in plan:
            plan["items"] = normalized_items

        supabase = get_supabase()

        # Insert into trip_plans (unblocks event loop via asyncio.to_thread)
        try:
            logger.info("Inserting into trip_plans")
            trip_row = await asyncio.to_thread(
                lambda: supabase.table("trip_plans")
                .insert({
                    "session_id": str(body.session_id) if body.session_id else None,
                    "user_id": effective_user_id,
                    "destination": plan.get("destination"),
                    "start_date": plan.get("start_date"),
                    "end_date": plan.get("end_date"),
                    "budget_range": plan.get("budget_range"),
                    "plan_json": plan,
                    "status": "generated",
                    "version": 1,
                    "user_timezone": body.user_timezone,
                    "destination_timezone": plan.get("destination_timezone"),
                    "origin_city": plan.get("origin_city"),
                    "destination_latitude": plan.get("destination_latitude"),
                    "destination_longitude": plan.get("destination_longitude"),
                    "number_of_travelers": body.number_of_travelers,
                })
                .execute()
            )
        except Exception as e:
            logger.error(f"ERROR inserting trip_plan: {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save trip plan: {e}")

        trip_plan_id = trip_row.data[0]["id"]

        # TODO: restore slider_configs FK Phase 3
        # slider_configs insert commented out: the session_id column was incorrectly
        # set to trip_plan_id and the schema FK has not been reconciled yet.
        if body.sliders:
            logger.warning("slider_configs insert skipped — FK not reconciled (Phase 3 TODO)")

        # Insert each plan item
        plan_items = plan.get("plan_items", plan.get("items", []))
        logger.debug(f"Number of items to insert: {len(plan_items)}")
        logger.info(f"Inserting {len(plan_items)} plan_items")
        rows = [
            {
                "trip_id": trip_plan_id,
                "day_number": item.get("day_number"),
                "time_slot": item.get("time_slot"),
                "activity_type": item.get("activity_type"),
                "title": item.get("title"),
                "description": item.get("description"),
                "location_name": item.get("location_name"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "cost_estimate": item.get("cost_estimate"),
                "duration_minutes": item.get("duration_minutes"),
                "notes": item.get("notes"),
                "sort_order": item.get("sort_order"),
                "date": item.get("date"),
                "start_time": item.get("start_time"),
                "end_time": item.get("end_time"),
                "address": item.get("address", ""),
                "currency": item.get("currency", "USD"),
                "priority": normalize_priority(item.get("priority", "nice_to_have")),
                "timezone": item.get("timezone"),
            }
            for item in plan_items
        ]

        inserted_items = []
        if rows:
            try:
                insert_result = await asyncio.to_thread(
                    lambda: supabase.table("plan_items").insert(rows).execute()
                )
                inserted_items = insert_result.data or []
                logger.info(f"Inserted {len(inserted_items)} plan_items")
            except Exception as e:
                logger.error(f"Failed to insert plan_items: {type(e).__name__}: {e} | row_count={len(rows)}")
                # Attempt to clean up the orphan trip_plans row
                try:
                    await asyncio.to_thread(
                        lambda: supabase.table("trip_plans").delete().eq("id", trip_plan_id).execute()
                    )
                    logger.warning(f"Deleted orphan trip_plans row id={trip_plan_id}")
                except Exception as del_exc:
                    logger.error(f"Failed to delete orphan trip_plans row: {del_exc}")
                raise HTTPException(status_code=500, detail="Plan items save failed")

        plan_response = {k: v for k, v in plan.items() if k not in ("plan_items", "items")}

        return {
            "trip_plan_id": trip_plan_id,
            "user_timezone": body.user_timezone,
            "number_of_travelers": body.number_of_travelers,
            **plan_response,
            "plan_items": inserted_items,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/plan/generate failed | exception_type={type(e).__name__} | message={str(e)}")
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {str(e)}")


@router.get("/ladder-status")
async def ladder_status():
    return {"rungs": get_ladder().status()}
