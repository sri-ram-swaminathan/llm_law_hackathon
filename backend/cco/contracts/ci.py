"""CI release gate formats (SPEC §6.12): exit codes, comment marker, result.json, baseline."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from .activity import AgentEvent
from .domain import Assessment, Conclusion, FindingView, Release, Review
from .readiness import Readiness

EXIT_READY = 0  # READY or REVIEW_REQUIRED (the latter adds a warning annotation)
EXIT_NOT_READY = 1
EXIT_ENGINE_ERROR = 2  # Mistral unavailable, timeout, bad config: never reported as NOT READY
COMMENT_MARKER = "<!-- ccommit-check -->"
RESULT_FORMAT_VERSION = 1
BASELINE_FORMAT_VERSION = 1
BASELINE_PATH = "compliance/cco-baseline.json"
RESULT_ARTIFACT_NAME = "ccommit-result"


def exit_code_for_gate(gate: str) -> int:
    return EXIT_NOT_READY if gate == "NOT_READY" else EXIT_READY


class BaselineReview(BaseModel):
    requirement_id: str
    decision: str
    override_conclusion: Conclusion | None = None
    reviewer_name: str
    comment: str = ""
    evidence_fingerprint: str
    created_at: datetime


class Baseline(BaseModel):
    """compliance/cco-baseline.json, written by `cco export-baseline <release>`."""

    format_version: int = BASELINE_FORMAT_VERSION
    version: str | None = None  # released version; None for the empty initial baseline
    conclusions: dict[str, Conclusion] = Field(default_factory=dict)  # requirement_id -> effective
    reviews: list[BaselineReview] = Field(default_factory=list)


class CiResult(BaseModel):
    """`result.json` written by `cco audit`, consumed by `cco import`."""

    format_version: int = RESULT_FORMAT_VERSION
    status: Literal["ok", "engine_error"] = "ok"
    exit_code: int
    release: Release
    assessment: Assessment
    findings: list[FindingView]
    reviews: list[Review] = Field(default_factory=list)
    readiness: Readiness
    events: list[AgentEvent] = Field(default_factory=list)
    comment_md: str | None = None
    error: str | None = None
