"""Agent-activity events and the SSE envelope (SPEC §6.10)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

EventType = Literal[
    "step",
    "scope",
    "model_request",
    "model_response",
    "tool_call",
    "tool_result",
    "retry",
    "finding",
    "gate",
    "run_end",
]
EVENT_TYPES: tuple[str, ...] = (
    "step",
    "scope",
    "model_request",
    "model_response",
    "tool_call",
    "tool_result",
    "retry",
    "finding",
    "gate",
    "run_end",
)
RunKind = Literal["assessment", "mcp"]

PREVIEW_MAX_BYTES = 2048


class AgentEvent(BaseModel):
    run_id: str
    run_kind: RunKind = "assessment"
    seq: int
    ts: datetime
    type: EventType
    requirement_id: str | None = None
    tool: str | None = None
    attempt: int | None = None
    summary: str
    input_preview: str | None = None  # redacted, <= 2 KB
    output_preview: str | None = None  # redacted, <= 2 KB
    tokens: int | None = None
    latency_ms: int | None = None
    error: str | None = None


class SseEnvelope(BaseModel):
    """One SSE frame: `id: <seq>`, `event: agent_event`, `data: <AgentEvent json>`."""

    id: int  # == data.seq, usable as Last-Event-ID / after_seq
    event: Literal["agent_event"] = "agent_event"
    data: AgentEvent
