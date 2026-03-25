from typing import AsyncGenerator

import google.generativeai as genai

from app.config import settings
from app.services.ai_provider import TravelAIProvider


class GeminiProvider(TravelAIProvider):

    def __init__(self) -> None:
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        response = self.model.generate_content(user_input, stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        return {}

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        return []
