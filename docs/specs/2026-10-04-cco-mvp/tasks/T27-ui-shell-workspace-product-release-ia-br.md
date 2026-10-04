---
id: T27
title: UI shell — workspace → product → release IA, breadcrumb, modes, shared primitives
kind: work                  # work | verify | gate
deps: [G2]
owns: [frontend/src/app/**, frontend/src/lib/**, frontend/src/components/**, frontend/src/styles/**, frontend/src/features/persona/**, frontend/e2e/golden-path.spec.ts, frontend/src/main.tsx]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm exec tsc -b && pnpm exec vitest run src/app src/lib"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T27 — UI shell — workspace → product → release IA, breadcrumb, modes, shared primitives

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
