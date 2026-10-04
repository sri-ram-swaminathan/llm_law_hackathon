---
id: T03
title: FastAPI core, DB, seed, token and gate
kind: work
deps: [T01]
owns: [backend/cco/main.py, backend/cco/redact.py, backend/cco/config.py, backend/cco/db.py, backend/cco/models.py, backend/cco/auth.py, backend/cco/seed.py, backend/cco/gate.py, backend/cco/api/**, backend/cco/mcp/__init__.py, backend/cco/mcp/server.py, backend/tests/test_api_basic.py, backend/tests/test_gate.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_api_basic.py tests/test_gate.py -q
review: none
status: todo
---

# T03 — FastAPI core, DB, seed, token and gate

## Goal

Build a running API that serves the seeded Wealthpilot releases from the fixtures, protected by the deploy token, with the deterministic gate.

## Context

SPEC §6.3 (gate formula and labels), §6.8 (REST), §6.13 (tokens, single process, healthz), D5, D8, D19.

**Router layout:** create every router module named in §6.8 now, as stubs. Each stub holds an empty `APIRouter`, the stub `cco/mcp/server.py` holds an empty ASGI app, and `main.py` mounts them all. Later tasks own and replace their module:

| Module | Owner |
|---|---|
| `api/assessments.py` | T10 |
| `api/runs.py` | T11 |
| `api/releases_write.py` | T12 |
| `api/reviews.py` | T14 |
| `api/fixplan.py` | T15 |
| `mcp/server.py` | T15 |

T03 itself implements `api/product.py`, `api/releases_read.py`, `api/findings_read.py`, `api/readiness.py` and `api/provisions.py` (the latter reads from the cache once T04 lands; return 404 until then).

## Definition of done

- [ ] SQLAlchemy models for the §6.2 entities and `agent_events`. `create_all` runs on start. Postgres comes from `CCO_DATABASE_URL`; tests use SQLite. · `test_api_basic.py::test_startup`
- [ ] `cco.seed` loads the org, product, profile, the three releases, their findings and events, and the W8 counsel review from `contracts/fixtures`. It is idempotent. · `test_api_basic.py::test_seed_idempotent`
- [ ] `CCO_DEPLOY_TOKEN` bearer is required on `/api/*`; `/healthz` is open. · `test_api_basic.py::test_auth`
- [ ] These endpoints return T01 shapes:
  - `GET /api/product`, `PUT /api/product/profile`
  - `GET /api/releases`, `GET /api/releases/{id}`
  - `GET /api/releases/{id}/readiness`
  - `GET /api/assessments/{id}/findings`, `GET /api/findings/{id}`
  - `GET /api/artifacts/{id}`
  - · `test_api_basic.py::test_read_endpoints`
- [ ] `gate.py` implements the §6.3 formula, the **review effects** on this assessment's findings (effective conclusion, "counsel-reviewed n/m", "Ready (AI)") and labels. Carry-forward across releases is T14. v0.9.0 → NOT_READY. · `test_gate.py`
- [ ] **Reviews API:** `POST /api/findings/{id}/reviews` and `POST /api/reviews/{id}/revoke`, never mutating AI values, so the G2 UI demo can record counsel decisions. · `test_api_basic.py::test_reviews`
- [ ] CORS allows `http://localhost:20001` and `http://127.0.0.1:20001`. · `test_api_basic.py::test_cors`
- [ ] `cco/redact.py`: a secret redactor (key-shaped regexes plus entropy), shared by T11 and T12. · `test_api_basic.py::test_redact`
- [ ] `make dev` starts uvicorn on `127.0.0.1:20000` (one worker). · manual, checked in V1

## Tests

`test_api_basic.py`, `test_gate.py`.

## Out of scope

Running assessments, events streaming, ingestion, reviews and MCP tools.
