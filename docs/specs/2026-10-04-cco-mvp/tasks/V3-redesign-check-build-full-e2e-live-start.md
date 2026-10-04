---
id: V3
title: Redesign check — build, full e2e, live Start demo, visual pass
kind: verify                  # work | verify | gate
deps: [T33, T28]
owns: []                # work only: paths or globs this task may edit
repo: .
needs: [docker, cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm build && pnpm exec playwright test"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# V3 — Redesign check — build, full e2e, live Start demo, visual pass

## Goal

The integrated redesign builds, every e2e spec passes, Start demo runs live on Docker (`CCO_DEMO=1`), and an Opus visual pass finds no blocker.

## Definition of done

- [ ] `pnpm build` passes and the full `playwright test` (fixtures) is green.
- [ ] `make up` with CCO_DEMO=1: `make demo-reset`, then Start demo, then a live run ends on Summary. Screenshots go in the evidence.
- [ ] The visual pass (one Opus critic, with screenshots) lists no blocker.
