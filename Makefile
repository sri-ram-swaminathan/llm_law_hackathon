# CCOmmit - dev, demo and verification recipes. Recipes whose command does not exist yet fail (non-zero).
# Ports: API 127.0.0.1:20000, web 127.0.0.1:20001, Postgres 127.0.0.1:20002 (8000/5173/5432 are NOT ours).
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
COMPOSE := docker compose -p sdd-cco-mvp
API_HOST ?= 127.0.0.1
API_PORT ?= 20000
WEB_PORT ?= 20001
export CCO_DATABASE_URL ?= postgresql+psycopg://cco:cco@127.0.0.1:20002/cco
FIXTURE_REL ?= 0.9.0

.PHONY: dev api web db-up db-down seed demo-reset demo-snapshot demo-bundles demo-export types contracts-check test verify-w2 acceptance up down logs

dev: ## API on :20000 and web on :20001 (Ctrl-C stops both)
	@trap 'kill 0' INT TERM EXIT; \
	(cd backend && uv run uvicorn cco.main:app --host $(API_HOST) --port $(API_PORT) --workers 1) & \
	pnpm -C frontend dev --host 127.0.0.1 --port $(WEB_PORT) --strictPort & \
	wait

api: ## API only
	cd backend && uv run uvicorn cco.main:app --host $(API_HOST) --port $(API_PORT) --workers 1

web: ## web only
	pnpm -C frontend dev --host 127.0.0.1 --port $(WEB_PORT) --strictPort

db-up: ## Postgres + pgvector on :20002
	$(COMPOSE) up -d --wait db

db-down:
	$(COMPOSE) down

seed: ## load fixtures (releases, assessments, events, W8 review) into the database
	cd backend && uv run python -m cco.seed

demo-reset: ## restore the demo: demo/snapshot (validated live runs) if MANIFEST.json exists, else the fixtures
	$(COMPOSE) up -d --wait db
	cd backend && uv run python -m cco.demo reset

demo-snapshot: ## re-capture demo/snapshot from live runs (cco audit x3, checked against expected.yaml)
	bash scripts/demo_snapshot.sh

demo-bundles: ## ready-to-upload bundles from FinTechProto tags
	bash scripts/demo_bundles.sh

demo-export: ## dump runs and reviews to JSON
	cd backend && uv run python -m cco.seed --export ../demo/export

types: ## OpenAPI export (cco.main if importable, else the contract stub) + TS types
	bash scripts/gen_types.sh

contracts-check: ## AC1: models import, fixtures validate, OpenAPI exports, TS types have no diff
	cd backend && uv run pytest tests/test_contracts.py -q
	bash scripts/gen_types.sh
	git diff --exit-code -- contracts/openapi.json frontend/src/api/types.ts

test: ## backend unit suite
	cd backend && uv run pytest -q

verify-w2: ## V2: live end-to-end check
	$(MAKE) db-up
	bash scripts/demo_bundles.sh
	cd backend && uv run python -m cco.verify_w2 --api http://$(API_HOST):$(API_PORT)
	cd backend && uv run cco spike --repo ../../FinTechProto --ref dbb8e64 --req W1,W2,W3
	pnpm -C frontend exec playwright test golden-path.spec.ts
	cd backend && uv run pytest -q

acceptance: ## VA: AC1-AC14 + demo script
	bash docs/specs/2026-10-04-cco-mvp/acceptance.sh

up: ## whole stack in Docker: db + api (:20000) + web (:20001)
	$(COMPOSE) up -d --build --wait
	@echo "web  http://127.0.0.1:$(WEB_PORT)"; echo "api  http://$(API_HOST):$(API_PORT)  (docs: /docs)"
	@echo "deploy token: CCO_DEPLOY_TOKEN from .env, default 'dev-token' (send as 'Authorization: Bearer <token>')"

down: ## stop the stack (keeps volumes)
	$(COMPOSE) down

logs: ## follow api + web logs
	$(COMPOSE) logs -f api web
