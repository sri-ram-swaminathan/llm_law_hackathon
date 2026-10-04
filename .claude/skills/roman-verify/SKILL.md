---
name: roman-verify
description: Verify a spec folder end to end. Checks every acceptance criterion against real evidence on the booted system, audits each task's evidence, compares what was built with the spec, critiques the final diff, and writes a gate file with the measured results and the decisions only the user can make. Use after /roman-run finishes, or before any go/no-go.
argument-hint: "[slug]"
---

# /roman-verify

Outcome: `gates/G<n>-<slug>.md` with measured results and the user's recorded decision.

Arguments: $ARGUMENTS

```bash
REPO=$(git rev-parse --show-toplevel); SDD="$REPO/docs/specs/_kit/sdd"
```

## 1. Preconditions

- Read `docs/specs/README.md`. Resolve the folder, and check out the integration branch.
- Run `$SDD status`. Every work and verify task must be `done` or `skipped`, except `VA` (acceptance) and the final gate. If any aren't, list them and ask whether to continue anyway.
- Run `$SDD preflight --write` and `$SDD resources`.

## 2. Acceptance, measured fresh

- Run `$SDD verify VA` on the integration checkout. It runs `acceptance.sh`, one PASS or FAIL line per criterion in SPEC §9, and records the evidence.
- Boot the system the way the spec says it runs (compose locally, or the staging target named in the spec), following the machine-sharing rules. Use compose project `sdd-<slug>`, the suggested ports, and touch nothing that isn't ours.
- If the spec defines evals or metrics, run them.
  - Where a baseline matters, measure before and after on the same inputs and state how noisy the numbers are.
  - Report a difference as an effect only when it is larger than that noise.
- A criterion with no automated check → check it by hand. Write down exactly what you did and what you saw.

## 3. Evidence audit

For every task, check that:
- `evidence/<id>.md` exists;
- the last verify run passed on the commit that was merged;
- every Definition of done item is shown in the audit.

List any gaps.

## 4. Built vs spec

- Run `git diff --stat <base>...ft/<slug>` (`origin/<base>`). Flag files changed outside every task's `owns`.
- Go through SPEC §6, §7 and §9. Note whatever the spec says that wasn't built, and whatever was built that the spec doesn't say.
- Collect the deviations recorded in the evidence files.
- Decisions made during the run that aren't in SPEC §8 → add them as `proposed` and point them out.

## 5. Final critique

Run `/roman-critique ft/<slug>`, which reviews the whole diff against the base, focused on cross-cutting risk.
- Blockers → fix tasks: `$SDD add`, then `/roman-run`. Or they become an explicit decision in the gate.

## 6. The gate file

- Write `gates/G<n>-<slug>.md` from `docs/specs/_kit/templates/GATE.md`. Use the final gate's id if one exists, otherwise the next number. Fill in:
  1. the acceptance criteria, with result and evidence;
  2. the measured results;
  3. built vs spec;
  4. decisions needed;
  5. prerequisites only a human can grant (merges in other repos, access, rollout windows);
  6. rollout and rollback.
- Ask the user for the decision and record it in section 7: who, when, and what, in their words.
- Mark the gate: go → `$SDD set <G> done --note "<decision>"`; skipped → `$SDD set <G> skipped --note "<who: why>"`.
- Mark `VA`: `$SDD set VA done` if it passed.

## 7. Record

- Stop the containers you started: `docker compose -p sdd-<slug> down`.
- Commit `docs(<slug>): gate G<n> — <decision>`, then run `$SDD push`.
- Next step: `/roman-close` on a go, or `/roman-run` for fix tasks.
