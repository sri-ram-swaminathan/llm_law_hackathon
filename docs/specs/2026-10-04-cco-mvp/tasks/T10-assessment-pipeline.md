---
id: T10
title: Assessment pipeline, run lock and model queue
kind: work
deps: [T03, T04, T05, T06]
owns: [backend/cco/pipeline/**, backend/cco/api/assessments.py, backend/tests/test_pipeline.py, backend/tests/test_validation.py, backend/tests/test_traceability.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_pipeline.py tests/test_validation.py tests/test_traceability.py -q
review: none
status: todo
---

# T10 — Assessment pipeline, run lock and model queue

## Goal

Make `POST /api/releases/{id}/assessments` run the full §6.4 pipeline on a release's bundle and persist findings, the gate and events.

## Context

SPEC §6.4 (steps 1–8, throughput, injection framing), §6.3, D3, D4, D5, D16.

- **Scoper:** `cco.pack.scope` (T05).
- **Provisions:** `cco.legal` (T04).
- **Evaluator:** `cco.agent` (T06).
- **Events:** `on_event` → `cco.activity.record` (T11). T11 runs in parallel, so call it through T01's `ActivityRecorder` protocol. Import `cco.activity` when present; otherwise log a **warning** at run start. V2 asserts that events exist. Bundles are read from T01's frozen bundle path.

## Definition of done

- [ ] Steps 1–8, with out-of-scope requirements producing `not_applicable` and no model call; severity copied from the requirement. · `test_pipeline.py::test_full_run_scripted` (`FunctionModel`, fixture bundle)
- [ ] One in-flight run per product (409 otherwise), a global model queue (concurrency 4), and 429 backoff (max 3). · `test_pipeline.py::test_lock_and_queue`
- [ ] Validation exhaustion → `uncertain`, with no dangling references (AC5). · `test_validation.py`
- [ ] Every `potential_violation` or `satisfied` finding has an evidence reference that resolves and a citation with a `source_url` (AC3). · `test_traceability.py`
- [ ] The endpoint returns 202 with `{assessment_id, run_id}`; `GET /api/assessments/{id}` shows the status. · `test_pipeline.py::test_endpoint`

## Tests

The three files above.

## Out of scope

Carry-forward (T14), the CLI (T16), ingestion (T12).
