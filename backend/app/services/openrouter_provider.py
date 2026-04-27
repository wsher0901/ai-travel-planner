import json
import logging
from datetime import date
from typing import AsyncGenerator

import httpx

from app.config import settings
from app.services.ai_provider import TravelAIProvider
from app.services._prompt_helpers import (
    SYSTEM_PROMPTS,
    build_preferences,
    build_plan_system_prompt,
    clean_json_response,
)

logger = logging.getLogger("roam.openrouter")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider(TravelAIProvider):

    def __init__(self, model: str = DEFAULT_OPENROUTER_MODEL) -> None:
        self.api_key = settings.openrouter_api_key
        self.model = model
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            # OpenRouter recommends these for attribution on free tier
            "HTTP-Referer": "https://github.com/wsher0901/ai-travel-planner",
            "X-Title": "Roam Travel Planner",
        }
        # Reuse a single AsyncClient across calls — avoids connection-pool churn
        self._client = httpx.AsyncClient(timeout=120.0)

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()

    async def stream_response(self, user_input: str, context: dict) -> AsyncGenerator[str, None]:
        system_prompt = SYSTEM_PROMPTS.get(context.get("mode", "plan"), SYSTEM_PROMPTS["plan"])
        system_prompt = f"Today's date is {date.today().isoformat()}. Always use future dates.\n\n" + system_prompt
        system_prompt += build_preferences(context.get("sliders"))

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
            "stream": True,
        }

        async with self._client.stream("POST", OPENROUTER_BASE_URL, headers=self.headers, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                    if delta:
                        yield delta
                except json.JSONDecodeError:
                    continue

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        logger.info(f"generate_plan called | model={self.model} | input_preview={user_input[:120]!r} | context_keys={list(context.keys()) if context else []}")
        system_prompt = build_plan_system_prompt(
            context.get("sliders"),
            user_timezone=context.get("user_timezone"),
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
            "max_tokens": 7000,
            "response_format": {"type": "json_object"},
        }

        raw = ""
        for attempt in range(3):
            try:
                logger.info(f"OpenRouter API call attempt {attempt + 1}/3 | model={self.model}")
                resp = await self._client.post(OPENROUTER_BASE_URL, headers=self.headers, json=payload)
                if resp.status_code == 429:
                    # Fail fast — the ladder will promote to the next rung
                    logger.warning(f"OpenRouter 429 rate limit on {self.model} — failing fast: {resp.text[:200]}")
                    raise httpx.HTTPStatusError(
                        f"429 rate limit: {resp.text[:200]}",
                        request=resp.request,
                        response=resp,
                    )
                if 400 <= resp.status_code < 500:
                    # Other 4xx (auth / malformed / etc.) — fail fast
                    logger.error(f"OpenRouter non-retriable status={resp.status_code} on {self.model}: {resp.text[:200]} — failing fast")
                    raise httpx.HTTPStatusError(
                        f"{resp.status_code} {resp.reason_phrase}: {resp.text[:200]}",
                        request=resp.request,
                        response=resp,
                    )
                resp.raise_for_status()
                data = resp.json()
                raw = data["choices"][0]["message"]["content"] or ""
                finish_reason = data["choices"][0].get("finish_reason", "unknown")
                logger.info(f"OpenRouter response received | length={len(raw)} | finish_reason={finish_reason} | preview={raw[:200]!r}")

                cleaned = clean_json_response(raw)
                return json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error(f"JSON parse failed on attempt {attempt + 1} | length={len(raw)} | head={raw[:300]!r}")
                if attempt == 2:
                    raise ValueError(f"JSON parse failed after 3 attempts\nRaw: {raw[:500]}")
                continue
            except httpx.HTTPStatusError as e:
                # 4xx statuses raised above propagate immediately; 5xx remains retriable.
                status_code = e.response.status_code if e.response is not None else None
                if status_code is not None and 400 <= status_code < 500:
                    raise
                logger.error(f"OpenRouter transient HTTP error on attempt {attempt + 1} | status={status_code} | msg={str(e)[:300]}")
                if attempt == 2:
                    raise
                continue
            except Exception as e:
                # Network / timeout / unknown — retriable
                logger.error(f"OpenRouter call failed on attempt {attempt + 1} | type={type(e).__name__} | msg={str(e)[:300]}")
                if attempt == 2:
                    raise
                continue

        return {}

    async def recommend_destinations(self, dates: dict, preferences: dict) -> list[dict]:
        raise NotImplementedError("recommend_destinations not implemented for OpenRouterProvider")
