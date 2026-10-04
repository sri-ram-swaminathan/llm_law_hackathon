"""Stub FastAPI app built only from the contract models, to export OpenAPI (SPEC §7).
Real handlers live in cco.main (T03); `make types` prefers that app when it exists."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, File, Form, UploadFile
from fastapi.responses import PlainTextResponse

from .api import (
    AssessmentCreated,
    ErrorOut,
    FindingDetail,
    ImportRequest,
    ProductOut,
    ReleaseOut,
    ReviewCreate,
    SchemaBundle,
)
from .domain import Artifact, Assessment, FindingView, LegalProvision, RegulatoryProfile, Review
from .readiness import Readiness

app = FastAPI(title="CCOmmit API", version="0.1.0")
r = APIRouter(prefix="/api")
_E = {409: {"model": ErrorOut}, 401: {"model": ErrorOut}}


def _stub():  # pragma: no cover
    raise NotImplementedError("contract stub")


@r.get("/product", response_model=ProductOut)
def get_product(): _stub()


@r.put("/product/profile", response_model=RegulatoryProfile)
def put_profile(body: RegulatoryProfile): _stub()


@r.get("/releases", response_model=list[ReleaseOut])
def list_releases(): _stub()


@r.post("/releases", response_model=ReleaseOut, status_code=201)
def create_release(version: str = Form(...), bundle: UploadFile = File(...)): _stub()


@r.post("/releases/import", response_model=ReleaseOut, status_code=201)
def import_release(body: ImportRequest): _stub()


@r.get("/releases/{release_id}", response_model=ReleaseOut)
def get_release(release_id: str): _stub()


@r.get("/artifacts/{artifact_id}", response_model=Artifact)
def get_artifact(artifact_id: str): _stub()


@r.post("/releases/{release_id}/assessments", response_model=AssessmentCreated, status_code=202, responses=_E)
def start_assessment(release_id: str): _stub()


@r.get("/assessments/{assessment_id}", response_model=Assessment)
def get_assessment(assessment_id: str): _stub()


@r.get("/releases/{release_id}/readiness", response_model=Readiness)
def get_readiness(release_id: str): _stub()


@r.get("/assessments/{assessment_id}/findings", response_model=list[FindingView])
def list_findings(assessment_id: str): _stub()


@r.get("/findings/{finding_id}", response_model=FindingDetail)
def get_finding(finding_id: str): _stub()


@r.post("/findings/{finding_id}/reviews", response_model=Review, status_code=201)
def create_review(finding_id: str, body: ReviewCreate): _stub()


@r.post("/reviews/{review_id}/revoke", response_model=Review)
def revoke_review(review_id: str): _stub()


@r.get("/runs/{run_id}/events", response_class=PlainTextResponse,
       description="text/event-stream of SseEnvelope frames. Query: requirement_id, after_seq.")
def run_events(run_id: str, requirement_id: str | None = None, after_seq: int = 0): _stub()


@r.get("/assessments/{assessment_id}/fix-plan.md", response_class=PlainTextResponse)
def fix_plan(assessment_id: str): _stub()


@r.get("/provisions/{provision_id}", response_model=LegalProvision)
def get_provision(provision_id: str): _stub()


@r.get("/provisions/{provision_id}/related", response_model=list[LegalProvision])
def related_provisions(provision_id: str): _stub()


@r.get("/_contracts", response_model=SchemaBundle, include_in_schema=True,
       description="Not a real endpoint: exposes AgentEvent, SseEnvelope and FindingCandidate in OpenAPI.")
def contracts_schema(): _stub()


app.include_router(r)


@app.get("/healthz")
def healthz(): _stub()
