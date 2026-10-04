---
id: ${id}
title: ${title}
kind: ${kind}                  # work | verify | gate
deps: [${deps}]
owns: [${owns}]                # work only: paths or globs this task may edit
repo: ${repo}
needs: [${needs}]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: ${verify}
review: ${review}                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# ${id} — ${title}

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
