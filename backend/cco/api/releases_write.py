"""POST /releases (bundle upload) and POST /releases/import (CI result)."""

from __future__ import annotations

import io
import zipfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..contracts import CiResult, ReleaseOut
from ..contracts.bundle import MAX_COMPRESSED_BYTES
from ..db import get_session
from ..ingest import BundleError, ingest_bundle
from ..models import AgentEventRow, AssessmentRow, FindingRow, ReleaseRow, ReviewRow
from . import deps

router = APIRouter(tags=["releases"])


async def _read(upload: UploadFile) -> bytes:
    data = await upload.read(MAX_COMPRESSED_BYTES + 1)
    if len(data) > MAX_COMPRESSED_BYTES:
        raise HTTPException(413, "bundle exceeds the 50 MB compressed limit")
    return data


@router.post("/releases", response_model=ReleaseOut, status_code=201)
async def upload_release(
    version: str = Form(...),
    bundle: UploadFile = File(...),
    s: Session = Depends(get_session),
):
    data = await _read(bundle)
    try:
        release, arts = ingest_bundle(s, data, version, source="ui")
    except BundleError as e:
        s.rollback()
        raise HTTPException(409 if "already exists" in str(e) else 400, str(e)) from e
    s.commit()
    return ReleaseOut(release=release, artifacts=arts, latest_assessment=None)


def _parse_result(data: bytes) -> CiResult:
    if data[:2] == b"PK":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = [n for n in zf.namelist() if n.rsplit("/", 1)[-1] == "result.json"]
                if not names:
                    raise HTTPException(400, "artifact zip has no result.json")
                if zf.getinfo(names[0]).file_size > 20 * 1024 * 1024:
                    raise HTTPException(400, "result.json too large")
                data = zf.read(names[0])
        except zipfile.BadZipFile as e:
            raise HTTPException(400, "not a valid zip") from e
    try:
        return CiResult.model_validate_json(data)
    except ValidationError as e:
        raise HTTPException(422, f"invalid result.json: {e.error_count()} errors") from e


@router.post("/releases/import", response_model=ReleaseOut, status_code=201)
async def import_result(result: UploadFile = File(...), s: Session = Depends(get_session)):
    res = _parse_result(await _read(result))
    if res.status != "ok":
        raise HTTPException(400, "result has status engine_error; nothing to import")
    rel, asm = res.release, res.assessment
    if s.get(ReleaseRow, rel.id) is not None:
        raise HTTPException(409, f"release {rel.version} already exists")
    if s.get(AssessmentRow, asm.id) is not None:
        raise HTTPException(409, f"assessment {asm.id} already exists")
    j = lambda m: m.model_dump(mode="json")  # noqa: E731
    s.add(ReleaseRow(id=rel.id, product_id=rel.product_id, version=rel.version,
                     created_at=rel.created_at.isoformat() if rel.created_at else "", data=j(rel)))
    s.add(AssessmentRow(id=asm.id, release_id=rel.id, run_id=asm.run_id,
                        started_at=asm.started_at.isoformat() if asm.started_at else "", data=j(asm)))
    s.flush()
    from ..contracts import Finding

    for i, v in enumerate(res.findings):
        f = Finding.model_validate(v.model_dump(include=set(Finding.model_fields)))
        s.add(FindingRow(id=f.id, assessment_id=f.assessment_id, requirement_id=f.requirement_id, ord=i, data=j(f)))
    s.flush()
    for r in res.reviews:
        if s.get(ReviewRow, r.id) is None:
            s.add(ReviewRow(id=r.id, finding_id=r.finding_id, requirement_id=r.requirement_id,
                            product_id=r.product_id, created_at=r.created_at.isoformat(), data=j(r)))
    for ev in res.events:
        s.add(AgentEventRow(run_id=ev.run_id, seq=ev.seq, data=j(ev)))
    s.commit()
    return ReleaseOut(release=rel, artifacts=deps.release_artifacts(s, rel.id),
                      latest_assessment=deps.latest_assessment(s, rel.id))
