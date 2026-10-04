#!/usr/bin/env bash
# Export OpenAPI (real app if importable, else the contract stub) and generate TS types.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd backend && uv run python ../contracts/export_openapi.py ../contracts/openapi.json)
mkdir -p frontend/src/api
pnpm dlx openapi-typescript contracts/openapi.json -o frontend/src/api/types.ts
