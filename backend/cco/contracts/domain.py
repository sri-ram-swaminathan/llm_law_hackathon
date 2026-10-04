"""Core domain models (SPEC §6.2, §6.3). Field names follow the SPEC exactly."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- enums (§6.3)
Conclusion = Literal[
    "satisfied", "potential_violation", "insufficient_evidence", "not_applicable", "uncertain"
]
Severity = Literal["blocker", "high", "medium", "low"]
ArtifactKind = Literal[
    "business_plan",
    "product_spec",
    "privacy_policy",
    "terms",
    "regulatory_registration",
    "code_repo",
    "other",
]
ReleaseSource = Literal["seed", "ui", "ci"]
ReviewDecision = Literal["confirm", "override", "not_applicable", "need_evidence"]
ProvisionKind = Literal["law", "guidance"]
ProvisionSource = Literal["cellar", "legifrance", "manual"]
AssessmentStatus = Literal["queued", "running", "completed", "failed"]
RemediationKind = Literal["code", "document", "organisational"]

SEVERITY_ORDER: dict[str, int] = {"blocker": 0, "high": 1, "medium": 2, "low": 3}

# ---------------------------------------------------------------- company side


class Organization(BaseModel):
    id: str
    name: str


class Product(BaseModel):
    id: str
    organization_id: str
    name: str
    description: str = ""


class RegulatoryProfile(BaseModel):
    jurisdictions: list[str]
    industry: str
    activities: list[str]
    customer_types: list[str]
    data_categories: list[str]
    ai_uses: list[str]
    stage: str
    confirmed_at: datetime | None = None


class Release(BaseModel):
    id: str
    product_id: str = "wealthpilot"
    version: str  # e.g. 0.9.0, 1.0.0-rc.2, 1.0.0
    source: ReleaseSource
    git_sha: str | None = None
    branch: str | None = None
    pr_number: int | None = None
    ci_run_url: str | None = None
    previous_release_id: str | None = None
    created_at: datetime | None = None


class CodeFile(BaseModel):
    path: str
    content: str  # redacted


class Artifact(BaseModel):
    id: str
    release_id: str
    kind: ArtifactKind
    path: str
    text: str = ""  # redacted; empty for code_repo
    files: list[CodeFile] = Field(default_factory=list)  # code_repo only
    sha256: str


# ---------------------------------------------------------------- legal side


class LegalProvision(BaseModel):
    id: str
    kind: ProvisionKind = "law"
    source: ProvisionSource
    issuer: str | None = None  # ESMA, AMF, CNIL for guidance
    jurisdiction: str  # EU | FR
    act_title: str
    celex: str | None = None
    legi_id: str | None = None
    article: str
    paragraph: str | None = None
    text: str
    source_url: str
    retrieved_at: datetime
    embedding: list[float] | None = None  # vector(1024); omitted in fixtures


class EvidenceHints(BaseModel):
    artifact_kinds: list[ArtifactKind] = Field(default_factory=list)
    code_globs: list[str] = Field(default_factory=list)


class RemediationPart(BaseModel):
    id: str  # P1..P6 for code parts, A1..A4 for document/organisational parts
    kind: RemediationKind
    title: str
    required_change: str  # Markdown
    locations: list[str] = Field(default_factory=list)  # globs or path:line anchors
    boundaries: list[str] = Field(default_factory=list)  # files the part may touch
    done_when: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)  # part ids


class Remediation(BaseModel):
    parts: list[RemediationPart] = Field(default_factory=list)


class Requirement(BaseModel):
    id: str  # e.g. FR-CIF-STATUS-01
    alias: str | None = None  # W1..W8, C1, C2 (demo shorthand)
    domain: str
    title: str
    statement: str
    derived_from: list[str]  # LegalProvision ids
    applies_when: str  # expression over the regulatory profile
    mandatory: bool = False
    severity: Severity
    evidence_hints: EvidenceHints
    evidence_needed: str
    remediation: Remediation = Field(default_factory=Remediation)


# ---------------------------------------------------------------- evidence refs


class DocumentSpanRef(BaseModel):
    type: Literal["document_span"] = "document_span"
    artifact_id: str
    quote: str
    start: int | None = None  # character offsets, resolved server-side from the quote
    end: int | None = None


class CodeRef(BaseModel):
    type: Literal["code"] = "code"
    artifact_id: str
    path: str
    start_line: int
    end_line: int
    quote: str


class MissingRef(BaseModel):
    type: Literal["missing"] = "missing"
    artifact_kind: ArtifactKind


EvidenceRef = Annotated[DocumentSpanRef | CodeRef | MissingRef, Field(discriminator="type")]


# ---------------------------------------------------------------- findings


class Confidence(BaseModel):
    applicability: float = Field(ge=0, le=1)
    evidence: float = Field(ge=0, le=1)
    finding: float = Field(ge=0, le=1)


class Assessment(BaseModel):
    id: str
    release_id: str
    status: AssessmentStatus
    pack_version: str
    model: str
    run_id: str
    started_at: datetime | None = None
    finished_at: datetime | None = None


class Finding(BaseModel):
    id: str
    assessment_id: str
    requirement_id: str
    conclusion: Conclusion  # AI value, immutable
    severity: Severity  # copied from the requirement
    title: str
    reasoning_summary: str
    evidence: list[EvidenceRef] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)  # LegalProvision ids
    confidence: Confidence
    attempts: int = 1
    validation_notes: list[str] = Field(default_factory=list)
    evidence_fingerprint: str


class Review(BaseModel):
    id: str
    finding_id: str
    requirement_id: str
    product_id: str
    reviewer_name: str
    decision: ReviewDecision
    override_conclusion: Conclusion | None = None
    comment: str = ""
    evidence_fingerprint: str
    created_at: datetime
    revoked_at: datetime | None = None


class FindingView(Finding):
    """A finding as served by the API: AI value plus the applicable review, if any."""

    applicable_review: Review | None = None
    carried_from_version: str | None = None  # set when the review comes from an earlier release
    effective_conclusion: Conclusion
