import json
from datetime import date
from typing import AsyncGenerator

from groq import Groq

from app.config import settings
from app.services.ai_provider import TravelAIProvider


SLIDER_LABELS: dict[str, tuple[str, list[str]]] = {
    "budget":          ("Budget level",    ["Budget",   "Mid-range", "Luxury"]),
    "flexibility":     ("Trip pace",       ["Relaxed",  "Moderate",  "Packed"]),
    "inter_distance":  ("Travel distance", ["Nearby",   "Regional",  "Anywhere"]),
    "intra_distance":  ("Daily activity",  ["Easy",     "Moderate",  "Active"]),
    "adventure_level": ("Trip vibe",       ["Cultural", "Mixed",     "Adventure"]),
}


def _slider_label(value: int, labels: list[str]) -> str:
    if value <= 33:
        return labels[0]
    if value <= 66:
        return labels[1]
    return labels[2]


def _build_preferences(sliders: dict | None) -> str:
    if not sliders:
        return ""
    parts = []
    for key, (display_name, labels) in SLIDER_LABELS.items():
        value = sliders.get(key, 50)
        parts.append(f"{display_name}: {_slider_label(value, labels)}")
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


class GroqProvider(TravelAIProvider):

    def __init__(self) -> None:
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = "llama-3.3-70b-versatile"

    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        system_prompt = SYSTEM_PROMPTS.get(context.get("mode", "plan"), SYSTEM_PROMPTS["plan"])
        system_prompt = f"Today's date is {date.today().isoformat()}. Always use future dates.\n\n" + system_prompt
        system_prompt += _build_preferences(context.get("sliders"))
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
            stream=True,
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        date_context = (
            f"Today's date is {date.today().isoformat()}. Always generate plans for future dates. "
            f"If the user says something vague like 'a week in June', use the upcoming June. "
            f"Never use past dates.\n\n"
        )
        system_prompt = date_context + (
            "You are Roam, an expert AI travel planner. "
            "The user will describe when "
            "they are free and their preferences. You must respond with ONLY a valid "
            "JSON object — no explanation, no markdown, no code blocks, just raw JSON.\n\n"
            "The JSON must follow this exact structure:\n"
            "{\n"
            '  "destination": "London, United Kingdom",\n'
            '  "origin_city": "New York, NY",\n'
            '  "destination_timezone": "Europe/London",\n'
            '  "destination_latitude": 51.5074,\n'
            '  "destination_longitude": -0.1278,\n'
            '  "start_date": "YYYY-MM-DD",\n'
            '  "end_date": "YYYY-MM-DD",\n'
            '  "budget_range": "$1500-2000",\n'
            '  "summary": "2-3 sentence overview of the trip",\n'
            '  "items": [\n'
            "    {\n"
            '      "day_number": 1,\n'
            '      "date": "YYYY-MM-DD",\n'
            '      "sort_order": 1,\n'
            '      "time_slot": "morning",\n'
            '      "start_time": "09:00",\n'
            '      "end_time": "11:00",\n'
            '      "activity_type": "sightseeing",\n'
            '      "title": "Activity title",\n'
            '      "description": "2-3 sentence description",\n'
            '      "location_name": "Specific place name",\n'
            '      "address": "Full street address including city and postal code",\n'
            '      "latitude": 51.5014,\n'
            '      "longitude": -0.1419,\n'
            '      "cost_estimate": 30.00,\n'
            '      "currency": "GBP",\n'
            '      "duration_minutes": 120,\n'
            '      "priority": "must_do",\n'
            '      "notes": "Practical tip or note",\n'
            '      "timezone": "Europe/London"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "STRICT RULES — violating any of these will break the application:\n"
            "- origin_city is where the traveler is departing from, extracted from their message. "
            "If not mentioned, set to null\n"
            "- activity_type MUST be exactly one of: sightseeing, food, transport, "
            "accommodation, shopping, entertainment, outdoor, wellness, nightlife, culture\n"
            "- priority MUST be exactly one of: must_do, nice_to_have, flexible\n"
            "- start_time and end_time MUST be 24-hour format strings e.g. \"09:00\", \"21:30\"\n"
            "- date MUST be \"YYYY-MM-DD\" format matching the day_number offset from start_date\n"
            "- currency MUST be an ISO 4217 code e.g. USD, GBP, JPY, EUR, AUD\n"
            "- destination_timezone and timezone MUST be IANA format e.g. \"Asia/Tokyo\", \"Europe/London\"\n"
            "- latitude and longitude MUST be floats (not strings)\n"
            "- budget_range MUST be a dollar range string e.g. \"$1500-2000\"\n"
            "- Items must have realistic times that do not overlap; include travel time between locations\n"
            "- Generate at least 3 days with 3 items per day (morning, afternoon, evening)\n"
            "- Use real coordinates and real full addresses for all locations"
        )
        system_prompt += _build_preferences(context.get("sliders"))

        raw = ""
        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input},
                    ],
                    stream=False,
                )

                raw = response.choices[0].message.content or ""

                # Strip markdown code fences if present
                cleaned = raw.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                # Try to find JSON object if there's preamble text
                if not cleaned.startswith("{"):
                    start = cleaned.find("{")
                    if start != -1:
                        cleaned = cleaned[start:]

                # Find the last closing brace in case there's trailing text
                if cleaned.count("}") > 0:
                    last_brace = cleaned.rfind("}")
                    cleaned = cleaned[:last_brace + 1]

                return json.loads(cleaned)
            except (json.JSONDecodeError, Exception) as e:
                if attempt == 2:
                    raise ValueError(f"Failed after 3 attempts: {e}\nRaw: {raw[:500]}")
                continue

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        return []
