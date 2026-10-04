---
id: T09
title: Live activity panel, inline counsel review, persona toggle
kind: work
deps: [T02, T03]
owns: [frontend/src/features/activity/**, frontend/src/features/review/**, frontend/src/features/persona/**, frontend/e2e/activity.spec.ts]
repo: .
needs: [cmd:pnpm]
verify: cd frontend && pnpm build
review: none
status: done
---

# T09 — Live activity panel, inline counsel review, persona toggle

## Goal

Make the agent visibly work: a live, expandable timeline of steps and tool calls. Let counsel decide a finding inline.

## Context

SPEC §6.10 (events, live panel, "How this was produced", replay), §6.3 (review effects, carried label), §6.7 journey D, D8, D9, D11. The SSE endpoint (`GET /api/runs/{id}/events`) comes from T11; in fixtures mode, replay the recorded stream from `contracts/fixtures`.

## Definition of done

- [ ] **Activity panel** (slide-over):
  - grouped by step, then by requirement;
  - tool rows (name, short args, latency) expand to input/output JSON;
  - `retry` rows in amber, showing the validator errors;
  - header counters (requirements, model calls, tool calls, retries, elapsed) and a progress bar;
  - smooth incoming-row animation.
  - · `activity.test.tsx::groups_and_counters`
- [ ] **Replay:** plays a stored stream at its recorded pace; a "speed ×4" control. · `activity.test.tsx::replay_paces`
- [ ] **"How this was produced" tab:** the same component, filtered by `requirement_id`, mounted into T08's tab slot (`features/finding` exports a slot registry). · e2e
- [ ] **Persona toggle** (Founder ⇄ Counsel) in the header slot. The counsel view shows the **review panel**: Confirm / Override / Not applicable / Need evidence, reviewer name, comment. It posts to `POST /api/findings/{id}/reviews`, then re-fetches readiness. It shows "AI assessment vs counsel decision" and "carried from vX". · `e2e/activity.spec.ts`

## Tests

`activity.test.tsx`, `e2e/activity.spec.ts`.

## Out of scope

Backend streaming (T11) and the reviews API logic (T14).
