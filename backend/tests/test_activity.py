import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from cco.activity import get_recorder, mcp_recorded, set_recorder_sessionmaker
from cco.api import runs as runs_mod
from cco.contracts.activity import AgentEvent
from cco.main import create_app
from cco.seed import seed

H = {"Authorization": "Bearer test-deploy-token"}
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def ev(run, type_="step", dt=0.0, **kw):
    return AgentEvent(run_id=run, seq=0, ts=T0 + timedelta(seconds=dt), type=type_, summary=kw.pop("summary", "s"), **kw)


def frames(resp):
    out = []
    for line in resp.iter_lines():
        if line.startswith("data:"):
            out.append(json.loads(line[5:]))
    return out


def test_record_and_redact():
    with TestClient(create_app("sqlite://")) as c:
        set_recorder_sessionmaker(c.app.state.sessionmaker)
        rec = get_recorder()
        a = rec.record(ev("r1", input_preview="key sk-abcdefghijklmnopqrstuvwxyz123456 x"))
        b = rec.record(ev("r1", output_preview="y" * 5000))
        assert (a.seq, b.seq) == (1, 2)
        assert rec.record(ev("r2")).seq == 1
        assert "sk-abc" not in a.input_preview and "[REDACTED]" in a.input_preview
        assert len(b.output_preview.encode()) <= 2048


def test_sse_replay_then_live(monkeypatch):
    with TestClient(create_app("sqlite://")) as c:
        with c.app.state.sessionmaker() as s:
            seed(s)
            s.commit()
        set_recorder_sessionmaker(c.app.state.sessionmaker)
        rid = c.get("/api/runs", headers=H).json()[0]["run_id"]
        summ = c.get(f"/api/runs/{rid}", headers=H).json()
        assert summ["totals"]["events"] > 100 and summ["status"] == "ok"
        with c.stream("GET", f"/api/runs/{rid}/events", headers=H) as r:
            got = frames(r)
        assert len(got) == summ["totals"]["events"] and got[-1]["type"] == "run_end"
        # live: TestClient buffers bodies, so insert events from the poll-sleep hook (i.e. mid-stream)
        rec = get_recorder()
        rec.record(ev("live1"))
        polls = []

        async def live_sleep(t):
            polls.append(t)
            if len(polls) == 1:
                rec.record(ev("live1", "finding", requirement_id="W1"))
                rec.record(ev("live1", "run_end"))

        monkeypatch.setattr(runs_mod, "_sleep", live_sleep)
        with c.stream("GET", "/api/runs/live1/events", headers=H) as r:
            seen = [d["type"] for d in frames(r)]
        assert seen == ["step", "finding", "run_end"] and polls == [runs_mod.POLL_S]
        with c.stream("GET", "/api/runs/live1/events?requirement_id=W1&after_seq=0", headers=H) as r:
            assert [d["type"] for d in frames(r)] == ["finding"]


def test_replay_pacing(monkeypatch):
    sleeps = []

    async def fake(t):
        sleeps.append(t)

    monkeypatch.setattr(runs_mod, "_sleep", fake)
    with TestClient(create_app("sqlite://")) as c:
        set_recorder_sessionmaker(c.app.state.sessionmaker)
        rec = get_recorder()
        for t, dt in (("step", 0), ("step", 1), ("step", 11), ("run_end", 11.5)):
            rec.record(ev("p1", t, dt))
        with c.stream("GET", "/api/runs/p1/events?replay=1&speed=2", headers=H) as r:
            assert len(frames(r)) == 4
    assert sleeps == [0.5, 1.0, 0.25]  # gaps 1, capped 2 (from 10), 0.5 — divided by speed 2


def test_mcp_decorator():
    with TestClient(create_app("sqlite://")) as c:
        set_recorder_sessionmaker(c.app.state.sessionmaker)

        @mcp_recorded("get_readiness", client=lambda **kw: kw["client"])
        def handler(*, client, token, release="v1"):
            return {"gate": "READY"}

        assert handler(client="cursor", token="SECRETTOKEN123") == {"gate": "READY"}
        runs = c.get("/api/runs", headers=H).json()
        assert len(runs) == 1 and runs[0]["run_kind"] == "mcp"
        with c.stream("GET", f"/api/runs/{runs[0]['run_id']}/events", headers=H) as r:
            got = frames(r)
        assert [d["type"] for d in got] == ["tool_call", "tool_result", "run_end"]
        assert all(d["run_kind"] == "mcp" for d in got)
        blob = json.dumps(got)
        assert "SECRETTOKEN123" not in blob and "cursor" in blob
