"""REST request/response shapes (SPEC §6.8) and the fixture container formats."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .activity import AgentEvent, SseEnvelope
from .ai import FindingCandidate
from .ci import CiResult
from .domain import (
    Artifact,
    Assessment,
    FindingView,
    LegalProvision,
    Product,
    RegulatoryProfile,
    Release,
    Requirement,
    Review,
    ReviewDecision,
    Conclusion,
)
from .readiness import Readiness


class ProductOut(BaseModel):
    product: Product
    profile: RegulatoryProfile


class ReleaseOut(BaseModel):
    release: Release
    artifacts: list[Artifact] = Field(default_factory=list)
    latest_assessment: Assessment | None = None


class AssessmentCreated(BaseModel):
    assessment_id: str
    run_id: str
    status: str = "queued"


class ReviewCreate(BaseModel):
    reviewer_name: str
    decision: ReviewDecision
    override_conclusion: Conclusion | None = None
    comment: str = ""


class FindingDetail(BaseModel):
    finding: FindingView
    requirement: Requirement
    provisions: list[LegalProvision] = Field(default_factory=list)
    reviews: list[Review] = Field(default_factory=list)


class ImportRequest(BaseModel):
    result: CiResult


class ErrorOut(BaseModel):
    detail: str


# --- fixture container (contracts/fixtures/<tag>.json) --------------------------------------
class ReleaseFixture(BaseModel):
    release: Release
    artifacts: list[Artifact]
    assessment: Assessment
    findings: list[FindingView]
    reviews: list[Review] = Field(default_factory=list)  # reviews that apply to this release
    readiness: Readiness


class RequirementsFixture(BaseModel):
    pack_version: str
    requirements: list[Requirement]


class ProvisionsFixture(BaseModel):
    provisions: list[LegalProvision]


class SchemaBundle(BaseModel):
    """Only exists so OpenAPI exposes the non-REST contracts (SSE frame, agent output) as types."""

    sse: SseEnvelope
    event: AgentEvent
    candidate: FindingCandidate
    generated_at: datetime | None = None
