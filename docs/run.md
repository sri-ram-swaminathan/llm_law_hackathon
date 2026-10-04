# Running CCOmmit

## With Docker (no Python or Node needed)

    cp .env.example .env     # add MISTRAL_API_KEY (optional for the demo data)
    make up                  # build + start db, api, web; seeds the demo data
    make logs                # follow api + web logs
    make down                # stop (keeps the database volume)

| Service | URL | Notes |
|---------|-----|-------|
| web | http://127.0.0.1:20001 | nginx, static build, SPA fallback |
| api | http://127.0.0.1:20000 | `/healthz` is open, `/api/*` needs the token, docs at `/docs` |
| db  | 127.0.0.1:20002 | Postgres 16 + pgvector, user/pass/db `cco` |

Ports 8000, 5173 and 5432 belong to other projects and are never used.

## Without Docker

    make db-up && make seed   # Postgres in Docker, then fixtures
    make dev                  # API on :20000 and web on :20001 via uv and pnpm

## Environment

- `CCO_DEPLOY_TOKEN`: bearer token for `/api/*`. Default `dev-token`. Send `Authorization: Bearer <token>`.
- `CCO_MCP_TOKEN`: token for the MCP endpoint (optional).
- `MISTRAL_API_KEY` and the other keys in `.env.example`: read from `.env` through `env_file`, never baked into images.
- `CCO_DATABASE_URL`: set to the `db` service inside compose.
- `CCO_DATA_DIR`: runtime data, a named volume in compose.
- `VITE_API_URL`: build arg for the web image, default `http://127.0.0.1:20000`.

The API runs one uvicorn worker. `make demo-reset` drops the database volume (use it only for this project's stack).
