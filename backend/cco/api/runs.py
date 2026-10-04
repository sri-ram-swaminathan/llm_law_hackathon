"""Run summaries and the SSE event stream (SPEC §6.10). Mounted under /api."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ..activity.recorder import set_recorder_sessionmaker
from ..db import get_session
from ..models import AgentEventRow, AssessmentRow

router = APIRouter()

POLL_S = 0.25
MAX_GAP_S = 2.0
_sleep = asyncio.sleep  # patched in tests


def _summary(run_id: str, rows: list[AgentEventRow]) -> dict:
    evs = [r.data for r in rows]
    end = next((e for e in reversed(evs) if e["type"] == "run_end"), None)
    return {
        "run_id": run_id,
        "run_kind": evs[0].get("run_kind", "assessment") if evs else None,
        "status": "running" if end is None else ("failed" if end.get("error") or end.get("summary") in ("failed", "error") else "ok"),
        "started_at": evs[0]["ts"] if evs else None,
        "ended_at": end["ts"] if end else None,
        "totals": {
            "events": len(evs),
            "tokens": sum(e.get("tokens") or 0 for e in evs),
            "tool_calls": sum(1 for e in evs if e["type"] == "tool_call"),
            "retries": sum(1 for e in evs if e["type"] == "retry"),
            "findings": sum(1 for e in evs if e["type"] == "finding"),
            "errors": sum(1 for e in evs if e.get("error")),
            "latency_ms": sum(e.get("latency_ms") or 0 for e in evs),
        },
    }


def _rows(s: Session, run_id: str) -> list[AgentEventRow]:
    return list(s.scalars(select(AgentEventRow).where(AgentEventRow.run_id == run_id).order_by(AgentEventRow.seq)))


@router.get("/runs", tags=["runs"])
def list_runs(release_id: str | None = None, s: Session = Depends(get_session)):
    if release_id:
        run_ids = [r for r in s.scalars(select(AssessmentRow.run_id).where(AssessmentRow.release_id == release_id))]
    else:
        run_ids = list(s.scalars(select(AgentEventRow.run_id).distinct()))
    out = [_summary(r, _rows(s, r)) for r in run_ids]
    return sorted(out, key=lambda x: x["started_at"] or "", reverse=True)


@router.get("/runs/{run_id}", tags=["runs"])
def get_run(run_id: str, s: Session = Depends(get_session)):
    rows = _rows(s, run_id)
    if not rows:
        raise HTTPException(404, "run not found")
    return _summary(run_id, rows)


@router.get("/runs/{run_id}/events", tags=["runs"])
async def run_events(
    run_id: str,
    request: Request,
    after_seq: int = 0,
    requirement_id: str | None = None,
    replay: bool = False,
    speed: float = 1.0,
):
    sm = request.app.state.sessionmaker
    set_recorder_sessionmaker(sm)
    speed = speed if speed > 0 else 1.0

    def fetch(after: int) -> list[dict]:
        with sm() as s:
            return [r.data for r in s.scalars(
                select(AgentEventRow).where(AgentEventRow.run_id == run_id, AgentEventRow.seq > after)
                .order_by(AgentEventRow.seq))]

    async def gen():
        last = after_seq
        prev_ts: datetime | None = None
        while True:
            batch = fetch(last)
            for d in batch:
                last = d["seq"]
                if replay:
                    ts = datetime.fromisoformat(d["ts"])
                    if prev_ts is not None:
                        gap = min(max((ts - prev_ts).total_seconds(), 0.0), MAX_GAP_S)
                        if gap > 0:
                            await _sleep(gap / speed)
                    prev_ts = ts
                if requirement_id is None or d.get("requirement_id") == requirement_id:
                    yield {"id": str(d["seq"]), "event": "agent_event", "data": json.dumps(d)}
                if d["type"] == "run_end":
                    return
            if not batch:
                await _sleep(POLL_S)

    return EventSourceResponse(gen())
