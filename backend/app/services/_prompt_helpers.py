"""Shared helpers for building AI provider prompts.
Extracted from groq_provider.py so GeminiProvider (and future providers) can reuse.
"""
from datetime import date


SLIDER_LABELS: dict[str, tuple[str, list[str]]] = {
    "budget":          ("Budget level",    ["Budget",   "Mid-range", "Luxury"]),
    "flexibility":     ("Trip pace",       ["Relaxed",  "Moderate",  "Packed"]),
    "inter_distance":  ("Travel distance", ["Nearby",   "Regional",  "Anywhere"]),
    "intra_distance":  ("Daily activity",  ["Easy",     "Moderate",  "Active"]),
    "adventure_level": ("Trip vibe",       ["Cultural", "Mixed",     "Adventure"]),
}


def slider_label(value: int, labels: list[str]) -> str:
    if value <= 33:
        return labels[0]
    if value <= 66:
        return labels[1]
    return labels[2]


def build_preferences(sliders: dict | None) -> str:
    if not sliders:
        return ""
    parts = []
    for key, (display_name, labels) in SLIDER_LABELS.items():
        value = sliders.get(key, 50)
        parts.append(f"{display_name}: {slider_label(value, labels)}")
    return " User preferences: " + ", ".join(parts) + "."


SYSTEM_PROMPTS: dict[str, str] = {
    "zero-shot": (
        "You are Roam, an expert AI travel planner. The user will tell you when they "
        "are free and any preferences. Respond with a complete, detailed travel plan "
        "including destination recommendation, daily itinerary, best time to visit, "
        "estimated costs, flight info, accommodation suggestions, and local tips. "
        "Be specific, enthusiastic, and helpful."
    ),
    "plan": (
        "You are Roam, a conversational AI travel planner. Help the user build their "
        "perfect trip step by step through conversation. Ask clarifying questions about "
        "their dates, budget, interests, and travel style. Be warm, knowledgeable, and "
        "specific. Reference real places, restaurants, and experiences."
    ),
    "ask": (
        "You are Roam, a knowledgeable travel expert. Answer the user's travel questions "
        "accurately and helpfully. Include practical tips, local insights, best times to "
        "visit, and honest assessments. Be concise but thorough."
    ),
}


def build_plan_system_prompt(sliders: dict | None) -> str:
    """System prompt for structured JSON plan generation. Shared across all providers."""
    date_context = (
        f"Today's date is {date.today().isoformat()}. Generate plans for future dates only. "
        f"For vague phrasing like 'a week in June', use the upcoming June.\n\n"
    )
    body = (
        "You are Roam, an expert AI travel planner. Respond with ONLY a valid JSON "
        "object — no prose, no markdown, no code fences.\n\n"
        "SCHEMA (all fields required unless noted):\n"
        "{\n"
        '  "destination": str,\n'
        '  "origin_city": str | null,  // where traveler departs from; null if not stated\n'
        '  "destination_timezone": str,  // IANA, e.g. "Europe/London"\n'
        '  "destination_latitude": float, "destination_longitude": float,\n'
        '  "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD",\n'
        '  "budget_range": str,  // e.g. "$1500-2000"\n'
        '  "summary": str,  // 2-3 sentences\n'
        '  "items": [{\n'
        '    "day_number": int, "date": "YYYY-MM-DD", "sort_order": int,\n'
        '    "time_slot": "morning" | "afternoon" | "evening",\n'
        '    "start_time": "HH:MM", "end_time": "HH:MM",  // 24-hour\n'
        '    "activity_type": <one of the 10 below>,\n'
        '    "title": str, "description": str,  // 2-3 sentences\n'
        '    "location_name": str, "address": str,  // full street+city+postal\n'
        '    "latitude": float, "longitude": float,\n'
        '    "cost_estimate": float, "currency": str,  // ISO 4217: USD, GBP, EUR, JPY, AUD\n'
        '    "duration_minutes": int,\n'
        '    "priority": "must_do" | "nice_to_have" | "flexible",\n'
        '    "notes": str,\n'
        '    "timezone": str  // IANA\n'
        "  }]\n"
        "}\n\n"
        "ACTIVITY TYPES — pick exactly one; never invent new values:\n"
        "- transport: flights, trains, buses, taxis, car rentals, any movement between places\n"
        "- accommodation: hotels, hostels, Airbnbs, resorts\n"
        "- food: restaurants, cafes, food-focused bars, food tours, food markets, meals\n"
        "- sightseeing: landmarks, monuments, viewpoints, neighborhood walks, general tours\n"
        "- entertainment: museums, galleries, concerts, theater, opera, ballet, shows, spectator sports games, exhibitions\n"
        "- outdoor: hiking, biking, surfing, kayaking, climbing, ziplining, active physical activity\n"
        "- nightlife: drink-focused bars, clubs, rooftops, speakeasies, late-night venues\n"
        "- shopping: goods markets, boutiques, malls, shopping districts, souvenirs\n"
        "- wellness: spas, hammams, onsens, yoga, massage, retreats\n"
        "- nature: beaches, parks, gardens, nature reserves (passive nature, not active sport)\n"
        "Disambiguation: concert → entertainment. Baseball game → entertainment. "
        "Hike → outdoor. Beach visit → nature. Downtown walking tour → sightseeing. "
        "Never use 'activity', 'music', 'sports', 'culture', 'food_tour'.\n\n"
        "RULES:\n"
        "- date for each item = start_date + (day_number - 1) days\n"
        "- Times must not overlap; include travel time between locations\n"
        "- Minimum 3 days, 3 items/day (morning, afternoon, evening)\n"
        "- Use real coordinates and real full addresses\n"
        "- latitude/longitude are floats, not strings"
    )
    full = date_context + body + build_preferences(sliders)
    return full


def clean_json_response(raw: str) -> str:
    """Strip markdown fences, locate JSON object boundaries."""
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    # Find JSON object start if there's preamble
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        if start != -1:
            cleaned = cleaned[start:]
    # Trim trailing text after last closing brace
    if cleaned.count("}") > 0:
        last_brace = cleaned.rfind("}")
        cleaned = cleaned[:last_brace + 1]
    return cleaned
