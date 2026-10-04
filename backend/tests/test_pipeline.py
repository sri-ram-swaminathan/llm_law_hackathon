import asyncio
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.messages import ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import AgentInfo, FunctionModel
from sqlalchemy import select

from cco import pipeline
from cco.api import deps
from cco.contracts import Finding
from cco.db import init_db, make_engine, make_sessionmaker
from cco.ingest import ingest_bundle
from cco.main import create_app
from cco.models import AgentEventRow, AssessmentRow, FindingRow

H = {"Authorization": "Bearer test-deploy-token"}
DEMO = Path(__file__).resolve().parents[2] / "demo" / "wealthpilot" / "v0.9.0" / "upload"


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(pipeline.runner, "MODEL_OVERRIDE", None)
    pipeline.runner._locks.clear()
    return tmp_path


def prompt_of(messages) -> str:
    return "\n".join(p.content for m in messages for p in m.parts if isinstance(p, UserPromptPart))


def smart_model(calls: list | None = None, quote_override: str | None = None) -> FunctionModel:
    """Answers from the prompt: quote the first evidence line if a document exists, else report it missing."""

    def fn(messages, info: AgentInfo) -> ModelResponse:
        p = prompt_of(messages)
        rid = re.search(r"REQUIREMENT (\S+):", p).group(1)
        if calls is not None:
            calls.append(rid)
        cite = re.search(r"Legal basis ids you may cite: ([^\n]+)", p).group(1).split(", ")[0]
        base = {"requirement_id": rid, "citations": [cite], "title": "t", "reasoning_summary": "r",
                "confidence": {"applicability": 0.9, "evidence": 0.8, "finding": 0.8}}
        m = re.search(r'<<<EVIDENCE_BLOCK type="document" artifact_id="([^"]+)"[^>]*>>>\n(.*?)\n<<<END', p, re.S)
        if m:
            line = next(ln for ln in m.group(2).splitlines() if len(ln.strip()) > 20).strip()
            base.update(conclusion="potential_violation", evidence=[
                {"type": "document_span", "artifact_id": m.group(1), "quote": quote_override or line}])
        else:
            kind = re.search(r"ABSENT DOCUMENT KINDS[^:]*: (\w+)", p)
            if kind:
                base.update(conclusion="insufficient_evidence", evidence=[{"type": "missing", "artifact_kind": kind.group(1)}])
            else:
                base.update(conclusion="uncertain", evidence=[])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, base)])

    return FunctionModel(fn)


@pytest.fixture
def sm():
    engine = make_engine("sqlite://")
    init_db(engine)
    return make_sessionmaker(engine)


@pytest.fixture
def release(sm):
    with sm() as s:
        pipeline.ensure_base(s)
        rel, _ = ingest_bundle(s, DEMO, "0.9.0")
        s.commit()
    return rel.id


def test_full_run_scripted(sm, release):
    calls: list[str] = []
    asm_id = asyncio.run(pipeline.run_assessment(release, sm, model=smart_model(calls)))
    with sm() as s:
        asm = deps.get_assessment(s, asm_id)
        findings = deps.assessment_findings(s, asm_id)
        reqs = deps.load_requirements(s)
        events = [r.data for r in s.scalars(select(AgentEventRow).where(AgentEventRow.run_id == asm.run_id))]
        readiness = deps.release_readiness(s, release)
    assert asm.status == "completed" and len(findings) == len(reqs)
    na = [f for f in findings if f.conclusion == "not_applicable"]
    assert set(calls).isdisjoint({f.requirement_id for f in na}), "no model call for out-of-scope"
    assert len(set(calls)) == len(findings) - len(na)  # code-evidence retries (T36) may call a requirement more than once
    for f in findings:
        assert f.severity == reqs[f.requirement_id].severity
        assert len(f.evidence_fingerprint) == 64
    types = {e["type"] for e in events}
    assert {"step", "scope", "model_request", "finding", "gate", "run_end"} <= types
    seqs = sorted(e["seq"] for e in events)
    assert seqs == list(range(1, len(seqs) + 1))
    assert readiness.gate in ("NOT_READY", "REVIEW_REQUIRED", "READY")
    assert pipeline.lock_holder("wealthpilot") is None


def test_lock_and_queue(sm, release):
    prep = pipeline.prepare_run(sm, release)
    with pytest.raises(pipeline.RunInFlight):
        pipeline.prepare_run(sm, release)
    asyncio.run(pipeline.execute_run(sm, prep, smart_model()))  # releases the lock
    assert pipeline.lock_holder("wealthpilot") is None
    pipeline.prepare_run(sm, release)  # lock free again

    # the global model queue never exceeds its limit
    pipeline.runner._locks.clear()
    state = {"cur": 0, "max": 0}
    inner = smart_model()

    async def fn(messages, info):
        state["cur"] += 1
        state["max"] = max(state["max"], state["cur"])
        await asyncio.sleep(0.02)
        state["cur"] -= 1
        return await inner.function(messages, info) if asyncio.iscoroutinefunction(inner.function) else inner.function(messages, info)

    asyncio.run(pipeline.run_assessment(release, sm, model=FunctionModel(fn)))
    assert 1 <= state["max"] <= pipeline.runner.MODEL_CONCURRENCY


def test_endpoint(release, monkeypatch):
    monkeypatch.setattr(pipeline.runner, "MODEL_OVERRIDE", smart_model())
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            pipeline.ensure_base(s)
            ingest_bundle(s, DEMO, "0.9.0")
            s.commit()
        assert c.post("/api/releases/nope/assessments", headers=H).status_code == 404
        pipeline.runner._locks["wealthpilot"] = "run-x"
        assert c.post("/api/releases/rel-0.9.0/assessments", headers=H).status_code == 409
        pipeline.runner._locks.clear()
        r = c.post("/api/releases/rel-0.9.0/assessments", headers=H)
        assert r.status_code == 202
        body = r.json()
        assert body["assessment_id"] and body["run_id"]
        got = c.get(f"/api/assessments/{body['assessment_id']}", headers=H).json()
        assert got["status"] == "completed" and got["run_id"] == body["run_id"]
