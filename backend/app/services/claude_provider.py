"""Anthropic Claude provider.

Phase 3 target per CLAUDE.md (Claude Sonnet). This file is referenced by
``get_provider("claude")`` in ``ai_provider.py``; until the full streaming and
plan-generation integration is wired up, each method raises ``NotImplementedError``
with a clear message so failures surface deterministically rather than as a
``ModuleNotFoundError`` at import time.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

from app.config import settings
from app.services.ai_provider import TravelAIProvider

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-6"


class ClaudeProvider(TravelAIProvider):
    def __init__(self, model: str | None = None) -> None:
        self.model = model or DEFAULT_MODEL
        self.api_key = settings.anthropic_api_key
        if not self.api_key:
            logger.warning("ClaudeProvider instantiated without ANTHROPIC_API_KEY set.")

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        raise NotImplementedError(
            "ClaudeProvider.generate_plan is not yet implemented (Phase 3). "
            "Set AI_PROVIDER=groq or AI_PROVIDER=gemini for now."
        )

    async def stream_response(
        self, user_input: str, context: dict
    ) -> AsyncGenerator[str, None]:
        raise NotImplementedError(
            "ClaudeProvider.stream_response is not yet implemented (Phase 3). "
            "Set AI_PROVIDER=groq or AI_PROVIDER=gemini for now."
        )
        yield ""  # pragma: no cover - required for AsyncGenerator typing

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        return []
