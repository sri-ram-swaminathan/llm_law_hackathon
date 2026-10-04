from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..contracts import Artifact, ReleaseOut
from ..db import get_session
from ..models import ArtifactRow
from . import deps

router = APIRouter(tags=["releases"])


def _out(s: Session, release) -> ReleaseOut:
    return ReleaseOut(
        release=release,
        artifacts=deps.release_artifacts(s, release.id),
        latest_assessment=deps.latest_assessment(s, release.id),
    )


@router.get("/releases", response_model=list[ReleaseOut])
def list_releases(s: Session = Depends(get_session)):
    return [_out(s, r) for r in deps.list_releases(s)]


@router.get("/releases/{release_id}", response_model=ReleaseOut)
def get_release(release_id: str, s: Session = Depends(get_session)):
    return _out(s, deps.get_release(s, release_id))


@router.get("/artifacts/{artifact_id}", response_model=Artifact)
def get_artifact(artifact_id: str, s: Session = Depends(get_session)):
    row = s.get(ArtifactRow, artifact_id)
    if row is None:
        raise deps.not_found("artifact", artifact_id)
    return Artifact.model_validate(row.data)
