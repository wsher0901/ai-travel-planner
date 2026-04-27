"""Request models."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=200)
    sliders: dict[str, int] | None = None


class PlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, max_length=2000)
    session_id: UUID | None = None
    user_id: UUID | None = None
    sliders: dict[str, int] | None = None
    number_of_travelers: int | None = Field(default=1, ge=1, le=50)
    user_timezone: str | None = Field(default=None, max_length=64)
