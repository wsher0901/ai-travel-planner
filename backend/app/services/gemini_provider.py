import asyncio
import json
import logging
from datetime import date
from typing import AsyncGenerator

import google.generativeai as genai

from app.config import settings
from app.services.ai_provider import TravelAIProvider
from app.services._prompt_helpers import (
    SYSTEM_PROMPTS,
    build_preferences,
    build_plan_system_prompt,
    clean_json_response,
)

logger = logging.getLogger("roam.gemini")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"


class GeminiProvider(TravelAIProvider):

    def __init__(self, model: str = DEFAULT_GEMINI_MODEL) -> None:
        genai.configure(api_key=settings.gemini_api_key)
        self.model_name = model

    def _model_with_system(self, system_prompt: str) -> "genai.GenerativeModel":
        return genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
        )

    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        system_prompt = SYSTEM_PROMPTS.get(context.get("mode", "plan"), SYSTEM_PROMPTS["plan"])
        system_prompt = f"Today's date is {date.today().isoformat()}. Always use future dates.\n\n" + system_prompt
        system_prompt += build_preferences(context.get("sliders"))
        model = self._model_with_system(system_prompt)

        # generate_content_async with stream=True; wrap sync iteration in to_thread as safety net
        try:
            response = await model.generate_content_async(user_input, stream=True)
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception:
            # Fallback: collect all chunks synchronously off the event loop
            chunks = await asyncio.to_thread(
                lambda: list(model.generate_content(user_input, stream=True))
            )
            for chunk in chunks:
                if chunk.text:
                    yield chunk.text

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        logger.info(f"generate_plan called | model={self.model_name} | input_preview={user_input[:120]!r} | context_keys={list(context.keys()) if context else []}")
        system_prompt = build_plan_system_prompt(
            context.get("sliders"),
            user_timezone=context.get("user_timezone"),
        )
        model = self._model_with_system(system_prompt)

        raw = ""
        for attempt in range(3):
            try:
                logger.info(f"Gemini API call attempt {attempt + 1}/3 | model={self.model_name}")
                response = await model.generate_content_async(
                    user_input,
                    generation_config={
                        "max_output_tokens": 7000,
                        "response_mime_type": "application/json",
                    },
                )
                raw = response.text or ""
                logger.info(f"Gemini response received | length={len(raw)} | preview={raw[:200]!r}")

                cleaned = clean_json_response(raw)
                return json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error(f"JSON parse failed on attempt {attempt + 1} | length={len(raw)} | head={raw[:300]!r} | tail={raw[-300:]!r}")
                if attempt == 2:
                    logger.error("All 3 attempts exhausted for generate_plan (JSON)")
                    raise ValueError(f"JSON parse failed after 3 attempts\nRaw: {raw[:500]}")
                continue
            except Exception as e:
                logger.error(f"Gemini call failed on attempt {attempt + 1} | exception_type={type(e).__name__} | message={str(e)}")
                if attempt == 2:
                    logger.error("All 3 attempts exhausted for generate_plan")
                    raise
                continue

        return {}

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        raise NotImplementedError("recommend_destinations not implemented for GeminiProvider")
