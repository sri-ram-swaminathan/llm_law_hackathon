import json
from pathlib import Path

import pytest
from pydantic_ai.messages import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from cco.agent.bundle_tools import BundleError
from cco.agent.evaluator import ArtifactDoc, EvidenceBundle, build_prompt, evaluate_requirement
from cco.contracts.domain import Requirement

REPO = Path(__file__).resolve().parents[2]
CONFIG = (
    'DISCLAIMER = (\n    "Wealthpilot provides information only. "\n'
    '    "This is not financial advice. Always consult an advisor."\n)\n'
)
PLAN = "# Plan\n\nWe give personalised buy, sell and hold recommendations on named instruments.\n"


def _req() -> Requirement:
    fx = json.loads((REPO / "contracts/fixtures/requirements.json").read_text())
    return Requirement.model_validate(next(r for r in fx["requirements"] if r["alias"] == "W1"))


@pytest.fixture
def bundle(tmp_path) -> EvidenceBundle:
    (tmp_path / "backend/app").mkdir(parents=True)
    (tmp_path / "backend/app/config.py").write_text(CONFIG)
    (tmp_path / ".env").write_text("SECRET=1")
    (tmp_path / "compliance").mkdir()
    (tmp_path / "compliance/business-plan.md").write_text(PLAN)
    return EvidenceBundle(
        root=tmp_path,
        artifacts=[ArtifactDoc("doc-plan", "business_plan", "compliance/business-plan.md", PLAN)],
        code_artifact_id="doc-code",
    )


def _args(quote="This is not financial advice. Always consult an advisor.", **kw):
    a = {
        "requirement_id": "FR-CIF-STATUS-01",
        "conclusion": "potential_violation",
        "title": "Wording denies advice",
        "reasoning_summary": "Disclaimer denies advice while the plan describes advice.",
        "evidence": [
            {"type": "code", "artifact_id": "doc-code", "path": "backend/app/config.py",
             "start_line": 1, "end_line": 1, "quote": quote},
            {"type": "document_span", "artifact_id": "doc-plan",
             "quote": "personalised buy, sell and hold recommendations"},
        ],
        "citations": ["mifid2-art4-1-4"],
        "confidence": {"applicability": 0.9, "evidence": 0.8, "finding": 0.8},
    }
    a.update(kw)
    return a


def scripted(*steps):
    """steps: dicts (final_result args) or ('tool', name, args). Repeats the last step when exhausted."""
    state = {"i": 0}

    def fn(messages, info: AgentInfo) -> ModelResponse:
        step = steps[min(state["i"], len(steps) - 1)]
        state["i"] += 1
        if isinstance(step, tuple):
            return ModelResponse(parts=[ToolCallPart(step[1], step[2])])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, step)])

    return FunctionModel(fn)


async def test_ok_first_try_locates_quotes(bundle):
    res = await evaluate_requirement(_req(), bundle, model=scripted(_args()))
    c = res.candidate
    assert c.conclusion == "potential_violation" and not res.validation_notes
    code = c.evidence[0]
    assert code.quote.startswith("This is not financial advice") and (code.start_line, code.end_line) == (3, 3)
    doc = c.evidence[1]
    assert PLAN[doc.start : doc.end] == doc.quote


async def test_split_literal_quote_is_accepted(bundle):
    q = "provides information only. This is not financial advice."
    res = await evaluate_requirement(_req(), bundle, model=scripted(_args(quote=q)))
    assert res.candidate.conclusion == "potential_violation"
    assert (res.candidate.evidence[0].start_line, res.candidate.evidence[0].end_line) == (2, 3)


async def test_bad_quote_retry_then_ok(bundle):
    res = await evaluate_requirement(
        _req(), bundle, model=scripted(_args(quote="We are fully licensed advisers."), _args())
    )
    assert res.candidate.conclusion == "potential_violation"
    assert res.attempts == 2


async def test_three_bad_answers_give_uncertain(bundle):
    res = await evaluate_requirement(_req(), bundle, model=scripted(_args(quote="Totally invented sentence here.")))
    assert res.candidate.conclusion == "uncertain"
    assert res.candidate.evidence == []
    assert any("quote not found" in n for n in res.validation_notes)


@pytest.mark.parametrize(
    "bad,needle",
    [
        ({"citations": ["not-in-derived-from"]}, "citations"),
        ({"requirement_id": "OTHER"}, "requirement_id"),
        ({"conclusion": "insufficient_evidence"}, "missing"),
    ],
)
async def test_validation_rules(bundle, bad, needle):
    res = await evaluate_requirement(_req(), bundle, model=scripted(_args(**bad)))
    assert res.candidate.conclusion == "uncertain"
    assert any(needle in n for n in res.validation_notes)


async def test_unknown_artifact_and_non_missing(bundle):
    a = _args()
    a["evidence"][1]["artifact_id"] = "nope"
    res = await evaluate_requirement(_req(), bundle, model=scripted(a))
    assert any("unknown artifact_id" in n for n in res.validation_notes)
    a = _args(conclusion="insufficient_evidence", evidence=[{"type": "missing", "artifact_kind": "business_plan"}])
    res = await evaluate_requirement(_req(), bundle, model=scripted(a))
    assert any("not missing" in n for n in res.validation_notes)


async def test_tool_limit_gives_uncertain(bundle):
    res = await evaluate_requirement(
        _req(), bundle, model=scripted(("tool", "grep_code", {"fixed_string": "advice"}))
    )
    assert res.candidate.conclusion == "uncertain"
    assert any("tool-call limit" in n for n in res.validation_notes)
    assert res.tool_calls == 6


async def test_tool_then_answer(bundle):
    res = await evaluate_requirement(
        _req(), bundle, model=scripted(("tool", "read_file", {"path": "backend/app/config.py"}), _args())
    )
    assert res.candidate.conclusion == "potential_violation" and res.tool_calls == 1


async def test_events_emitted(bundle):
    events = []
    await evaluate_requirement(
        _req(),
        bundle,
        model=scripted(("tool", "grep_code", {"fixed_string": "advice"}), _args(quote="invented text here ok"), _args()),
        on_event=events.append,
        run_id="r1",
    )
    types = [e.type for e in events]
    for t in ("model_request", "model_response", "tool_call", "tool_result", "retry", "finding"):
        assert t in types, t
    assert types[-1] == "finding"
    assert [e.seq for e in events] == list(range(1, len(events) + 1))
    assert all(e.run_id == "r1" and e.requirement_id == "FR-CIF-STATUS-01" for e in events)
    retry = next(e for e in events if e.type == "retry")
    assert "quote not found" in retry.error


def test_tools_confined_to_bundle(bundle):
    for bad in ("../outside.txt", "/etc/passwd", ".env"):
        with pytest.raises(BundleError):
            bundle.read_file(bad)
    assert "SECRET" not in bundle.grep_code("SECRET")
    assert "mifid2-art4-1-4" in bundle.get_provision("mifid2-art4-1-4")


def test_prompt_wraps_evidence_and_flags_injection_rule(bundle):
    p = build_prompt(_req(), bundle)
    assert "<<<EVIDENCE_BLOCK" in p and "<<<END_EVIDENCE_BLOCK>>>" in p
    assert 'path="backend/app/config.py"' in p
    assert "ABSENT DOCUMENT KINDS" in p  # product_spec / terms / regulatory_registration absent
