from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.limiter import limiter
from app.models.requests import ChatRequest
from app.services.ai_provider import get_provider
from app.services.auth import verify_token

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
@limiter.limit("30/minute")
async def chat_stream(
    request: Request,
    body: ChatRequest,
    _token: dict[str, Any] | None = Depends(verify_token),
):
    provider = get_provider(settings.ai_provider)

    async def event_generator():
        async for chunk in provider.stream_response(
            body.message,
            {"mode": "zero-shot", "session_id": body.session_id, "sliders": body.sliders},
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
