from typing import Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services.ai_provider import get_provider

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    mode: str = Field(pattern=r"^(zero-shot|plan|ask)$")
    session_id: Optional[str] = None
    sliders: Optional[dict] = None


@router.post("/stream")
async def chat_stream(body: ChatRequest):
    provider = get_provider(settings.ai_provider)

    async def event_generator():
        async for chunk in provider.stream_response(
            body.message,
            {"mode": body.mode, "session_id": body.session_id, "sliders": body.sliders},
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
