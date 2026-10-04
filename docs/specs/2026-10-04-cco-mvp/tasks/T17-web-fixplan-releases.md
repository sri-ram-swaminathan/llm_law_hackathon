---
id: T17
title: Web — fix-plan preview, releases (upload/import), profile form, What changed
kind: work
deps: [T08, T09, T12]
owns: [frontend/src/features/fixplan/**, frontend/src/features/releases/**, frontend/src/features/profile/**]
repo: .
needs: [cmd:pnpm]
verify: cd frontend && pnpm build
review: none
status: todo
---

# T17 — Web: fix-plan preview, releases (upload/import), profile form, What changed

## Goal

Close the loop in the UI: generate and copy the fix plan, bring in new releases, and show progress.

## Context

SPEC §6.7 (journeys A, E, G, H), §6.11, §6.12 (Import CI run), D13, D19. APIs: `fix-plan.md` (T15), `POST /api/releases` and `/import` (T12), readiness `changes_since_previous` (T14).

## Definition of done

- [ ] **Fix plan drawer:** rendered Markdown preview, "Copy as Claude Code prompt", download `.md`, and code vs founder-appendix sections. · `e2e/releases.spec.ts::fix_plan`
- [ ] **`/releases`:** list with source badges (seed/ui/ci, PR link), **New release** (drag-and-drop bundle upload with progress), **Import CI run** (`result.json` or artifact ZIP). · e2e
- [ ] **`/profile`:** one form, seeded values, Confirm; shows `confirmed_at`. · e2e
- [ ] **"What changed" on Overview:** resolved/new chips per requirement, using the T02 panel slot. · e2e

## Tests

`e2e/releases.spec.ts`.
