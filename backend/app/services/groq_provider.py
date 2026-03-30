import json
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
        system_prompt = (
            "You are Roam, an expert AI travel planner. The user will describe when "
            "they are free and their preferences. You must respond with ONLY a valid "
            "JSON object — no explanation, no markdown, no code blocks, just raw JSON. "
            "The JSON must follow this exact structure:\n"
            "{\n"
            '  "destination": "City, Country",\n'
            '  "start_date": "YYYY-MM-DD",\n'
            '  "end_date": "YYYY-MM-DD",\n'
            '  "budget_range": "budget|mid-range|luxury",\n'
            '  "summary": "2-3 sentence overview of the trip",\n'
            '  "plan_items": [\n'
            "    {\n"
            '      "day_number": 1,\n'
            '      "time_slot": "morning|afternoon|evening",\n'
            '      "activity_type": "transport|accommodation|food|activity|sightseeing",\n'
            '      "title": "Activity title",\n'
            '      "description": "2-3 sentence description",\n'
            '      "location_name": "Specific place name",\n'
            '      "latitude": 0.0,\n'
            '      "longitude": 0.0,\n'
            '      "cost_estimate": 0,\n'
            '      "duration_minutes": 60,\n'
            '      "notes": "Practical tip or note",\n'
            '      "sort_order": 1\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Generate at least 3 days with 3 time slots per day (morning, afternoon, "
            "evening). Use real coordinates for all locations."
        )
        system_prompt += _build_preferences(context.get("sliders"))

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
            stream=False,
        )

        raw = response.choices[0].message.content or ""
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse AI response as JSON: {e}\nRaw response: {raw}")

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        return []
