# CCOmmit MCP server

Streamable HTTP, stateless, mounted at `/mcp` on the API port. Set `CCO_MCP_TOKEN` in `.env` (an insecure default, `dev-mcp-token`, is used with a warning if unset).

Connect Claude Code:

```bash
claude mcp add --transport http ccommit http://127.0.0.1:20000/mcp --header "Authorization: Bearer <token>"
```

Tools:

| Tool | Returns |
|---|---|
| `get_release_readiness(version?)` | Gate, counts, labels, changes since previous release |
| `list_findings(version?, severity?, conclusion?)` | Findings of a release, filtered |
| `get_finding(id)` | One finding with evidence, requirement and legal provisions |
| `get_remediation_plan(version?)` | The deterministic fix plan (Markdown), byte-identical to `GET /api/assessments/{id}/fix-plan.md` |

`version` defaults to the newest release with a completed assessment. Calls appear in the activity panel as `run_kind=mcp`.
