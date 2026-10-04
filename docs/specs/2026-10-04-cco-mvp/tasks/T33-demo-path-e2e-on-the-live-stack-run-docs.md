---
id: T33
title: Demo-path e2e on the live stack + run docs
kind: work                  # work | verify | gate
deps: [T26, T29, T30, T31, T32, T35]
owns: [frontend/.T33-skipped]
repo: .
needs: [cmd:pnpm, docker, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm exec playwright test -c playwright.live.config.ts demo-path.spec.ts"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: skipped                   # todo | doing | review | done | blocked | skipped
---

# T33 — Demo-path e2e on the live stack + run docs

## Goal

Implement DESIGN.md row **T34** of §7 exactly: its goal, its definition of done and its e2e specs.

## Context

- Spec: `docs/specs/2026-10-04-cco-mvp/design/DESIGN.md` §3.3, §4.12, §7 row T34. Read §0–§5 for the context, the vocabulary and the visual system.
- Inputs: the founder's G2 comments (`gates/G2-ui-demo.md` §7) and `critique/ui/*.md`.
- Stack: React + Vite + TS + Tailwind, shadcn-style, Geist, react-query, framer-motion, shiki. The bar is state-of-the-art: calm, dense and precise, light and dark.
- Fixture mode (`VITE_FIXTURES=1`) must keep working for the e2e specs.

**Orchestrator overrides of DESIGN.md (binding):**
- **No backend changes in this task.** Of DESIGN §6, only B5 (demo endpoints) and the snapshot exist, built by T26.
- B1 dropped: the org name "Wealthpilot SAS" is a frontend constant in `lib/`.
- B2 dropped: restored releases have document artifacts because T26 re-ingests the bundles.
- B3/B4 dropped: Add/replace document builds the new bundle in the browser (`features/releases/zip.ts` pattern: GET the base release's artifacts, overlay the file, zip) and uploads it with the existing `POST /api/releases`, then `POST /api/releases/{id}/assessments`.
- B7 → provenance comes from `GET /api/demo` manifest and `Release.git_sha/branch`.
- Task ids here differ from DESIGN §7. Mapping: DESIGN T28 → T29, DESIGN T29 → T31, DESIGN T31 → T35, DESIGN T34 → T33. The rest are the same.

## Definition of done

- [ ] Every DoD item of DESIGN §7 row T34 that falls within this task's owns is proven by the test it names.
- [ ] The verify command exits 0.

## Out of scope

Files outside `owns`, and backend changes.
