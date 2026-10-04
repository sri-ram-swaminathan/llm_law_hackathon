"""Readiness: launch gate, labels, coverage, changes since previous (SPEC §6.3)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Gate = Literal["NOT_READY", "REVIEW_REQUIRED", "READY"]
AI_LABEL = "AI pre-assessment, not legal advice"


class GateCounts(BaseModel):
    blockers: int = 0  # effective potential_violation with severity blocker
    missing_evidence: int = 0  # mandatory requirements effectively insufficient_evidence
    high: int = 0  # effective potential_violation with severity high
    medium: int = 0
    low: int = 0
    uncertain_unreviewed: int = 0
    requirements_total: int = 0
    requirements_evaluated: int = 0  # findings that needed a model call


class CounselReviewed(BaseModel):
    reviewed: int
    total: int


class DomainCoverage(BaseModel):
    domain: str
    total: int
    satisfied: int = 0
    potential_violation: int = 0
    insufficient_evidence: int = 0
    uncertain: int = 0
    not_applicable: int = 0


class ChangesSinceVersion(BaseModel):
    resolved: list[str] = Field(default_factory=list)  # requirement ids
    new: list[str] = Field(default_factory=list)
    unchanged: list[str] = Field(default_factory=list)


class Readiness(BaseModel):
    release_id: str
    assessment_id: str
    version: str
    gate: Gate
    gate_label: str  # "Not ready" | "Review required" | "Ready" | "Ready (AI)"
    labels: list[str]  # always contains AI_LABEL and "counsel-reviewed n/m"
    counts: GateCounts
    counsel_reviewed: CounselReviewed
    coverage: list[DomainCoverage]
    previous_release_id: str | None = None
    changes_since_previous: ChangesSinceVersion = Field(default_factory=ChangesSinceVersion)
    blockers: list[str] = Field(default_factory=list)  # requirement ids driving the gate, in order
