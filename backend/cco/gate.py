"""Deterministic launch gate (SPEC §6.3). Pure functions, no DB access.

Seams for later tasks: `pick_applicable_review` is the single place that decides which review applies
to a finding (own review, else carried by requirement + evidence fingerprint); T14 extends it."""

from __future__ import annotations

import hashlib
import json
from typing import Iterable, Mapping

from .contracts import (
    AI_LABEL,
    Assessment,
    Conclusion,
    Finding,
    FindingView,
    Readiness,
    RegulatoryProfile,
    Release,
    Requirement,
    Review,
)
from .contracts.readiness import ChangesSinceVersion, CounselReviewed, DomainCoverage, GateCounts

GATE_LABELS = {"NOT_READY": "Not ready", "REVIEW_REQUIRED": "Review required", "READY": "Ready"}
READY_AI_LABEL = "Ready (AI)"
_PROBLEMS = {"potential_violation", "insufficient_evidence"}


def effective_conclusion(ai: Conclusion, review: Review | None) -> Conclusion:
    """AI values are immutable; the review only changes what is effective."""
    if review is None or review.revoked_at is not None:
        return ai
    if review.decision == "not_applicable":
        return "not_applicable"
    if review.decision == "override" and review.override_conclusion:
        return review.override_conclusion
    return ai  # confirm, need_evidence


PROFILE_FP_PREFIX = "profile:"


def profile_hash(profile: RegulatoryProfile) -> str:
    """sha256 of the canonical profile JSON, ignoring confirmed_at (re-confirming changes nothing)."""
    d = profile.model_dump(mode="json", exclude={"confirmed_at"})
    return hashlib.sha256(json.dumps(d, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _carries(r: Review, finding: Finding, current_profile_hash: str | None) -> bool:
    if r.requirement_id != finding.requirement_id:
        return False
    if r.decision == "not_applicable":
        # About the product's nature, not specific lines: carry while the profile is unchanged.
        # No stored hash (legacy/fixture review) carries until revoked.
        if not r.evidence_fingerprint.startswith(PROFILE_FP_PREFIX):
            return True
        return r.evidence_fingerprint == PROFILE_FP_PREFIX + (current_profile_hash or "")
    return r.evidence_fingerprint == finding.evidence_fingerprint


def pick_applicable_review(
    finding: Finding,
    reviews: Iterable[Review],
    product_id: str,
    version_by_finding: Mapping[str, str] | None = None,
    current_profile_hash: str | None = None,
) -> tuple[Review | None, str | None]:
    """Latest non-revoked review on this finding; else the latest non-revoked review for the same
    product and requirement that carries (confirm/override: equal evidence fingerprint; not_applicable:
    unchanged profile hash). Returns (review, carried_from)."""
    live = [r for r in reviews if r.revoked_at is None and r.product_id == product_id]
    own = [r for r in live if r.finding_id == finding.id]
    if own:
        return max(own, key=lambda r: r.created_at), None
    carried = [r for r in live if _carries(r, finding, current_profile_hash)]
    if carried:
        r = max(carried, key=lambda r: r.created_at)
        return r, (version_by_finding or {}).get(r.finding_id)
    return None, None


def build_views(
    findings: Iterable[Finding],
    reviews: list[Review],
    product_id: str,
    version_by_finding: Mapping[str, str] | None = None,
    current_profile_hash: str | None = None,
) -> list[FindingView]:
    out = []
    for f in findings:
        rev, carried = pick_applicable_review(f, reviews, product_id, version_by_finding, current_profile_hash)
        out.append(
            FindingView(
                **f.model_dump(),
                applicable_review=rev,
                carried_from_version=carried,
                effective_conclusion=effective_conclusion(f.conclusion, rev),
            )
        )
    return out


def resolve_previous_release(release: Release, product_releases: Iterable[Release]) -> Release | None:
    """Baseline for changes_since_previous: the latest earlier release of the same product (so 1.0.0 is
    compared with the rc, AC7); falls back to the declared previous_release_id."""
    earlier = [
        r
        for r in product_releases
        if r.product_id == release.product_id and r.id != release.id and r.created_at < release.created_at
    ]
    if earlier:
        return max(earlier, key=lambda r: (r.created_at, r.id))
    return next((r for r in product_releases if r.id == release.previous_release_id), None)


def compute_changes(
    current: list[FindingView], previous: list[FindingView] | None
) -> ChangesSinceVersion:
    if previous is None:
        return ChangesSinceVersion()
    prev = {f.requirement_id: f.effective_conclusion for f in previous}
    ch = ChangesSinceVersion()
    for f in current:
        was = prev.get(f.requirement_id)
        now_bad = f.effective_conclusion in _PROBLEMS
        if now_bad and was not in _PROBLEMS:
            ch.new.append(f.requirement_id)
        elif was in _PROBLEMS and not now_bad:
            ch.resolved.append(f.requirement_id)
        else:
            ch.unchanged.append(f.requirement_id)
    # keep fixture ordering: resolved first in previous order
    order = {f.requirement_id: i for i, f in enumerate(previous)}
    ch.resolved.sort(key=lambda r: order.get(r, 0))
    return ch


def compute_readiness(
    release: Release,
    assessment: Assessment,
    views: list[FindingView],
    requirements: Mapping[str, Requirement],
    previous_views: list[FindingView] | None = None,
) -> Readiness:
    c = GateCounts(requirements_total=len(views))
    blockers: list[str] = []
    review_required = False
    domains: dict[str, DomainCoverage] = {}
    reviewed = 0

    for f in views:
        eff = f.effective_conclusion
        req = requirements.get(f.requirement_id)
        mandatory = bool(req and req.mandatory)
        domain = req.domain if req else "unknown"
        cov = domains.setdefault(domain, DomainCoverage(domain=domain, total=0))
        cov.total += 1
        setattr(cov, eff, getattr(cov, eff) + 1)
        if f.applicable_review is not None:
            reviewed += 1
        if f.attempts > 0:
            c.requirements_evaluated += 1

        if eff == "potential_violation":
            if f.severity == "blocker":
                c.blockers += 1
                blockers.append(f.requirement_id)
            elif f.severity == "high":
                c.high += 1
                review_required = True
            elif f.severity == "medium":
                c.medium += 1
            else:
                c.low += 1
        elif eff == "insufficient_evidence" and mandatory:
            c.missing_evidence += 1
            blockers.append(f.requirement_id)
        elif eff == "uncertain" and f.applicable_review is None:
            c.uncertain_unreviewed += 1
            review_required = True

    if c.blockers or c.missing_evidence:
        gate = "NOT_READY"
    elif review_required:
        gate = "REVIEW_REQUIRED"
    else:
        gate = "READY"

    label = READY_AI_LABEL if gate == "READY" and reviewed == 0 else GATE_LABELS[gate]
    total = len(views)
    return Readiness(
        release_id=release.id,
        assessment_id=assessment.id,
        version=release.version,
        gate=gate,
        gate_label=label,
        labels=[AI_LABEL, f"counsel-reviewed {reviewed}/{total}"],
        counts=c,
        counsel_reviewed=CounselReviewed(reviewed=reviewed, total=total),
        coverage=list(domains.values()),
        previous_release_id=release.previous_release_id,
        changes_since_previous=compute_changes(views, previous_views),
        blockers=blockers,
    )
