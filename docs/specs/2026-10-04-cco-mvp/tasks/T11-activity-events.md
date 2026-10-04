---
id: T11
title: Activity recorder, redaction and SSE events
kind: work
deps: [T03]
owns: [backend/cco/activity/**, backend/cco/api/runs.py, backend/tests/test_activity.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_activity.py -q
review: none
status: doing
---

# T11 — Activity recorder, redaction and SSE events

## Goal

Persist agent events and stream them live or replayed from one code path.

## Context

SPEC §6.10 (10 event types, one table, SSE polling by `seq`, replay pacing, redaction, 2 KB previews), §6.13, D9, D11. The interface is T01's `ActivityRecorder`.

## Definition of done

- [ ] `record(event)` inserts into `agent_events` with a monotonic `seq` per run. Previews are redacted with `cco.redact` (T03) and capped at 2 KB. · `test_activity.py::test_record_and_redact`
- [ ] `GET /api/runs/{id}/events?after_seq=&requirement_id=` streams SSE: it replays the stored events, then follows live by polling the table every 250 ms until `run_end`. · `test_activity.py::test_sse_replay_then_live`
- [ ] `?replay=1&speed=N` paces events by their recorded `ts` gaps. · `test_activity.py::test_replay_pacing`
- [ ] An MCP-call decorator writes `run_kind=mcp` events, with the client name and never the token. · `test_activity.py::test_mcp_decorator`

## Tests

`test_activity.py`.

## Out of scope

The UI (T09).
