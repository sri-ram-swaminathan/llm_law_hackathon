"""Fix plan endpoint: deterministic Markdown (SPEC 6.11), same bytes as the MCP tool."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from ..db import get_session
from ..fixplan import render_fix_plan

router = APIRouter(tags=["fixplan"])


@router.get("/assessments/{assessment_id}/fix-plan.md")
def get_fix_plan(assessment_id: str, s: Session = Depends(get_session)):
    return Response(render_fix_plan(s, assessment_id).encode("utf-8"), media_type="text/markdown; charset=utf-8")
