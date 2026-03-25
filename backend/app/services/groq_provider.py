from typing import AsyncGenerator

from groq import Groq

from app.config import settings
from app.services.ai_provider import TravelAIProvider


class GroqProvider(TravelAIProvider):

    def __init__(self) -> None:
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = "llama-3.3-70b-versatile"

    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": user_input}],
            stream=True,
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        return {}

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        return []
