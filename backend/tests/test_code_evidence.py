"""Code evidence rule (T36): a violation on a code-backed requirement must cite code, via a validation retry."""

import json
from pathlib import Path

from pydantic_ai.messages import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from cco.agent.evaluator import (
    CODE_REF_NOTE,
    OUTPUT_RETRIES,
    ArtifactDoc,
    EvidenceBundle,
    evaluate_requirement,
)
from cco.contracts.domain import CodeRef, Requirement

REPO = Path(__file__).resolve().parents[2]
CONFIG = 'DISCLAIMER = "This is not financial advice. Always consult an advisor."\n'
PLAN = "# Plan\n\nWe give personalised buy, sell and hold recommendations on named instruments.\n"
DOC_EV = {"type": "document_span", "artifact_id": "doc-plan",
          "quote": "personalised buy, sell and hold recommendations"}
CODE_EV = {"type": "code", "artifact_id": "doc-code", "path": "backend/app/config.py",
           "start_line": 1, "end_line": 1, "quote": "This is not financial advice. Always consult an advisor."}


def _req(code_globs: list[str] | None = None) -> Requirement:
    fx = json.loads((REPO / "contracts/fixtures/requirements.json").read_text())
    req = Requirement.model_validate(next(r for r in fx["requirements"] if r["alias"] == "W1"))
    if code_globs is not None:
        req = req.model_copy(update={"evidence_hints": req.evidence_hints.model_copy(
            update={"code_globs": code_globs})})
    return req


def _bundle(tmp_path) -> EvidenceBundle:
    (tmp_path / "backend/app").mkdir(parents=True)
    (tmp_path / "backend/app/config.py").write_text(CONFIG)
    (tmp_path / "compliance").mkdir()
    (tmp_path / "compliance/business-plan.md").write_text(PLAN)
    return EvidenceBundle(
        root=tmp_path,
        artifacts=[ArtifactDoc("doc-plan", "business_plan", "compliance/business-plan.md", PLAN)],
        code_artifact_id="doc-code",
    )


def _args(*evidence):
    return {
        "requirement_id": "FR-CIF-STATUS-01",
        "conclusion": "potential_violation",
        "title": "Wording denies advice",
        "reasoning_summary": "Disclaimer denies advice while the plan describes advice.",
        "evidence": list(evidence),
        "citations": ["mifid2-art4-1-4"],
        "confidence": {"applicability": 0.9, "evidence": 0.8, "finding": 0.8},
    }


def scripted(*steps):
    """Each step is a final_result payload; the last one repeats. Records the retry prompts it received."""
    state = {"i": 0, "retries": []}

    def fn(messages, info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        state["retries"] += [str(p.content) for p in last.parts if type(p).__name__ == "RetryPromptPart"]
        step = steps[min(state["i"], len(steps) - 1)]
        state["i"] += 1
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, step)])

    m = FunctionModel(fn)
    m.state = state  # type: ignore[attr-defined]
    return m


async def test_doc_only_violation_retries_once_and_keeps_the_code_ref(tmp_path):
    model = scripted(_args(DOC_EV), _args(DOC_EV, CODE_EV))
    res = await evaluate_requirement(_req(), _bundle(tmp_path), model=model)
    c = res.candidate
    assert model.state["i"] == 2 and res.attempts == 2
    assert len(model.state["retries"]) == 1
    assert "cite the code lines" in model.state["retries"][0] and "backend/app/config.py" in model.state["retries"][0]
    assert c.conclusion == "potential_violation" and not res.validation_notes
    code = [e for e in c.evidence if isinstance(e, CodeRef)]
    assert code and code[0].path == "backend/app/config.py" and code[0].start_line == 1


async def test_exhausted_retries_keep_the_doc_only_violation_with_a_note(tmp_path):
    model = scripted(_args(DOC_EV))  # never cites code
    res = await evaluate_requirement(_req(), _bundle(tmp_path), model=model)
    c = res.candidate
    assert model.state["i"] == 1 + OUTPUT_RETRIES
    assert c.conclusion == "potential_violation"  # not uncertain
    assert len(c.evidence) == 1 and c.evidence[0].type == "document_span"
    assert res.validation_notes == [CODE_REF_NOTE]


async def test_code_retry_with_broken_quotes_falls_back_to_the_valid_doc_only_answer(tmp_path):
    bad_code = dict(CODE_EV, quote="this line does not exist anywhere in the configuration")
    model = scripted(_args(DOC_EV), _args(DOC_EV, bad_code))
    res = await evaluate_requirement(_req(), _bundle(tmp_path), model=model)
    assert res.candidate.conclusion == "potential_violation"
    assert res.validation_notes == [CODE_REF_NOTE]


async def test_requirement_without_code_hints_accepts_doc_only_evidence(tmp_path):
    model = scripted(_args(DOC_EV))
    res = await evaluate_requirement(_req(code_globs=[]), _bundle(tmp_path), model=model)
    assert model.state["i"] == 1 and res.attempts == 1
    assert res.candidate.conclusion == "potential_violation" and not res.validation_notes


async def test_satisfied_needs_no_code_ref(tmp_path):
    model = scripted(dict(_args(DOC_EV), conclusion="satisfied"))
    res = await evaluate_requirement(_req(), _bundle(tmp_path), model=model)
    assert model.state["i"] == 1 and res.candidate.conclusion == "satisfied" and not res.validation_notes
