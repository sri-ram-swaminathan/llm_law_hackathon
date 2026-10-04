"""Reviews API (counsel decisions). AI values are never mutated; a revoke only sets revoked_at."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..contracts import Review, ReviewCreate
from ..db import get_session
from ..models import AssessmentRow, FindingRow, ReleaseRow, ReviewRow
from . import deps

router = APIRouter(tags=["reviews"])


@router.post("/findings/{finding_id}/reviews", response_model=Review, status_code=201)
def create_review(finding_id: str, body: ReviewCreate, s: Session = Depends(get_session)):
    frow = s.get(FindingRow, finding_id)
    if frow is None:
        raise deps.not_found("finding", finding_id)
    if body.decision == "override" and body.override_conclusion is None:
        raise HTTPException(422, "override_conclusion is required when decision is 'override'")
    if body.decision != "override" and body.override_conclusion is not None:
        raise HTTPException(422, "override_conclusion is only allowed when decision is 'override'")
    if not body.reviewer_name.strip():
        raise HTTPException(422, "reviewer_name is required")
    arow = s.get(AssessmentRow, frow.assessment_id)
    rrow = s.get(ReleaseRow, arow.release_id)
    review = Review(
        id=f"rev-{uuid.uuid4().hex[:12]}",
        finding_id=finding_id,
        requirement_id=frow.requirement_id,
        product_id=rrow.product_id,
        reviewer_name=body.reviewer_name.strip(),
        decision=body.decision,
        override_conclusion=body.override_conclusion,
        comment=body.comment,
        evidence_fingerprint=frow.data["evidence_fingerprint"],
        created_at=datetime.now(timezone.utc),
    )
    s.add(
        ReviewRow(
            id=review.id,
            finding_id=finding_id,
            requirement_id=review.requirement_id,
            product_id=review.product_id,
            created_at=review.created_at.isoformat(),
            data=review.model_dump(mode="json"),
        )
    )
    s.commit()
    return review


@router.post("/reviews/{review_id}/revoke", response_model=Review)
def revoke_review(review_id: str, s: Session = Depends(get_session)):
    row = s.get(ReviewRow, review_id)
    if row is None:
        raise deps.not_found("review", review_id)
    review = Review.model_validate(row.data)
    if review.revoked_at is None:
        review = review.model_copy(update={"revoked_at": datetime.now(timezone.utc)})
        row.data = review.model_dump(mode="json")
        s.commit()
    return review
