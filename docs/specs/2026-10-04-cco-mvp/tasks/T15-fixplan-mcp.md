---
id: T15
title: Deterministic fix-plan renderer and MCP server (4 tools)
kind: work
deps: [G1, T05, T10]
owns: [backend/cco/fixplan/**, backend/cco/api/fixplan.py, backend/cco/mcp/server.py, backend/cco/mcp/tools.py, backend/tests/test_fix_plan.py, backend/tests/test_mcp.py, docs/mcp.md]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_fix_plan.py tests/test_mcp.py -q
review: none
status: done
---

# T15 — Deterministic fix-plan renderer and MCP server (4 tools)

## Goal

Generate the fix plan that drives the next release, served identically over REST and MCP for Claude Code.

## Context

SPEC §6.11 (layout, open findings + templates, no LLM), §6.8 MCP (4 tools, `CCO_MCP_TOKEN`, constant-time compare), D13, D17. The golden output is `demo/wealthpilot/v0.9.0/remediation-plan.md`. Mount the MCP Streamable HTTP session manager in the FastAPI lifespan (m6).

## Definition of done

- [ ] `GET /api/assessments/{id}/fix-plan.md` renders the v0.9.0 plan. It matches the golden plan item for item (IDs, kinds, `depends_on`, locations, boundaries). Every `path:line` exists at `v0.9.0`, and two renders are byte-identical (AC12). · `test_fix_plan.py`
- [ ] MCP lists exactly `get_release_readiness`, `list_findings`, `get_finding` and `get_remediation_plan`. A wrong token is rejected. `list_findings(severity="blocker")` on v0.9.0 returns W1 and W2. The plan equals the REST Markdown byte for byte. Calls are recorded with `run_kind=mcp` (AC9). · `test_mcp.py`
- [ ] A short `docs/mcp.md` snippet shows `claude mcp add --transport http ccommit http://127.0.0.1:20000/mcp --header "Authorization: Bearer …"`. · file exists

## Tests

The two files above.

