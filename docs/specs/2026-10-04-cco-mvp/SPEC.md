---
title: AI Chief Compliance Officer MVP
slug: cco-mvp
created: 2026-10-04
status: draft                  # draft → approved → planned → executing → verifying → closed
size: full                     # lite | full
base_branch: main           # asked at the start: main or dev
integration_branch: ft/cco-mvp
task_branch_pattern: ft/cco-mvp-{id}
repos: [., ../FinTechProto]    # the lead repo first; other repos as relative paths
run_mode: step                 # step (stop after every wave) | auto (stop at gates only)
push: all                      # none | integration | all
docker_parallel: 1             # max Docker-using tasks at once
needs: []                      # spec-wide preflight needs, e.g. [gh, git-push]
---

# AI Chief Compliance Officer MVP

## 1. Problem

<!-- What is wrong or missing, for whom, and why now. One or two paragraphs. -->

## 2. Goals / non-goals

**Goals**
-

**Non-goals**
-

## 3. Constraints

<!-- Deadlines, compatibility, mode (consulting / product), repos that need other people's review. -->

## 4. Current state (grounded @ <commit>)

<!-- How it works today, citing `path/file.py:123 @ <short-sha>`. Or: summary of the provided analysis file, with its path. -->

## 5. Options considered

| Option | Pros | Cons |
|---|---|---|

## 6. Design

## 7. Interfaces and contracts

<!-- Everything two or more tasks touch: schemas, config keys, APIs, events, file formats. Frozen by the first task. -->

## 8. Decisions

| # | Decision | Rationale | Status |
|---|---|---|---|

## 9. Acceptance criteria

<!-- Observable behaviour, each with how it is verified. -->
- AC1 — … · verify: `…`

## 10. Risks and rollback

## 11. Open questions

## 12. Plan

<!-- Filled by /roman:plan: summary, waves, gates, `sdd graph` output. -->
