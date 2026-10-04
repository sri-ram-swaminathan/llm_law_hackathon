import json
from pathlib import Path

from pydantic_ai.messages import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from cco.agent.evaluator import (
    LIMIT_MESSAGE, TOOL_CALLS_LIMIT, ArtifactDoc, EvidenceBundle, evaluate_requirement,
)
from cco.contracts.domain import Requirement

REPO = Path(__file__).resolve().parents[2]


def _req() -> Requirement:
    fx = json.loads((REPO / "contracts/fixtures/requirements.json").read_text())
    return Requirement.model_validate(next(r for r in fx["requirements"] if r["alias"] == "W1"))


def _bundle(tmp_path, files: list[str]) -> EvidenceBundle:
    for f in files:
        p = tmp_path / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("x = 1\n")
    return EvidenceBundle(root=tmp_path, artifacts=[ArtifactDoc("d", "business_plan", "p.md", "plan")])


async def test_tool_cap_enforced(tmp_path):
    b = _bundle(tmp_path, ["backend/app/config.py"])  # other hinted files absent -> tools offered
    seen_results: list[str] = []
    calls = {"n": 0}

    def fn(messages, info: AgentInfo) -> ModelResponse:
        calls["n"] += 1
        for m in messages:
            for p in getattr(m, "parts", []):
                if getattr(p, "part_kind", "") == "tool-return":
                    seen_results.append(str(p.content))
        return ModelResponse(parts=[ToolCallPart("grep_code", {"fixed_string": "x"})])

    res = await evaluate_requirement(_req(), b, model=FunctionModel(fn))
    assert res.tool_calls == TOOL_CALLS_LIMIT
    assert calls["n"] <= 1 + TOOL_CALLS_LIMIT + 2  # total requests capped
    assert LIMIT_MESSAGE in seen_results
    assert res.candidate.conclusion == "uncertain"


async def test_no_tools_when_bundle_complete(tmp_path):
    req = _req()
    files = [g for g in req.evidence_hints.code_globs if "*" not in g]
    b = _bundle(tmp_path, files)
    offered: list[list[str]] = []

    def fn(messages, info: AgentInfo) -> ModelResponse:
        offered.append([t.name for t in info.function_tools])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "requirement_id": req.id, "conclusion": "uncertain", "title": "t", "reasoning_summary": "r",
            "evidence": [], "citations": [], "confidence": {"applicability": 0.5, "evidence": 0.5, "finding": 0.5},
        })])

    await evaluate_requirement(req, b, model=FunctionModel(fn))
    assert offered and offered[0] == []


def test_doc_cited_as_code_is_normalised(tmp_path):
    from cco.agent.evaluator import validate_candidate
    from cco.contracts.ai import FindingCandidate
    from cco.contracts.domain import DocumentSpanRef

    req = _req()
    guide = "# Guide\n\nWe give personalised recommendations on named instruments.\n"
    b = EvidenceBundle(root=tmp_path, artifacts=[ArtifactDoc("a1", "product_spec", "docs/PRODUCT_GUIDE.md", guide)])
    cand = FindingCandidate.model_validate({
        "requirement_id": req.id, "conclusion": "potential_violation", "title": "t", "reasoning_summary": "r",
        "evidence": [{"type": "code", "artifact_id": "code", "path": "docs/PRODUCT_GUIDE.md", "start_line": 1,
                      "end_line": 1, "quote": "personalised recommendations on named instruments"}],
        "citations": [], "confidence": {"applicability": 0.5, "evidence": 0.5, "finding": 0.5},
    })
    out, errs = validate_candidate(cand, req, b)
    assert not errs and isinstance(out.evidence[0], DocumentSpanRef) and out.evidence[0].artifact_id == "a1"
