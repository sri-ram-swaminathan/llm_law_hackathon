---
id: T08
title: Finding workspace, document/code viewer with highlights, legal drawer
kind: work
deps: [T02, T03, T04]
owns: [frontend/src/features/finding/**, frontend/src/features/viewer/**, frontend/src/features/legal/**, frontend/src/features/evidence/**]
repo: .
needs: [cmd:pnpm]
verify: cd frontend && pnpm build
review: none
status: todo
---

# T08 — Finding workspace, document/code viewer with highlights, legal drawer

## Goal

Build the demo's "wow moment": law ↔ company promise ↔ code, navigable in one three-pane workspace with inline highlights.

## Context

SPEC §6.7 (journeys C and D, routes `/r/:release/evidence/:artifactId` and `/r/:release/findings/:findingId`), §6.3 (labels), D4, D20.

- **Highlight positions:** come from `EvidenceRef` offsets and line ranges (T01 types). The viewer never re-searches text.
- **Legal drawer:** `GET /api/provisions/{id}` (T03/T04) shows law vs **guidance** (badge), the official source link and "retrieved" provenance. "Related provisions" comes from `GET /api/provisions/{id}/related`, if available.

## Definition of done

- [ ] **Markdown document viewer:** renders the document with highlight marks coloured by severity. Hovering a mark shows the finding title; clicking it opens the finding. · `src/features/viewer/viewer.test.tsx::highlights_render`
- [ ] **Code viewer:** line numbers, highlighted line ranges, scroll-to-line, syntax colouring (Shiki or Prism, lightweight). · `viewer.test.tsx::code_lines`
- [ ] **Finding workspace** (3 panes): evidence list | artifact view | finding panel.
  - Tabs: *Finding · Legal basis · How this was produced*. The third tab is a slot for T09.
  - Shows the confidence triplet (High/Med/Low with expandable reasons), remediation summary, and labels.
  - Selecting another evidence item morphs the middle pane between document and code.
  - · `e2e/finding.spec.ts` (fixtures mode)
- [ ] **Evidence room** (`/r/:release/evidence`): bundle contents, per-artifact finding counts, and "missing" rows for absent kinds (e.g. privacy policy). · e2e
- [ ] **Legal-basis drawer:** law and guidance sections, source link, and an "AI interpretation vs law" distinction. · e2e

## Tests

`viewer.test.tsx` (Vitest), `e2e/finding.spec.ts`.

## Out of scope

The activity timeline and the review panel (T09).
