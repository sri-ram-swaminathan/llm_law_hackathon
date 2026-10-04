---
id: T14
title: Review carry-forward, changes since previous, reviews API
kind: work
deps: [T10]
owns: [backend/cco/gate.py, backend/cco/reviews/**, backend/cco/api/reviews.py, backend/tests/test_review.py, backend/tests/test_readiness.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_review.py tests/test_readiness.py -q
review: none
status: todo
---

# T14 — Review carry-forward, changes since previous, reviews API

## Goal

Make counsel decisions stick across releases while the evidence is unchanged. Readiness reports what changed.

## Context

SPEC §6.3 (applicable review, evidence fingerprint, effective conclusion, labels, `changes_since_previous`), D5, B1.

## Definition of done

- [ ] Carry-forward by `(product, requirement_id, evidence_fingerprint)`. A changed fingerprint doesn't carry; revoking restores REVIEW_REQUIRED (AC6). · `test_review.py::test_carry_forward`
- [ ] Readiness includes `changes_since_previous` keyed by `requirement_id`: rc vs v0.9.0 shows W3–W7 resolved; v1.0.0 vs rc shows W1 and W2 resolved (AC7). · `test_readiness.py`
- [ ] Labels: "Ready (AI)" vs counsel-reviewed n/m. · `test_readiness.py::test_labels`

## Tests

The two files above.
