from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..contracts import Readiness
from ..db import get_session
from . import deps

router = APIRouter(tags=["readiness"])


@router.get("/releases/{release_id}/readiness", response_model=Readiness)
def get_readiness(release_id: str, s: Session = Depends(get_session)):
    return deps.release_readiness(s, release_id)
