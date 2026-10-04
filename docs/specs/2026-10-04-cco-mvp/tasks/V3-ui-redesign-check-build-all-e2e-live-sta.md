---
id: V3
title: UI redesign check — build, all e2e, live Start demo on Docker, visual pass
kind: verify                  # work | verify | gate
deps: [T29, T30, T31, T32, T33, T28]
owns: []                # work only: paths or globs this task may edit
repo: .
needs: [docker, cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "make up && cd frontend && pnpm build && pnpm exec playwright test"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# V3 — UI redesign check — build, all e2e, live Start demo on Docker, visual pass

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
