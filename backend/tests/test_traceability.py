import asyncio

from cco import legal, pipeline
from cco.api import deps
from cco.contracts import CodeRef, DocumentSpanRef
from test_pipeline import DEMO, data_dir, release, sm, smart_model  # noqa: F401


def test_decisive_findings_are_traceable(sm, release):
    asm_id = asyncio.run(pipeline.run_assessment(release, sm, model=smart_model()))
    with sm() as s:
        findings = deps.assessment_findings(s, asm_id)
        arts = {a.id: a for a in deps.release_artifacts(s, release)}
    decisive = [f for f in findings if f.conclusion in ("potential_violation", "satisfied")]
    assert decisive
    for f in decisive:
        real = [e for e in f.evidence if isinstance(e, (DocumentSpanRef, CodeRef))]
        assert real
        for e in real:
            a = arts[e.artifact_id]
            if isinstance(e, DocumentSpanRef):
                assert e.quote in a.text
            else:
                assert any(cf.path == e.path and e.quote in cf.content for cf in a.files)
        assert f.citations
        for c in f.citations:
            p = legal.get_provision(c)
            assert p is not None and p.source_url
