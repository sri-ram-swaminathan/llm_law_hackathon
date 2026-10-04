"""Event sink for a run: delegates to T11's recorder, which assigns seq, redacts and caps previews."""

from __future__ import annotations

import itertools
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session, sessionmaker

from ..contracts.activity import AgentEvent
from ..models import AgentEventRow

log = logging.getLogger("cco.pipeline")


class EventSink:
    def __init__(self, sm: sessionmaker[Session], run_id: str, run_kind: str = "assessment") -> None:
        self.sm, self.run_id, self.run_kind = sm, run_id, run_kind
        self.seq = itertools.count(0)  # handed to the evaluator; the recorder assigns the real seq
        try:
            from ..activity import get_recorder, set_recorder_sessionmaker

            set_recorder_sessionmaker(sm)
            self._rec: Any = get_recorder()
        except ImportError:
            log.warning("cco.activity not available; writing agent events directly (run %s)", run_id)
            self._rec = None
            self._n = itertools.count(1)

    def __call__(self, ev: AgentEvent) -> None:
        self._persist(ev)

    def emit(self, type_: str, summary: str, **kw: Any) -> AgentEvent:
        ev = AgentEvent(run_id=self.run_id, run_kind=self.run_kind, seq=0,  # type: ignore[arg-type]
                        ts=datetime.now(timezone.utc), type=type_, summary=summary, **kw)  # type: ignore[arg-type]
        return self._persist(ev)

    def _persist(self, ev: AgentEvent) -> AgentEvent:
        if self._rec is not None:
            return self._rec.record(ev)
        ev = ev.model_copy(update={"seq": next(self._n)})
        with self.sm() as s:
            s.add(AgentEventRow(run_id=ev.run_id, seq=ev.seq, data=ev.model_dump(mode="json")))
            s.commit()
        return ev
