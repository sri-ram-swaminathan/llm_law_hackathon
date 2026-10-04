import json

import pytest
from fastapi.testclient import TestClient

from cco.main import create_app
from cco.seed import seed

H = {"Authorization": "Bearer test-mcp-token", "Accept": "application/json, text/event-stream",
     "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18"}


@pytest.fixture()
def client():
    app = create_app("sqlite://")
    with TestClient(app) as c:
        with app.state.sessionmaker() as s:
            seed(s)
            s.commit()
        yield c


def rpc(c, method, params=None, headers=H):
    return c.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}})


def call(c, name, args=None):
    r = rpc(c, "tools/call", {"name": name, "arguments": args or {}})
    assert r.status_code == 200, r.text
    res = r.json()["result"]
    assert not res.get("isError"), res
    return res


def test_tools_listed_and_auth(client):
    r = rpc(client, "tools/list")
    assert r.status_code == 200, r.text
    names = sorted(t["name"] for t in r.json()["result"]["tools"])
    assert names == ["get_finding", "get_release_readiness", "get_remediation_plan", "list_findings"]
    assert rpc(client, "tools/list", headers={**H, "Authorization": "Bearer nope"}).status_code == 401
    assert rpc(client, "tools/list", headers={k: v for k, v in H.items() if k != "Authorization"}).status_code == 401


def test_list_findings_blockers(client):
    res = call(client, "list_findings", {"version": "0.9.0", "severity": "blocker"})
    items = res["structuredContent"]["result"]
    assert sorted(i["requirement_id"] for i in items) == ["FR-CIF-STATUS-01", "FR-SUITABILITY-01"]


def test_readiness_and_finding(client):
    r = json.loads(call(client, "get_release_readiness", {"version": "0.9.0"})["content"][0]["text"])
    assert r["gate"] == "NOT_READY"
    f = json.loads(call(client, "get_finding", {"id": "f-0.9.0-W1"})["content"][0]["text"])
    assert f["requirement_id"] == "FR-CIF-STATUS-01"


def test_plan_equals_rest(client):
    rid = client.get("/api/releases", headers={"Authorization": "Bearer test-deploy-token"}).json()
    asm = next(r for r in rid if r["release"]["version"] == "0.9.0")["latest_assessment"]["id"]
    rest = client.get(f"/api/assessments/{asm}/fix-plan.md", headers={"Authorization": "Bearer test-deploy-token"})
    plan = call(client, "get_remediation_plan", {"version": "0.9.0"})["content"][0]["text"]
    assert plan.encode() == rest.content


def test_calls_recorded_as_mcp(client):
    call(client, "get_release_readiness", {"version": "0.9.0"})
    from sqlalchemy import select

    from cco.models import AgentEventRow

    with client.app.state.sessionmaker() as s:
        rows = s.scalars(select(AgentEventRow)).all()
    assert any((r.data.get("run_kind") == "mcp" and r.data.get("tool") == "get_release_readiness") for r in rows)
