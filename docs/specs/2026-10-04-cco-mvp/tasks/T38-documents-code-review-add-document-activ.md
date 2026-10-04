---
id: T38
title: Documents + Code review, Add document, Activity/Start demo/Fix plan, Counsel mode
kind: work                  # work | verify | gate
deps: [T27, T17]
owns: [frontend/src/features/documents/**, frontend/src/features/code/**, frontend/src/features/viewer/**, frontend/src/features/add-document/**, frontend/src/features/evidence/**, frontend/src/features/activity/**, frontend/src/features/demo/**, frontend/src/features/fixplan/**, frontend/src/features/review/**, frontend/src/features/persona/**, frontend/e2e/documents.spec.ts, frontend/e2e/activity.spec.ts, frontend/e2e/fixplan.spec.ts, frontend/e2e/counsel.spec.ts]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm exec tsc -b && pnpm exec playwright test documents.spec.ts counsel.spec.ts"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T38 — Documents + Code review, Add document, Activity/Start demo/Fix plan, Counsel mode

## Goal

One agent implements DESIGN §7 rows T30 (Documents, Code, add document), T32 (run strip, Activity, Start demo UI, Fix plan) and T31 (Counsel mode) end to end, fast. This compresses five tasks into two at the founder's request; the demo is imminent.

## Context

- Spec: `docs/specs/2026-10-04-cco-mvp/design/DESIGN.md` §4.7–§4.12, plus §0–§5. Build on the T27 foundation seams (routes, status vocabulary, categories, provenance, queries, client, slots, components) and replace the T27 page stubs in your features.
- Founder comments: `gates/G2-ui-demo.md` §7. Key ones: documents are first-class; a vivid evidence ↔ law comparison; the value up front; Counsel is a genuinely different mode; Start demo runs live.
- The backend `/api/demo` endpoints (GET, start, reset) exist. Start demo: POST `/api/demo/start` → the live run on release 0.9.0. Reset: POST `/api/demo/reset`.
- Fixture mode (`VITE_FIXTURES=1`) must keep working for the e2e specs.

**Orchestrator overrides of DESIGN.md (binding):**
- **No backend changes in this task.** Of DESIGN §6, only B5 (demo endpoints) and the snapshot exist, built by T26.
- B1 dropped: the org name "Wealthpilot SAS" is a frontend constant in `lib/`.
- B2 dropped: restored releases have document artifacts because T26 re-ingests the bundles.
- B3/B4 dropped: Add/replace document builds the new bundle in the browser (`features/releases/zip.ts` pattern: GET the base release's artifacts, overlay the file, zip) and uploads it with the existing `POST /api/releases`, then `POST /api/releases/{id}/assessments`.
- B7 → provenance comes from `GET /api/demo` manifest and `Release.git_sha/branch`.
- Task ids here differ from DESIGN §7. Mapping: DESIGN T28 → T29, DESIGN T29 → T31, DESIGN T31 → T35, DESIGN T34 → T33. The rest are the same.


## Definition of done

- [ ] The DESIGN DoD items of those rows are met. Prioritise the visible demo path over edge cases; drop keyboard shortcuts first if time runs short.
- [ ] The verify command exits 0 and `pnpm build` passes.

## Out of scope

Backend changes, and files outside `owns`.
