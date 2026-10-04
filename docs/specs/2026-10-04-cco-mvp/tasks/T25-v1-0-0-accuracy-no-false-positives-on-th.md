---
id: T25
title: v1.0.0 accuracy — no false positives on the fixed release (W1, W6)
kind: work                  # work | verify | gate
deps: [T20, T24]
owns: [backend/cco/agent/**, data/packs/fintech-eu-fr.yaml, backend/tests/test_hardening.py, backend/tests/test_evaluator.py]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_evaluator.py tests/test_hardening.py tests/test_pack.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
---

# T25 — v1.0.0 accuracy — no false positives on the fixed release (W1, W6)

## Goal

The fixed Wealthpilot release (v1.0.0) is assessed READY. The model must stop reporting violations that the fixed code and documents no longer contain, while v0.9.0 still produces every expected finding.

## Context

V2 ran live through the real UI upload path on the Docker stack (`evidence/V2.md`, after the ingest and redactor fixes). In two runs:
- **v0.9.0:** NOT_READY, with W1, W2 and W3 correct on both runs.
- **v1.0.0:** NOT_READY. The false positives:
  - **W1** (FR-CIF-STATUS-01) on both runs. The model says the wording "implies not advice", although the v1 disclaimer and the guide now state the CIF status.
  - **W6** (GDPR-SECURITY-01) on both runs. The model claims a hard-coded secret, although v1 `config.py` reads `os.getenv("JWT_SECRET", "")` and refuses to start without it in production.
  - **W4** once.

The v1.0.0 bundle is `demo/wealthpilot/v1.0.0/upload/`, from FinTechProto `demo/v1`. The v0.9.0 bundle is `demo/wealthpilot/v0.9.0/upload/`.

## Definition of done

- [ ] **Check covers both releases:** `python -m cco.agent.check` accepts `--bundle <upload dir> --release 0.9.0|1.0.0` and compares against `demo/wealthpilot/expected.yaml` for that release. For 1.0.0 everything is satisfied, except C1 (not_applicable) and W8 (uncertain or not_applicable).
- [ ] **Live:** v1.0.0 gives **0 blocker or high potential_violation** findings in 3 of 3 runs, and v0.9.0 stays ≥ 9/10 with W1, W2 and W3 always matching (2 runs). · paste the scores in Notes
- [ ] **Tuning stays within the agent and the pack:**
  - Evaluator prompt and pack wording (statement / `evidence_needed` / evidence hints) only. Ids, severity, `derived_from` and remediation are unchanged.
  - For "absence" requirements, make the prompt check whether the remediation is **present** in the current code and docs before concluding a violation.
  - Prefer the newest evidence (code over a contradicting doc line) only when they disagree.
- [ ] `test_evaluator.py`, `test_hardening.py` and `test_pack.py` pass, and the full suite stays green.

## Out of scope

Pipeline, ingest and gate code.
