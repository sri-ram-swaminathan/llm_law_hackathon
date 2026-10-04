---
id: T23
title: Stable carry-forward for not-applicable decisions (profile-scoped)
kind: work                  # work | verify | gate
deps: [T14, T16]
owns: [backend/cco/api/deps.py, backend/cco/gate.py, backend/cco/reviews/**, backend/cco/api/reviews.py, backend/cco/cli/ci.py, backend/tests/test_review.py, backend/tests/test_carry_profile.py]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:uv]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_review.py tests/test_carry_profile.py tests/test_ci.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
---

# T23 — Stable carry-forward for not-applicable decisions (profile-scoped)

## Goal

Counsel's "not applicable" decision on W8 (AI Act Art. 50) carries across releases reliably, so the v1.0.0 CI run can go green without a re-review.

## Context

`evidence/T18.md` shows the problem: the evidence fingerprint is built from the model's quotes, which vary between runs (96921a50 vs 6c05d153). Carry-forward by fingerprint therefore fails at random.

A **not_applicable** decision is about the *product's nature*, not specific lines, so it should carry while the product profile is unchanged. **confirm** and **override** decisions keep the evidence fingerprint rule (SPEC §6.3 and D5, refined).

## Definition of done

- [ ] `gate.pick_applicable_review` handles not_applicable decisions:
  - It carries a review for the same product and `requirement_id` while the current profile hash equals the hash stored on the review.
  - If no hash is stored (legacy/fixture reviews), it carries unconditionally until revoked.
  - It sets `carried_from_version`.
  - · `test_carry_profile.py::test_not_applicable_carries_across_runs` and `::test_profile_change_breaks_carry`
- [ ] New reviews store the profile hash: `api/reviews.py` (or `reviews/**`) puts `profile_hash` in the review data. · `test_carry_profile.py::test_profile_hash_stored`
- [ ] `cco export-baseline` and `cco audit --baseline` round-trip the profile hash, so a CI run with the baseline carries W8. · `test_ci.py` passes, plus `test_carry_profile.py::test_baseline_carry`
- [ ] The existing review and readiness tests still pass. · `uv run pytest -q`

## Out of scope

Evaluator behaviour (T20).
