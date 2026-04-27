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


# Module-level provider singleton cache — keyed by (provider_name, model | "default")
_provider_cache: dict[tuple[str, str], TravelAIProvider] = {}


def get_provider(provider_name: str, model: str | None = None) -> TravelAIProvider:
    cache_key = (provider_name, model or "default")
    if cache_key in _provider_cache:
        return _provider_cache[cache_key]

    provider: TravelAIProvider
    if provider_name == "gemini":
        from app.services.gemini_provider import GeminiProvider
        provider = GeminiProvider(model=model) if model else GeminiProvider()
    elif provider_name == "groq":
        from app.services.groq_provider import GroqProvider
        provider = GroqProvider(model=model) if model else GroqProvider()
    elif provider_name == "claude":
        from app.services.claude_provider import ClaudeProvider
        provider = ClaudeProvider()
    elif provider_name == "openrouter":
        from app.services.openrouter_provider import OpenRouterProvider
        provider = OpenRouterProvider(model=model) if model else OpenRouterProvider()
    else:
        raise ValueError("Unknown provider: " + provider_name)

    _provider_cache[cache_key] = provider
    return provider
