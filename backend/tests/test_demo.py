"""Demo endpoints (CCO_DEMO=1): reset restores the snapshot, start runs a live 0.9.0 assessment. Scripted model."""

import re

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.messages import ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from cco import pipeline
from cco.main import create_app

H = {"Authorization": "Bearer test-deploy-token"}


def scripted() -> FunctionModel:
    def fn(messages, info: AgentInfo) -> ModelResponse:
        p = "\n".join(x.content for m in messages for x in m.parts if isinstance(x, UserPromptPart))
        rid = re.search(r"REQUIREMENT (\S+):", p).group(1)
        cite = re.search(r"Legal basis ids you may cite: ([^\n]+)", p).group(1).split(", ")[0]
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "requirement_id": rid, "citations": [cite], "title": "t", "reasoning_summary": "r",
            "confidence": {"applicability": 0.9, "evidence": 0.8, "finding": 0.8},
            "conclusion": "uncertain", "evidence": []})])

    return FunctionModel(fn)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setattr(pipeline.runner, "MODEL_OVERRIDE", scripted())
    pipeline.runner._locks.clear()
    with TestClient(create_app(f"sqlite:///{tmp_path}/db.sqlite")) as c:
        yield c
    pipeline.runner._locks.clear()


def test_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("CCO_DEMO", raising=False)
    assert client.get("/api/demo", headers=H).json() == {"enabled": False}
    assert client.post("/api/demo/reset", headers=H).status_code == 404
    assert client.post("/api/demo/start", headers=H).status_code == 404


def test_reset_and_start(client, monkeypatch):
    monkeypatch.setenv("CCO_DEMO", "1")
    st = client.get("/api/demo", headers=H).json()
    assert st["enabled"] and st["manifest"]["releases"][0]["ref"] == "v0.9.0"

    r = client.post("/api/demo/reset", headers=H)
    assert r.status_code == 200 and r.json()["releases"] == ["0.9.0", "1.0.0-rc.12", "1.0.0"]
    assert client.get("/api/releases/rel-1.0.0/readiness", headers=H).json()["gate"] == "READY"

    r = client.post("/api/demo/start", headers=H)  # TestClient runs the background run before returning
    assert r.status_code == 202, r.text
    body = r.json()
    commit = st["manifest"]["releases"][0]["commit"]
    assert body["release"]["git_sha"] == commit and body["release"]["branch"] == "v0.9.0"
    assert body["release"]["ci_run_url"] is None and body["provenance"]["commit"] == commit
    asm = client.get(f"/api/assessments/{body['assessment_id']}", headers=H).json()
    assert asm["status"] == "completed" and asm["run_id"] == body["run_id"]
    versions = {x["release"]["version"] for x in client.get("/api/releases", headers=H).json()}
    assert versions == {"0.9.0", "1.0.0-rc.12", "1.0.0"}


def test_409_while_running(client, monkeypatch):
    monkeypatch.setenv("CCO_DEMO", "1")
    pipeline.runner._locks["wealthpilot"] = "run-busy"
    assert client.post("/api/demo/start", headers=H).status_code == 409
    assert client.post("/api/demo/reset", headers=H).status_code == 409
