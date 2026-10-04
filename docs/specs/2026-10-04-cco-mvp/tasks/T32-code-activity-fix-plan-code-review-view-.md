---
id: T32
title: Code, Activity, Fix plan — code review view, Live vs Replay, clean fix plan
kind: work                  # work | verify | gate
deps: [T27, T17]
owns: [frontend/src/features/evidence/**, frontend/src/features/code/**, frontend/src/features/viewer/CodeView.tsx, frontend/src/features/viewer/ArtifactPane.tsx, frontend/src/features/viewer/index.tsx, frontend/src/features/viewer/data.ts, frontend/src/features/viewer/shiki.ts, frontend/src/features/activity/**, frontend/src/features/fixplan/**, frontend/e2e/activity.spec.ts]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm exec tsc -b && pnpm exec vitest run src/features/activity src/features/fixplan src/features/code"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T32 — Code, Activity, Fix plan — code review view, Live vs Replay, clean fix plan

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
