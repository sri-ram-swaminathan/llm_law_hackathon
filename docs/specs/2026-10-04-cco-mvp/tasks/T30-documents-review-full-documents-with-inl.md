---
id: T30
title: Documents review — full documents with inline risk highlights, margin notes, add/replace document
kind: work                  # work | verify | gate
deps: [T27]
owns: [frontend/src/features/documents/**, frontend/src/features/viewer/MarkdownView.tsx, frontend/src/features/viewer/highlight.ts, frontend/e2e/documents.spec.ts]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:pnpm]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd frontend && pnpm exec tsc -b && pnpm exec vitest run src/features/documents"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T30 — Documents review — full documents with inline risk highlights, margin notes, add/replace document

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
