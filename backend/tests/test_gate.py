import json

from cco.contracts import Readiness, ReleaseFixture, Requirement, RequirementsFixture
from cco.gate import build_views, compute_readiness, effective_conclusion


def _load(fixtures_dir, name):
    return ReleaseFixture.model_validate_json((fixtures_dir / name).read_text())


def _reqs(fixtures_dir):
    pack = RequirementsFixture.model_validate_json((fixtures_dir / "requirements.json").read_text())
    return {r.id: r for r in pack.requirements}


def _findings(fx):
    from cco.contracts import Finding

    return [Finding.model_validate(v.model_dump(include=set(Finding.model_fields))) for v in fx.findings]


def test_v090_not_ready(fixtures_dir):
    fx = _load(fixtures_dir, "release-0.9.0.json")
    views = build_views(_findings(fx), [], "wealthpilot")
    r = compute_readiness(fx.release, fx.assessment, views, _reqs(fixtures_dir))
    assert r.gate == "NOT_READY"
    assert r.model_dump(mode="json") == fx.readiness.model_dump(mode="json")


def test_fixtures_match_with_carry_forward(fixtures_dir):
    f09 = _load(fixtures_dir, "release-0.9.0.json")
    reviews = _load(fixtures_dir, "release-1.0.0.json").reviews
    versions = {f.id: "0.9.0" for f in f09.findings}
    prev = build_views(_findings(f09), reviews, "wealthpilot", versions)
    for name in ("release-1.0.0-rc.json", "release-1.0.0.json"):
        fx = _load(fixtures_dir, name)
        views = build_views(_findings(fx), reviews, "wealthpilot", versions)
        r = compute_readiness(fx.release, fx.assessment, views, _reqs(fixtures_dir), prev)
        assert r.model_dump(mode="json") == fx.readiness.model_dump(mode="json"), name
        w8 = next(v for v in views if v.requirement_id == "AI-TRANSPARENCY-01")
        assert w8.carried_from_version == "0.9.0" and w8.effective_conclusion == "not_applicable"
        assert w8.conclusion == "uncertain"  # AI value untouched


def test_v100_ready_labels(fixtures_dir):
    fx = _load(fixtures_dir, "release-1.0.0.json")
    reviews = fx.reviews
    versions = {"f-0.9.0-W8": "0.9.0"}
    r = compute_readiness(fx.release, fx.assessment, build_views(_findings(fx), reviews, "wealthpilot", versions), _reqs(fixtures_dir))
    assert (r.gate, r.gate_label, r.labels[1]) == ("READY", "Ready", "counsel-reviewed 1/10")
    assert r.labels[0] == "AI pre-assessment, not legal advice"


def test_ready_ai_when_no_reviews(fixtures_dir):
    fx = _load(fixtures_dir, "release-1.0.0.json")
    r = compute_readiness(fx.release, fx.assessment, build_views(_findings(fx), [], "wealthpilot"), _reqs(fixtures_dir))
    # the unreviewed uncertain W8 keeps it at REVIEW_REQUIRED; make it reviewed-free READY by dropping it
    assert r.gate == "REVIEW_REQUIRED"
    views = [v for v in build_views(_findings(fx), [], "wealthpilot") if v.requirement_id != "AI-TRANSPARENCY-01"]
    r2 = compute_readiness(fx.release, fx.assessment, views, _reqs(fixtures_dir))
    assert (r2.gate, r2.gate_label) == ("READY", "Ready (AI)")


def test_effective_conclusion(fixtures_dir):
    fx = _load(fixtures_dir, "release-1.0.0.json")
    rev = fx.reviews[0]
    assert effective_conclusion("uncertain", rev) == "not_applicable"
    assert effective_conclusion("uncertain", rev.model_copy(update={"decision": "confirm"})) == "uncertain"
    assert effective_conclusion("uncertain", rev.model_copy(update={"decision": "override", "override_conclusion": "satisfied"})) == "satisfied"
    assert effective_conclusion("uncertain", rev.model_copy(update={"revoked_at": rev.created_at})) == "uncertain"
