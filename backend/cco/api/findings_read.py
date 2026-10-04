from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..contracts import FindingDetail, FindingView
from ..db import get_session
from ..models import FindingRow
from . import deps
from .provisions import find_provision

router = APIRouter(tags=["findings"])


@router.get("/assessments/{assessment_id}/findings", response_model=list[FindingView])
def list_findings(assessment_id: str, s: Session = Depends(get_session)):
    return deps.assessment_views(s, deps.get_assessment(s, assessment_id))


@router.get("/findings/{finding_id}", response_model=FindingDetail)
def get_finding(finding_id: str, s: Session = Depends(get_session)):
    row = s.get(FindingRow, finding_id)
    if row is None:
        raise deps.not_found("finding", finding_id)
    assessment = deps.get_assessment(s, row.assessment_id)
    view = next(v for v in deps.assessment_views(s, assessment) if v.id == finding_id)
    release = deps.get_release(s, assessment.release_id)
    reqs = deps.load_requirements(s)
    provisions = [p for p in (find_provision(c) for c in view.citations) if p is not None]
    reviews = [r for r in deps.product_reviews(s, release.product_id) if r.finding_id == finding_id]
    return FindingDetail(finding=view, requirement=reqs[view.requirement_id], provisions=provisions, reviews=reviews)
