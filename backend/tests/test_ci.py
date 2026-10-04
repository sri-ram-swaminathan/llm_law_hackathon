import json
import re
from pathlib import Path

import pytest
import yaml
from pydantic_ai.messages import ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import AgentInfo, FunctionModel
from sqlalchemy import select
from typer.testing import CliRunner

from cco import gate, pipeline
from cco.cli import main
from cco.cli.ci import render_comment
from cco.contracts import CiResult, Finding, ReleaseFixture, RequirementsFixture
from cco.contracts.ci import COMMENT_MARKER
from cco.models import ReleaseRow

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "demo" / "wealthpilot"
FIX = ROOT / "contracts" / "fixtures"
runner = CliRunner()


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.runner, "MODEL_OVERRIDE", None)
    pipeline.runner._locks.clear()


def scripted() -> FunctionModel:
    """Missing documents -> insufficient_evidence; everything else uncertain (no network)."""

    def fn(messages, info: AgentInfo) -> ModelResponse:
        p = "\n".join(x.content for m in messages for x in m.parts if isinstance(x, UserPromptPart))
        rid = re.search(r"REQUIREMENT (\S+):", p).group(1)
        cite = re.search(r"Legal basis ids you may cite: ([^\n]+)", p).group(1).split(", ")[0]
        base = {"requirement_id": rid, "citations": [cite], "title": "t", "reasoning_summary": "r",
                "confidence": {"applicability": 0.9, "evidence": 0.8, "finding": 0.8}}
        kind = re.search(r"ABSENT DOCUMENT KINDS[^:]*: (\w+)", p)
        if kind:
            base.update(conclusion="insufficient_evidence", evidence=[{"type": "missing", "artifact_kind": kind.group(1)}])
        else:
            base.update(conclusion="uncertain", evidence=[])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, base)])

    return FunctionModel(fn)


def audit(tmp_path, bundle: str, model, name="out") -> tuple[int, Path]:
    pipeline.runner.MODEL_OVERRIDE = model
    out = tmp_path / name
    r = runner.invoke(main, ["audit", "--bundle", str(DEMO / bundle / "upload"), "--version", "0.9.0",
                             "--sha", "a1b2c3d4e5", "--out", str(out)])
    return r.exit_code, out


def test_exit_codes(tmp_path):
    code, out = audit(tmp_path, "v0.9.0", scripted())  # mandatory privacy notice absent -> NOT_READY
    assert code == 1
    res = CiResult.model_validate_json((out / "result.json").read_text())
    assert res.status == "ok" and res.exit_code == 1 and res.readiness.gate == "NOT_READY"
    assert (out / "comment.md").read_text().startswith(COMMENT_MARKER)
    assert (out / "fix-plan.md").read_text().strip()

    def uncertain(messages, info: AgentInfo) -> ModelResponse:
        p = "\n".join(x.content for m in messages for x in m.parts if isinstance(x, UserPromptPart))
        rid = re.search(r"REQUIREMENT (\S+):", p).group(1)
        cite = re.search(r"Legal basis ids you may cite: ([^\n]+)", p).group(1).split(", ")[0]
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "requirement_id": rid, "citations": [cite], "title": "t", "reasoning_summary": "r", "evidence": [],
            "conclusion": "uncertain", "confidence": {"applicability": 0.9, "evidence": 0.8, "finding": 0.8}})])

    code, out = audit(tmp_path, "v1.0.0", FunctionModel(uncertain), "out-ok")  # REVIEW_REQUIRED -> 0
    assert code == 0
    assert json.loads((out / "result.json").read_text())["readiness"]["gate"] == "REVIEW_REQUIRED"

    def down(messages, info):
        raise ConnectionError("mistral unavailable")

    code, out = audit(tmp_path, "v0.9.0", FunctionModel(down), "out-err")  # engine error, never NOT_READY
    assert code == 2
    res = CiResult.model_validate_json((out / "result.json").read_text())
    assert res.status == "engine_error" and "could not run" in (out / "comment.md").read_text()


def _rc_views():
    reqs = {r.id: r for r in RequirementsFixture.model_validate_json((FIX / "requirements.json").read_text()).requirements}
    rc = ReleaseFixture.model_validate_json((FIX / "release-1.0.0-rc.json").read_text())
    v09 = ReleaseFixture.model_validate_json((FIX / "release-0.9.0.json").read_text())
    pid = rc.release.product_id
    bare = lambda fs: [Finding.model_validate(f.model_dump(include=set(Finding.model_fields))) for f in fs]  # noqa: E731
    views = gate.build_views(bare(rc.findings), rc.reviews, pid)
    prev = gate.build_views(bare(v09.findings), v09.reviews, pid)
    ready = gate.compute_readiness(rc.release, rc.assessment, views, reqs, prev)
    return rc, reqs, views, ready


def test_comment_snapshot():
    exp = yaml.safe_load((DEMO / "expected.yaml").read_text())["releases"]["rc"]
    rc, reqs, views, ready = _rc_views()
    by_req = {v.requirement_id: v for v in views}

    def loc(rid):
        e = next(e for e in by_req[rid].evidence if e.type == "code")
        return f"{e.path}:{e.start_line}"

    c, ch = exp["counts"], exp["changes_since_previous"]
    blockers = ready.blockers
    assert len(blockers) == c["blockers"]
    lines = [
        "<!-- ccommit-check -->",
        f"CCOmmit compliance check · {exp['version']} (a1b2c3d) · ❌ NOT READY · AI pre-assessment, not legal advice",
        f"{c['blockers']} blockers · {c['missing_evidence']} missing evidence · {c['high']} high · "
        f"{c['requirements_total']} requirements evaluated · counsel-reviewed {exp['counsel_reviewed'].replace('/', '/')}",
    ]
    for rid in blockers:
        lines.append(f"🔴 {reqs[rid].alias} {reqs[rid].title}      {loc(rid)}")
    lines += [f"Changes since 0.9.0: {len(ch['resolved'])} resolved · {len(ch['new'])} new",
              "→ Fix plan: see artifact ccommit-result/fix-plan.md"]
    snapshot = "\n".join(lines) + "\n"
    got = render_comment(ready, views, reqs, sha=rc.release.git_sha, baseline_version="0.9.0")
    assert got == snapshot
    assert ready.changes_since_previous.resolved == ch["resolved"]


def test_import_roundtrip(tmp_path, monkeypatch):
    code, out = audit(tmp_path, "v0.9.0", scripted())
    assert code == 1
    db = tmp_path / "app.db"
    monkeypatch.setenv("CCO_DATABASE_URL", f"sqlite:///{db}")
    r = runner.invoke(main, ["import", str(out / "result.json")])
    assert r.exit_code == 0, r.output
    from cco.db import make_engine, make_sessionmaker

    with make_sessionmaker(make_engine(f"sqlite:///{db}"))() as s:
        rel = s.scalars(select(ReleaseRow)).one()
        assert rel.data["source"] == "ci"
    assert runner.invoke(main, ["import", str(out / "result.json")]).exit_code != 0  # duplicate
    r = runner.invoke(main, ["export-baseline", "0.9.0"])
    assert r.exit_code == 0 and json.loads(r.output)["version"] == "0.9.0"
