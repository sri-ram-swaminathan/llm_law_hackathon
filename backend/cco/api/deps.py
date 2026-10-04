"""Shared loaders used by the routers (and by later tasks' routers/services)."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import gate
from ..contracts import (
    Artifact,
    Assessment,
    Finding,
    FindingView,
    Product,
    Readiness,
    RegulatoryProfile,
    Release,
    Requirement,
    Review,
)
from ..models import (
    ArtifactRow,
    AssessmentRow,
    FindingRow,
    ProductRow,
    ReleaseRow,
    RequirementRow,
    ReviewRow,
)


def not_found(what: str, id_: str) -> HTTPException:
    return HTTPException(404, f"{what} {id_!r} not found")


def get_product(s: Session) -> tuple[Product, RegulatoryProfile]:
    row = s.scalars(select(ProductRow).order_by(ProductRow.id)).first()
    if row is None:
        raise HTTPException(404, "no product (run `make seed`)")
    return Product.model_validate(row.data), RegulatoryProfile.model_validate(row.profile)


def load_requirements(s: Session) -> dict[str, Requirement]:
    rows = s.scalars(select(RequirementRow).order_by(RequirementRow.ord)).all()
    return {r.id: Requirement.model_validate(r.data) for r in rows}


def get_release(s: Session, release_id: str) -> Release:
    row = s.get(ReleaseRow, release_id)
    if row is None:
        raise not_found("release", release_id)
    return Release.model_validate(row.data)


def list_releases(s: Session) -> list[Release]:
    rows = s.scalars(select(ReleaseRow).order_by(ReleaseRow.created_at.desc(), ReleaseRow.id)).all()
    return [Release.model_validate(r.data) for r in rows]


def release_artifacts(s: Session, release_id: str) -> list[Artifact]:
    rows = s.scalars(select(ArtifactRow).where(ArtifactRow.release_id == release_id).order_by(ArtifactRow.id)).all()
    return [Artifact.model_validate(r.data) for r in rows]


def get_assessment(s: Session, assessment_id: str) -> Assessment:
    row = s.get(AssessmentRow, assessment_id)
    if row is None:
        raise not_found("assessment", assessment_id)
    return Assessment.model_validate(row.data)


def latest_assessment(s: Session, release_id: str, completed_only: bool = False) -> Assessment | None:
    rows = s.scalars(
        select(AssessmentRow)
        .where(AssessmentRow.release_id == release_id)
        .order_by(AssessmentRow.started_at.desc(), AssessmentRow.id.desc())
    ).all()
    for r in rows:
        a = Assessment.model_validate(r.data)
        if not completed_only or a.status == "completed":
            return a
    return None


def assessment_findings(s: Session, assessment_id: str) -> list[Finding]:
    rows = s.scalars(select(FindingRow).where(FindingRow.assessment_id == assessment_id).order_by(FindingRow.ord, FindingRow.id)).all()
    return [Finding.model_validate(r.data) for r in rows]


def product_reviews(s: Session, product_id: str) -> list[Review]:
    rows = s.scalars(select(ReviewRow).where(ReviewRow.product_id == product_id).order_by(ReviewRow.created_at, ReviewRow.id)).all()
    return [Review.model_validate(r.data) for r in rows]


def version_by_finding(s: Session) -> dict[str, str]:
    q = (
        select(FindingRow.id, ReleaseRow.version)
        .join(AssessmentRow, AssessmentRow.id == FindingRow.assessment_id)
        .join(ReleaseRow, ReleaseRow.id == AssessmentRow.release_id)
    )
    return {fid: v for fid, v in s.execute(q).all()}


def assessment_views(s: Session, assessment: Assessment) -> list[FindingView]:
    release = get_release(s, assessment.release_id)
    return gate.build_views(
        assessment_findings(s, assessment.id),
        product_reviews(s, release.product_id),
        release.product_id,
        version_by_finding(s),
    )


def release_readiness(s: Session, release_id: str) -> Readiness:
    release = get_release(s, release_id)
    assessment = latest_assessment(s, release_id, completed_only=True)
    if assessment is None:
        raise HTTPException(404, f"release {release_id!r} has no completed assessment")
    views = assessment_views(s, assessment)
    prev_views = None
    prev_release = gate.resolve_previous_release(release, list_releases(s))
    if prev_release is not None:
        prev = latest_assessment(s, prev_release.id, completed_only=True)
        if prev is not None:
            prev_views = assessment_views(s, prev)
    r = gate.compute_readiness(release, assessment, views, load_requirements(s), prev_views)
    if prev_release is not None:
        r = r.model_copy(update={"previous_release_id": prev_release.id})
    return r
