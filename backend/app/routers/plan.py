from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from app.config import settings
from app.services.ai_provider import get_provider

router = APIRouter(prefix="/plan", tags=["plan"])

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


def normalize_priority(val: str) -> str:
    if not val:
        return "nice_to_have"
    v = val.strip().lower().replace(" ", "_")
    valid = {"must_do", "nice_to_have", "flexible"}
    return v if v in valid else "nice_to_have"


class PlanRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    sliders: Optional[dict] = None
    user_timezone: Optional[str] = None
    origin_city: Optional[str] = None
    number_of_travelers: Optional[int] = 1


@router.post("/generate")
async def generate_plan(body: PlanRequest):
    provider = get_provider(settings.ai_provider)

    try:
        plan = await provider.generate_plan(body.message, {"sliders": body.sliders})
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    print(f"AI returned plan with keys: {list(plan.keys())}")
    print(f"Plan items key: {'plan_items' if 'plan_items' in plan else 'items' if 'items' in plan else 'MISSING'}")

    # Insert into trip_plans
    try:
        trip_row = (
            supabase.table("trip_plans")
            .insert({
                "session_id": body.session_id,
                "user_id": body.user_id,
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
        print(f"ERROR inserting trip_plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save trip plan: {e}")

    trip_plan_id = trip_row.data[0]["id"]

    # Save slider config linked to the trip plan
    if body.sliders:
        supabase.table("slider_configs").insert({
            "session_id": trip_plan_id,
            "budget": body.sliders.get("budget", 50),
            "flexibility": body.sliders.get("flexibility", 50),
            "inter_distance": body.sliders.get("inter_distance", 50),
            "intra_distance": body.sliders.get("intra_distance", 50),
            "adventure_level": body.sliders.get("adventure_level", 50),
        }).execute()

    # Insert each plan item
    plan_items = plan.get("plan_items", plan.get("items", []))
    print(f"Number of items: {len(plan_items)}")
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
    try:
        if rows:
            supabase.table("plan_items").insert(rows).execute()
    except Exception as e:
        print(f"ERROR inserting plan_items: {e}")
        print(f"First row: {rows[0] if rows else 'empty'}")
        pass

    return {
        "trip_plan_id": trip_plan_id,
        "user_timezone": body.user_timezone,
        "number_of_travelers": body.number_of_travelers,
        **plan,
    }
