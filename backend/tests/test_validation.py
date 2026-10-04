import asyncio

from sqlalchemy import select

from cco import pipeline
from cco.api import deps
from cco.models import AgentEventRow
from test_pipeline import DEMO, data_dir, release, sm, smart_model  # noqa: F401


def test_validation_exhaustion_is_uncertain_without_dangling_refs(sm, release):
    model = smart_model(quote_override="This sentence does not occur anywhere in the documents.")
    asm_id = asyncio.run(pipeline.run_assessment(release, sm, model=model))
    with sm() as s:
        asm = deps.get_assessment(s, asm_id)
        findings = deps.assessment_findings(s, asm_id)
        events = [r.data for r in s.scalars(select(AgentEventRow).where(AgentEventRow.run_id == asm.run_id))]
    assert asm.status == "completed"
    bad = [f for f in findings if f.conclusion == "uncertain"]
    assert bad, "bad quotes must degrade to uncertain"
    for f in bad:
        assert f.evidence == [] and f.citations == []
        assert any("quote not found" in n for n in f.validation_notes)
        assert f.attempts >= 2
    assert not [f for f in findings if f.conclusion == "potential_violation"]
    assert any(e["type"] == "retry" for e in events)
