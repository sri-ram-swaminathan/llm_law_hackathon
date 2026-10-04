---
id: T21
title: Dockerize CCOmmit — API + web in compose, make up
kind: work                  # work | verify | gate
deps: [T16, T17]
owns: [backend/Dockerfile, backend/.dockerignore, backend/Dockerfile.dockerignore, frontend/Dockerfile, frontend/.dockerignore, frontend/Dockerfile.dockerignore, frontend/nginx.conf, docker-compose.yml, Makefile, docs/run.md]                # work only: paths or globs this task may edit
repo: .
needs: [docker]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "docker compose -p sdd-cco-mvp config -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
---

# T21 — Dockerize CCOmmit — API + web in compose, make up

## Goal

One command (`make up`) starts the whole CCOmmit stack in Docker, so teammates and judges need no Python or Node setup (Roman, 4 Oct: "add the task for dockerization").

## Context

- **Today:** only Postgres + pgvector runs in compose (`docker-compose.yml`, project `sdd-cco-mvp`, port 20002). The API runs with `uv` and the web app with `pnpm` (`make dev`).
- **Ports:** 20000 (API), 20001 (web), 20002 (db). Ports 8000, 5173 and 5432 belong to other projects on this machine and must not be touched.
- **Secrets:** `.env` (Mistral key) is passed with `env_file` and is never baked into images.
- **Single process:** the API runs with one uvicorn worker (SPEC §6.13).
- **Settled:** D1, D10, D19.

## Definition of done

- [ ] **`backend/Dockerfile`:** `python:3.12-slim` + `uv sync --frozen`. It copies `backend/`, `data/` and `contracts/` (the legal cache and fixtures are needed at runtime). It runs as a non-root user. The CMD waits for the db, runs `python -m cco.seed`, then starts `uvicorn cco.main:app --host 0.0.0.0 --port 20000 --workers 1`. · `docker compose -p sdd-cco-mvp build api`
- [ ] **`frontend/Dockerfile`:** multi-stage. `node:22` + `pnpm build` with `VITE_API_URL=http://127.0.0.1:20000` as a build arg, then `nginx:alpine` serves the static build on port 20001 with SPA fallback (`frontend/nginx.conf`). · `docker compose -p sdd-cco-mvp build web`
- [ ] **`docker-compose.yml`:**
  - services `db` (unchanged), `api` (depends on a healthy db, `env_file: .env`, `CCO_DATABASE_URL` pointing at `db`, a named volume for `data/runtime`) and `web`;
  - all ports bound to `127.0.0.1`;
  - every resource labelled `sdd.slug=cco-mvp`.
  - · `docker compose -p sdd-cco-mvp config -q`
- [ ] **Makefile:** `up` (build + start everything, then print the URLs and the deploy token hint), `down` (stop, without `-v`), `logs`. The existing targets (`dev`, `db-up`, `seed`, …) keep working. · `make -n up`
- [ ] **Smoke test:** `make up`, then:
  - `curl -fsS http://127.0.0.1:20000/healthz` succeeds;
  - `curl -fsS http://127.0.0.1:20001/` returns HTML;
  - `GET /api/releases` with the token returns 3 releases.
  - Then `make down`. · paste the output in Notes
- [ ] **`docs/run.md`:** how to run the stack with Docker (`make up`) and without it (`make dev`), the ports, the env vars and the token.

## Tests

The smoke test above. No unit tests.

## Out of scope

Deploying to the cloud, and the FinTechProto app's own Docker setup.

## Notes
