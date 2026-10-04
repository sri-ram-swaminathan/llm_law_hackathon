---
id: T01
title: Contracts, fixtures and project skeleton
kind: work
deps: []
owns: [frontend/src/api/types.ts, backend/.python-version, backend/pyproject.toml, backend/uv.lock, backend/cco/__init__.py, backend/cco/contracts/**, backend/tests/conftest.py, backend/tests/test_contracts.py, contracts/**, data/packs/schema.json, data/products/**, demo/wealthpilot/expected.yaml, docs/design.md, Makefile, docker-compose.yml, scripts/gen_types.sh, .gitignore]
repo: .
needs: [cmd:uv, cmd:pnpm]
verify: cd backend && uv run pytest tests/test_contracts.py -q
review: none
status: done
---

# T01 — Contracts, fixtures and project skeleton

## Goal

Freeze every shared interface (SPEC §7) as code plus sample data, so all later tasks build against the same shapes.

## Context

SPEC §6.2 (entities), §6.3 (statuses, gate inputs, labels), §6.4 (`FindingCandidate`), §6.6 (bundle), §6.8 (REST shapes), §6.10 (events), §6.11 (remediation template), §6.12 (`result.json`, `cco-baseline.json`, exit codes, comment marker), §7.
Settled: D1, D3, D4, D5, D13, D14, D15, D16, D17.

- **Python package:** `backend/cco`. This replaces `backend/app` in SPEC §7.
- **Console script:** `cco = cco.cli:main`. The `cco.cli` module is created by T06; T01 only declares the entry point.
- **Tests:** use SQLite via `CCO_DATABASE_URL=sqlite://` where possible. Postgres + pgvector runs only through `docker-compose.yml` (service `db`, image `pgvector/pgvector:pg16`, port 20002).
- **FinTechProto** @ `dbb8e64`: the anchors used in the fixtures are listed in SPEC §4.

## Definition of done

- [ ] Pydantic models exist for everything in SPEC §6.2:
  - [ ] `RegulatoryProfile`, `Release`, `Artifact`, `LegalProvision`, `Requirement` (incl. `remediation.parts`), `Assessment`, `Finding`, `EvidenceRef` (discriminated union), `Review`;
  - [ ] `AgentEvent` (10 types) + SSE envelope;
  - [ ] `Readiness` (gate, labels, coverage, `changes_since_previous`);
  - [ ] `FindingCandidate`;
  - [ ] `Bundle`, `ProductEvidenceConfig`;
  - [ ] `CiResult`, `Baseline`, plus exit-code and marker constants.
  - · `tests/test_contracts.py::test_models_import`
- [ ] Fixtures exist for v0.9.0, the partial rc and v1.0.0: assessment, findings and readiness per release, plus one recorded event stream (v0.9.0). They match the expected table in SPEC §6.9, with real FinTechProto anchors and quotes. · `test_contracts.py::test_fixtures_validate`
- [ ] `demo/wealthpilot/expected.yaml` lists every requirement (W1–W8, C1, C2) × 3 releases. · `test_contracts.py::test_expected_matches_fixtures`
- [ ] `data/packs/schema.json` (JSON Schema for the pack) and `data/products/wealthpilot.yaml` (profile + evidence config) exist. · `test_contracts.py::test_pack_schema_and_product_config`
- [ ] The OpenAPI document is exported to `contracts/openapi.json` from a stub FastAPI app built from the models. `scripts/gen_types.sh` writes `frontend/src/api/types.ts`. · `test_contracts.py::test_openapi_exports`
- [ ] **All backend dependencies are pre-installed and locked:** `pydantic-ai-slim[mistral]`, `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg[binary]`, `pgvector`, `httpx`, `lxml`, `numpy`, `rapidfuzz`, `mcp`, `typer`, `python-multipart`, `sse-starlette`, `pytest`, `pytest-asyncio`. **Later tasks may not edit `pyproject.toml` or `uv.lock`.** · `uv sync --frozen`
- [ ] **Makefile has real recipes**, not stubs:
  - `dev` (API on 127.0.0.1:20000 + `pnpm -C frontend dev` on 127.0.0.1:20001), `db-up` (compose project `sdd-cco-mvp`), `seed` (`python -m cco.seed`), `demo-reset` (drop + seed), `demo-bundles` (`bash scripts/demo_bundles.sh`), `types` (export OpenAPI from `cco.main:app` if importable, else the stub; then `pnpm dlx openapi-typescript`), `verify-w2` and `acceptance` (call the commands listed in V2 and `acceptance.sh`).
  - A recipe whose command doesn't exist yet **fails** (non-zero). · `make -n verify-w2`
- [ ] **Bundle storage is frozen:** `${CCO_DATA_DIR:-data/runtime}/bundles/<release_id>/` holds the extracted code and `compliance/`. A `Bundle` model points to it. · `test_contracts.py::test_bundle_paths`
- [ ] `docs/design.md` defines the design tokens: palette with status colours, type scale, spacing, radii, motion. Its direction is "Linear/Stripe restraint, one accent". · file exists

## Tests

`backend/tests/test_contracts.py` only.

## Out of scope

Business logic, DB tables, endpoints and UI.

## Notes

This is the one large task. It sets the vocabulary for everything else, so keep the field names exactly as in the SPEC.
