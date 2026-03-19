from abc import ABC, abstractmethod
from typing import AsyncGenerator


class TravelAIProvider(ABC):

    @abstractmethod
    async def generate_plan(self, user_input: str, context: dict) -> dict:
        pass

    @abstractmethod
    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        pass


def get_provider(provider_name: str) -> TravelAIProvider:
    if provider_name == "gemini":
        from app.services.gemini_provider import GeminiProvider
        return GeminiProvider()
    elif provider_name == "groq":
        from app.services.groq_provider import GroqProvider
        return GroqProvider()
    elif provider_name == "claude":
        from app.services.claude_provider import ClaudeProvider
        return ClaudeProvider()
    raise ValueError("Unknown provider: " + provider_name)