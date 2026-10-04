---
id: T12
title: Bundle ingestion, hardening and demo bundles
kind: work
deps: [T03]
owns: [backend/cco/ingest/**, backend/cco/api/releases_write.py, scripts/demo_bundles.sh, demo/wealthpilot/*/upload/**, backend/tests/test_ingest.py, backend/tests/test_security.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_ingest.py tests/test_security.py -q
review: none
status: done
---

# T12 — Bundle ingestion, hardening and demo bundles

## Goal

Add one safe ingestion path (code ZIP + `compliance/*.md`), used by the UI upload, the seed and CI, plus ready-to-upload demo bundles.

## Context

SPEC §6.6 (limits, excludes, redactor, per-product config from `data/products/wealthpilot.yaml`), §6.13, D15. Uses `cco.redact` (T03).

## Definition of done

- [ ] `ingest_bundle(zip|dir, version)` creates a `Release` and `Artifacts` (redacted text, file list, kinds from the product config). · `test_ingest.py::test_ingest_fixture_bundle`
- [ ] Hardening:
  - rejects zip-slip, zip bombs (size, count and ratio caps), symlinks and device files;
  - drops `.env*`, `*.pem`, `*.key`, `id_*`, `node_modules/` and `.git/`;
  - redacts a planted fake key (AC14).
  - · `test_security.py`
- [ ] `POST /api/releases` (multipart bundle + `version`) and `POST /api/releases/import` (a `result.json` or artifact ZIP, using T01's `CiResult`). · `test_ingest.py::test_endpoints`
- [ ] `scripts/demo_bundles.sh` builds `demo/wealthpilot/{v0.9.0,rc,v1.0.0}/upload/` from FinTechProto `v0.9.0` (or `81bbbbe` before G1), `demo/rc` and `demo/v1`, (`code.zip` + `compliance/*.md`) with `git archive` from FinTechProto tags/refs. Before G1 it falls back to `dbb8e64` + the `ft/cco-mvp` docs. · `bash scripts/demo_bundles.sh && ls demo/wealthpilot/v0.9.0/upload`

## Tests

`test_ingest.py`, `test_security.py`.

## Out of scope

The CLI wrapper (T16) and the UI upload screen (T17).
