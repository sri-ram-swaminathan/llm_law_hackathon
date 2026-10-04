"""POST /releases/{id}/assessments (202, background run) and GET /assessments/{id}."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import pipeline
from ..contracts import Assessment, AssessmentCreated
from ..db import get_session
from . import deps

router = APIRouter(tags=["assessments"])


@router.post("/releases/{release_id}/assessments", response_model=AssessmentCreated, status_code=202)
async def start_assessment(release_id: str, request: Request, background: BackgroundTasks):
    sm = request.app.state.sessionmaker
    try:
        prep = pipeline.prepare_run(sm, release_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    except pipeline.RunInFlight as e:
        raise HTTPException(409, str(e)) from e
    background.add_task(pipeline.execute_run, sm, prep)
    return AssessmentCreated(assessment_id=prep.assessment_id, run_id=prep.run_id, status="queued")


@router.get("/assessments/{assessment_id}", response_model=Assessment)
def get_assessment(assessment_id: str, s: Session = Depends(get_session)):
    return deps.get_assessment(s, assessment_id)
