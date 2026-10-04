---
id: T28
title: CI PR review — inline code comments from findings, workflow fixed
kind: work                  # work | verify | gate
deps: [T25, T18]
owns: [.github/workflows/compliance.yml, scripts/ci_run.sh, scripts/ci_review.py, tests/test_ci_review.py, docs/g3-commands.md]                # work only: paths or globs this task may edit
repo: ../FinTechProto
needs: [cmd:uv, gh]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "python3 -m pytest tests/test_ci_review.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: doing                   # todo | doing | review | done | blocked | skipped
---

# T28 — CI PR review — inline code comments from findings, workflow fixed

## Goal

The FinTechProto release-PR check posts a real **GitHub PR review** whose inline comments sit on the code lines the findings cite. Document findings (business plan, terms, privacy, CIF) appear only in the summary, with a link to the CCOmmit app. The workflow starts on GitHub. Founder comments of 2026-10-04: "CI highlights shown in the code section of the review; documents separately".

## Context

- Repo `../FinTechProto` (branch ft/cco-mvp, remote RomanGrebnev/FinTechProto). Workflow `.github/workflows/compliance.yml`, wrapper `scripts/ci_run.sh`. It writes `out/result.json`, `out/comment.md` and `out/fix-plan.md`; the result schema is `CiResult` in llm_law_hackathon `backend/cco/contracts/ci.py`, with findings carrying evidence refs (path, line ranges or doc spans), severity, conclusion and citations.
- Branching (settled): `demo/base` = v0.9.0, `demo/release` = PR head, `demo/push1|2` = fixed snapshots, `scripts/demo_reset.sh` / `demo_push.sh`. PR #1 (demo/release → demo/base) is open at push1.
- Every GitHub run currently ends in `startup_failure`, including a trivial hello workflow. The cause is at the account or billing level, not the file, so it can't be fixed in this task. Still validate the file with `uvx --from actionlint-py actionlint`.
- The secrets MISTRAL_API_KEY and CCOMMIT_REPO_TOKEN are set.

## Definition of done

- [ ] `scripts/ci_review.py` (stdlib only) turns `out/result.json` plus the PR's diff (`gh api repos/{o}/{r}/pulls/{n}/files`) into one review payload:
  - an inline comment on each `potential_violation` / `insufficient_evidence` code ref whose line is in a diff hunk on the RIGHT side; the comment carries the severity badge, the requirement title, a one-line why, the law citation with its official link, and the fix;
  - refs outside the diff go to a "Findings in unchanged code" table in the review body;
  - document findings go to a "Documents (reviewed in CCOmmit)" table.

  `--dry-run` prints the payload. Proven by `tests/test_ci_review.py` (fixture result + fixture files listing → expected payload).
- [ ] The review event is `REQUEST_CHANGES` when the gate is NOT_READY and `COMMENT` otherwise. On a re-run, the previous CCOmmit review is dismissed (if it requested changes) or its body is marked superseded, so only the latest one is live. Proven in the test with mocked gh calls.
- [ ] `ci_run.sh` calls it after the audit, on pull_request only. The existing upserted summary comment remains.
- [ ] actionlint is clean.
- [ ] `docs/g3-commands.md` describes the replay sequence and the review behaviour.
- [ ] Locally, against real PR #1: run `scripts/ci_review.py` with a `result.json` from a real local `cco audit` of demo/push1 and post it. Record the review URL in the evidence.

## Tests

`tests/test_ci_review.py` (pytest, no network).

## Out of scope

GitHub billing; the CCOmmit backend.
