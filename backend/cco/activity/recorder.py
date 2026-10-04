"""Event recorder: one `agent_events` table, monotonic seq per run, redacted 2 KB previews (SPEC §6.10)."""

from __future__ import annotations

import threading

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from ..contracts.activity import PREVIEW_MAX_BYTES, AgentEvent
from ..models import AgentEventRow
from ..redact import redact

_lock = threading.Lock()


def preview(text: str | None) -> str | None:
    """Redact first, then cap at PREVIEW_MAX_BYTES (UTF-8 safe)."""
    if text is None:
        return None
    b = redact(text).encode("utf-8")
    if len(b) <= PREVIEW_MAX_BYTES:
        return b.decode("utf-8")
    return b[:PREVIEW_MAX_BYTES].decode("utf-8", errors="ignore")


class DbActivityRecorder:
    """Implements the ActivityRecorder protocol: `record(event) -> stored event`."""

    def __init__(self, sm: sessionmaker[Session]):
        self._sm = sm

    def record(self, event: AgentEvent) -> AgentEvent:
        ev = event.model_copy(update={
            "input_preview": preview(event.input_preview),
            "output_preview": preview(event.output_preview),
            "summary": redact(event.summary),
            "error": redact(event.error) if event.error else event.error,
        })
        with _lock, self._sm() as s:
            for _ in range(5):
                nxt = s.execute(
                    select(func.coalesce(func.max(AgentEventRow.seq), 0) + 1).where(AgentEventRow.run_id == ev.run_id)
                ).scalar_one()
                ev = ev.model_copy(update={"seq": nxt})
                try:
                    s.add(AgentEventRow(run_id=ev.run_id, seq=nxt, data=ev.model_dump(mode="json")))
                    s.commit()
                    return ev
                except IntegrityError:
                    s.rollback()
            raise RuntimeError("could not allocate event seq")


_recorder: DbActivityRecorder | None = None
_sm: sessionmaker[Session] | None = None


def set_recorder_sessionmaker(sm: sessionmaker[Session]) -> None:
    global _recorder, _sm
    _sm = sm
    _recorder = DbActivityRecorder(sm)


def get_recorder() -> DbActivityRecorder:
    """Process-wide recorder. Bound to the app's sessionmaker on first API request, else to the configured DB."""
    global _recorder
    if _recorder is None:
        from ..db import init_db, make_engine, make_sessionmaker

        eng = make_engine()
        init_db(eng)
        set_recorder_sessionmaker(make_sessionmaker(eng))
    return _recorder  # type: ignore[return-value]
