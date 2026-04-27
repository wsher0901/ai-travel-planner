import json
import logging
from datetime import date
from typing import AsyncGenerator

from groq import AsyncGroq, APIStatusError, RateLimitError

from app.config import settings
from app.services.ai_provider import TravelAIProvider
from app.services._prompt_helpers import (
    SYSTEM_PROMPTS,
    build_preferences,
    build_plan_system_prompt,
    clean_json_response,
)

logger = logging.getLogger("roam.groq")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

# 4xx status codes we never retry (auth, malformed request, etc.).
# 429 is handled separately via RateLimitError — fail-fast for ladder promotion.
_NON_RETRIABLE_STATUS_CODES = frozenset({400, 401, 403, 404, 409, 422})


class GroqProvider(TravelAIProvider):

    def __init__(self, model: str = DEFAULT_GROQ_MODEL) -> None:
        self.client = AsyncGroq(api_key=settings.groq_api_key)
        self.model = model

    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        system_prompt = SYSTEM_PROMPTS.get(context.get("mode", "plan"), SYSTEM_PROMPTS["plan"])
        system_prompt = f"Today's date is {date.today().isoformat()}. Always use future dates.\n\n" + system_prompt
        system_prompt += build_preferences(context.get("sliders"))
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
            stream=True,
            max_tokens=7000,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        logger.info(f"generate_plan called | model={self.model} | input_preview={user_input[:120]!r} | context_keys={list(context.keys()) if context else []}")
        system_prompt = build_plan_system_prompt(
            context.get("sliders"),
            user_timezone=context.get("user_timezone"),
        )

        raw = ""
        for attempt in range(3):
            try:
                logger.info(f"Groq API call attempt {attempt + 1}/3 | model={self.model}")
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input},
                    ],
                    stream=False,
                    max_tokens=7000,
                )
                raw = response.choices[0].message.content or ""
                logger.info(f"Groq response received | length={len(raw)} | preview={raw[:200]!r}")
                finish_reason = response.choices[0].finish_reason if response.choices else "unknown"
                logger.info(f"Groq finish_reason={finish_reason}")

                cleaned = clean_json_response(raw)
                return json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error(f"JSON parse failed on attempt {attempt + 1} | length={len(raw)} | head={raw[:300]!r} | tail={raw[-300:]!r}")
                if attempt == 2:
                    logger.error("All 3 attempts exhausted for generate_plan (JSON)")
                    raise ValueError(f"JSON parse failed after 3 attempts\nRaw: {raw[:500]}")
                continue
            except RateLimitError as e:
                # 429 — fail fast so the ladder promotes to the next rung immediately
                logger.warning(f"Groq 429 rate limit on {self.model} — failing fast: {str(e)[:200]}")
                raise
            except APIStatusError as e:
                status_code = getattr(e, "status_code", None)
                if status_code in _NON_RETRIABLE_STATUS_CODES:
                    logger.error(f"Groq non-retriable status={status_code} on {self.model}: {str(e)[:200]} — failing fast")
                    raise
                # 5xx and unclassified — retriable
                logger.error(f"Groq API error on attempt {attempt + 1} | status={status_code} | message={str(e)[:300]}")
                if attempt == 2:
                    logger.error("All 3 attempts exhausted for generate_plan")
                    raise
                continue
            except Exception as e:
                # Network / timeout / unknown — retriable
                logger.error(f"Groq call failed on attempt {attempt + 1} | exception_type={type(e).__name__} | message={str(e)}")
                if attempt == 2:
                    logger.error("All 3 attempts exhausted for generate_plan")
                    raise
                continue

        return {}

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        raise NotImplementedError("recommend_destinations not implemented for GroqProvider")
