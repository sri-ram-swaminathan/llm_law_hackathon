"""Demo controls (CCO_DEMO=1 only): GET /demo, POST /demo/reset, POST /demo/start."""

from __future__ import annotations

import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from .. import demo, pipeline
from ..seed import PRODUCT

router = APIRouter(tags=["demo"])


def _enabled() -> bool:
    return os.environ.get("CCO_DEMO") == "1"


def _require() -> None:
    if not _enabled():
        raise HTTPException(404, "Not Found")
    if pipeline.runner.lock_holder(PRODUCT.id) is not None:
        raise HTTPException(409, "an assessment is running; wait for it to finish")


@router.get("/demo")
def demo_status():
    if not _enabled():
        return {"enabled": False}
    return {"enabled": True, "manifest": demo.load_manifest()}


@router.post("/demo/reset")
def demo_reset(request: Request):
    _require()
    with request.app.state.sessionmaker() as s:
        try:
            out = demo.restore(s)
        except FileNotFoundError as e:
            raise HTTPException(404, str(e)) from e
        s.commit()
    return out


@router.post("/demo/start", status_code=202)
def demo_start(request: Request, background: BackgroundTasks):
    _require()
    sm = request.app.state.sessionmaker
    try:
        r = demo.start(sm)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    except pipeline.RunInFlight as e:
        raise HTTPException(409, str(e)) from e
    prep = r["prep"]
    background.add_task(pipeline.execute_run, sm, prep)
    return {"release": r["release"].model_dump(mode="json"), "assessment_id": prep.assessment_id,
            "run_id": prep.run_id, "provenance": r["provenance"]}
