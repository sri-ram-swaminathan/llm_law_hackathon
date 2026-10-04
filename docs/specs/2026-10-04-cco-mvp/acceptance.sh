#!/usr/bin/env bash
# Acceptance checks for this work folder: one `check` line per criterion in SPEC §9.
# Run from the repo root on the integration branch. Exits non-zero if any criterion fails.
# Follow docs/specs/README.md "Sharing the machine" when a check starts containers.
set -u
fail=0
check() {
  local id="$1"; shift
  if bash -c "$*"; then echo "PASS $id"; else echo "FAIL $id"; fail=1; fi
}

B="cd backend && uv run"
F="cd frontend && pnpm exec playwright test"

make db-up seed >/dev/null && (make dev >/tmp/ccommit-api.log 2>&1 &) && sleep 5

check AC1  "make types && git diff --exit-code frontend/src/api/types.ts && $B pytest tests/test_contracts.py -q"
check AC2  "$F e2e/golden-path.spec.ts"
check AC3  "$B pytest tests/test_traceability.py -q"
check AC4  "$B cco eval wealthpilot --runs 5"
check AC5  "$B pytest tests/test_validation.py -q"
check AC6  "$B pytest tests/test_review.py -q"
check AC7  "$B pytest tests/test_readiness.py -q"
check AC8a "$B pytest tests/test_legal.py -q"
check AC9  "$B pytest tests/test_mcp.py -q"
check AC10 "$B pytest tests/test_activity.py -q"
check AC11 "$F e2e/demo-script.spec.ts"
check AC12 "$B pytest tests/test_fix_plan.py -q"
check AC13 "$B pytest tests/test_ci.py -q && test -s docs/specs/2026-10-04-cco-mvp/evidence/G3.md"
check AC14 "$B pytest tests/test_security.py -q"
check DEMO "$F e2e/demo-script.spec.ts"
# AC8b (live Légifrance) is stretch and waived unless PISTE credentials work: uv run pytest -m legifrance

docker compose -p sdd-cco-mvp down >/dev/null 2>&1
exit "$fail"
