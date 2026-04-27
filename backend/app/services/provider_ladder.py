import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from app.services.ai_provider import TravelAIProvider, get_provider

logger = logging.getLogger("roam.ladder")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


# Rung order: best → fallback. Free tiers only.
DEFAULT_RUNGS: list[tuple[str, str]] = [
    ("groq", "llama-3.3-70b-versatile"),
    ("groq", "llama-3.1-8b-instant"),
    ("openrouter", "meta-llama/llama-3.3-70b-instruct:free"),
    ("openrouter", "google/gemini-2.0-flash-exp:free"),
]

TRANSIENT_FAIL_BACKOFF_SEC = 60.0
MAX_COOLDOWN_SEC = 24 * 3600  # safety cap


@dataclass
class RungState:
    provider_name: str
    model_name: str
    available_at: float = 0.0  # epoch seconds; 0 = available now
    consecutive_failures: int = 0
    last_error: str | None = None

    def is_available(self, now: float) -> bool:
        return now >= self.available_at

    def mark_cooling(self, retry_after_sec: float, reason: str) -> None:
        delay = max(0.0, min(retry_after_sec, MAX_COOLDOWN_SEC))
        self.available_at = time.time() + delay
        self.last_error = reason
        logger.warning(
            f"Rung cooling | {self.provider_name}/{self.model_name} | "
            f"retry_after={delay:.0f}s | reason={reason}"
        )

    def mark_failed(self, reason: str) -> None:
        self.consecutive_failures += 1
        # Exponential backoff on transient errors: 60s, 120s, 240s, capped
        backoff = TRANSIENT_FAIL_BACKOFF_SEC * (2 ** (self.consecutive_failures - 1))
        self.mark_cooling(min(backoff, 600.0), reason)

    def mark_success(self) -> None:
        self.consecutive_failures = 0
        self.available_at = 0.0
        self.last_error = None


def parse_retry_after_from_groq(msg: str) -> float:
    """Parse Groq-style '429 — Please try again in 28m37.63s' messages.

    Note: this function is Groq-specific. For non-Groq providers (OpenRouter,
    Gemini) that don't embed a retry-after string in the error, the caller
    should use a safe default (e.g. 300s) rather than calling this function.
    """
    m = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", msg)
    if m:
        minutes = int(m.group(1)) if m.group(1) else 0
        seconds = float(m.group(2))
        return minutes * 60 + seconds
    # No parseable retry-after → default 5 min
    return 300.0


def is_rate_limit(exc: Exception) -> bool:
    name = type(exc).__name__.lower()
    msg = str(exc).lower()
    if "ratelimit" in name:
        return True
    if "429" in msg or "rate limit" in msg or "quota" in msg or "resource_exhausted" in msg:
        return True
    return False


class ProviderLadder:
    def __init__(self, rungs: list[tuple[str, str]] | None = None) -> None:
        self.rungs: list[RungState] = [
            RungState(provider_name=p, model_name=m)
            for p, m in (rungs or DEFAULT_RUNGS)
        ]

    def status(self) -> list[dict[str, Any]]:
        now = time.time()
        return [
            {
                "provider": r.provider_name,
                "model": r.model_name,
                "available": r.is_available(now),
                "available_in_sec": max(0.0, r.available_at - now),
                "consecutive_failures": r.consecutive_failures,
                "last_error": r.last_error,
            }
            for r in self.rungs
        ]

    async def generate_plan(self, user_input: str, context: dict) -> dict:
        last_exc: Exception | None = None
        attempted: list[str] = []

        for idx, rung in enumerate(self.rungs):
            # Refresh now inside the loop so cooling checks use current time
            now = time.time()
            if not rung.is_available(now):
                logger.info(
                    f"Skipping {rung.provider_name}/{rung.model_name} "
                    f"(cooling {rung.available_at - now:.0f}s)"
                )
                continue

            label = f"{rung.provider_name}/{rung.model_name}"
            attempted.append(label)
            logger.info(f"Ladder trying {label}")

            try:
                provider: TravelAIProvider = get_provider(rung.provider_name, rung.model_name)
                result = await provider.generate_plan(user_input, context)
                rung.mark_success()
                logger.info(f"Ladder succeeded on {label}")
                return result
            except Exception as e:
                last_exc = e
                reason = f"{type(e).__name__}: {str(e)[:200]}"
                rate_limited = is_rate_limit(e)
                if rate_limited:
                    # parse_retry_after_from_groq works for Groq; non-Groq providers
                    # will get the 300s default since their errors don't contain the
                    # "try again in Xm Ys" pattern.
                    retry_after = parse_retry_after_from_groq(str(e))
                    rung.mark_cooling(retry_after, reason)
                else:
                    rung.mark_failed(reason)

                next_label = (
                    f"{self.rungs[idx + 1].provider_name}/{self.rungs[idx + 1].model_name}"
                    if idx + 1 < len(self.rungs)
                    else None
                )
                if rate_limited and next_label:
                    logger.warning(f"{label} rate-limited (429), promoting to {next_label}")
                elif rate_limited:
                    logger.error(f"{label} rate-limited (429), no more rungs")
                elif next_label:
                    logger.warning(f"{label} failed ({reason}), promoting to {next_label}")
                else:
                    logger.warning(f"Ladder fell through from {label}: {reason}")
                continue

        logger.error(f"Ladder exhausted | attempted={attempted}")
        if last_exc:
            raise last_exc
        raise RuntimeError("All providers cooling; no rung attempted")


# Module-level singleton. Safe for FastAPI's single-process dev server.
# Phase 5: replace with Redis-backed state for multi-worker deployments.
_ladder_singleton: ProviderLadder | None = None


def get_ladder() -> ProviderLadder:
    global _ladder_singleton
    if _ladder_singleton is None:
        _ladder_singleton = ProviderLadder()
    return _ladder_singleton
