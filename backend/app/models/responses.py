"""Response models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    provider: str


class PlanItemResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    trip_plan_id: str | None = None
    day_number: int | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    duration_minutes: int | None = None
    title: str | None = None
    description: str | None = None
    activity_type: str | None = None
    address: str | None = None
    cost_estimate: float | None = None
    currency: str | None = None
    priority: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    sort_order: int | None = None
    time_slot: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    reasoning: str | None = None


class PlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trip_plan_id: str | None = None
    plan: dict[str, Any] | None = None
    plan_items: list[PlanItemResponse] = []


class LadderStatusResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rungs: list[dict[str, Any]]
