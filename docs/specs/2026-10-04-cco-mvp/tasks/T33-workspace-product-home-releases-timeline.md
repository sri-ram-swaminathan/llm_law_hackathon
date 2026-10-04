---
id: T33
title: Workspace + product home, releases timeline, Start demo, demo-path e2e
kind: work                  # work | verify | gate
deps: [T27, T26, T17]
owns: [frontend/src/features/workspace/**, frontend/src/features/releases/**, frontend/src/features/profile/**, frontend/public/demo/**, frontend/scripts/**, frontend/e2e/releases.spec.ts, frontend/e2e/demo-path.spec.ts, docs/demo-script.md]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm exec tsc -b && pnpm exec vitest run src/features/releases src/features/workspace"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T33 — Workspace + product home, releases timeline, Start demo, demo-path e2e

## Goal

## Context

<!-- SPEC sections this implements; current code `path:line @ sha`.
     Settled: the SPEC decisions (D-numbers) this task implements. Reviewers don't reopen them.
     Definition of done: each item names the test (file::name) or command that proves it. -->

## Definition of done

- [ ] 

## Tests

## Out of scope

## Notes
