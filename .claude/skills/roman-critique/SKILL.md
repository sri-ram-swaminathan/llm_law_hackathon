---
name: roman-critique
description: Independent adversarial review of a spec, plan, task, diff or branch by fresh-context agents, plus an alignment check against the work's problem and decisions. Saves the findings to critique/NN-<target>.md and triages them with the user. Use when asked to critique, challenge, review or sanity-check a design or a change.
argument-hint: "[path | plan | <task id> | <branch>]  (default: the current folder's SPEC.md)"
---

# /roman-critique

Outcome: a saved critique with verified findings, and the user's decision on each one.

Arguments: $ARGUMENTS

## 1. Resolve the target

```bash
REPO=$(git rev-parse --show-toplevel); SDD="$REPO/docs/specs/_kit/sdd"
```

The folder comes from `$SDD settings --json`, or from `--folder <slug>` if the argument names one. The target is one of:

| Target | What the critics read |
|---|---|
| no argument or `spec` | The folder's `SPEC.md` |
| `plan` | `SPEC.md` plus `tasks/*.md` and `$SDD graph` |
| a task id | The task file plus `git diff <integration>...<task branch>` (from its worktree if it exists) |
| a branch | `git diff <integration or base>...<branch>` |
| a path | That file |

Give the critics paths and commands, not pasted contents. They read for themselves.

## 2. Critics

Spawn critics with the Agent tool (general-purpose), so each has a fresh context and no stake in the work.
- **Spec, plan, or a diff over about 300 lines:** 3 critics in parallel, each with one lens:
  1. **Correctness and feasibility:** does it work, what breaks, missing cases, wrong assumptions about the code (check the cited `path:line`).
  2. **Simplicity:** over-engineering, speculative abstraction, a smaller design that meets the same goals.
  3. **Risk and operability:** security, secrets, data loss, rollback, testability, how it's verified, blast radius.
- **Anything smaller:** 1 critic with all three lenses.

Every critic also does the **alignment check**: does the target still solve SPEC §1 within §2 (goals and non-goals), and does it respect §8 (decisions)?

Brief every critic to:
- be skeptical;
- cite evidence (file:line or spec section);
- grade each finding blocker (must change), major (should change) or minor (optional);
- give a concrete change for each;
- stop at 10 findings per lens, with no style nitpicks;
- not edit anything.

Ask each for JSON: `{verdict: ACCEPT|ACCEPT_WITH_CHANGES|REWORK, alignment: string, findings: [{severity, title, evidence, change}]}`.

## 3. Verify before reporting

Merge and deduplicate the findings. Check the cited evidence yourself for every blocker and major. Drop the ones the evidence doesn't support, and record them as "rejected: evidence doesn't hold". A plausible but wrong finding costs the user more than a missed minor one.

## 4. Write it down

Create `critique/NN-<target>.md` from `docs/specs/_kit/templates/CRITIQUE.md`. `NN` is the next two-digit number in the folder, and `<target>` is a short name such as `spec`, `plan` or `t03`. Fill in:
- the verdict;
- the findings, blockers first;
- the alignment check;
- an empty triage table.

## 5. Triage with the user

- Present the blockers and majors one by one, each with your recommendation: accept, reject or defer. Summarise the minors in one list.
- Record each decision in the triage table.
- If the target is the spec or plan, apply the accepted changes to it.
- If the target is code, turn the accepted changes into fix instructions: for `/roman-run`, or as a new task via `$SDD add`, when the work is mid-run.

## 6. Record

- Run `$SDD log --phase critique "NN-<target>: <verdict>, <b> blocker / <M> major / <m> minor, <accepted> accepted"`.
- Commit `docs(<slug>): critique NN-<target>`.
