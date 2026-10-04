"""Agent output contract (SPEC §6.4). The model never sets severity."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .domain import Confidence, Conclusion, EvidenceRef


class FindingCandidate(BaseModel):
    requirement_id: str
    conclusion: Conclusion
    title: str = Field(max_length=160)
    reasoning_summary: str = Field(max_length=1200)
    evidence: list[EvidenceRef] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)  # must be a subset of requirement.derived_from
    confidence: Confidence
