---
id: T36
title: Evaluator — violations on code-backed requirements must cite code (validation retry)
kind: work                  # work | verify | gate
deps: [T26]
owns: [backend/cco/agent/**, data/packs/fintech-eu-fr.yaml, backend/tests/test_code_evidence.py]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_code_evidence.py tests/test_evaluator.py tests/test_validation.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T36 — Evaluator — violations on code-backed requirements must cite code (validation retry)

## Goal

Each potential_violation or insufficient_evidence finding on a requirement whose pack evidence hints include code cites at least one code location. That way the CI PR review always anchors inline comments on the code (founder requirement of 2026-10-04: "CI highlights in the code section of the review").

## Context

- On PR #2 (GitHub Actions, demo/step1), W1 and W2 cited only PRODUCT_GUIDE and business-plan spans, so the review had 0 inline comments. On PR #1 the same code gave advisor.py:17/22, so code citation varies from run to run.
- The validation and retry mechanism (AC5) already exists in backend/cco/agent (output validator, retries, then uncertain). Add a rule there: for a requirement with code evidence hints (pack `evidence_hints` / code globs), a `potential_violation` or `insufficient_evidence` without any code ref triggers a retry with a precise message ("cite the code lines that implement this; quote them exactly"). If the retries are exhausted, keep the conclusion with the document evidence (never turn a blocker into uncertain because of this rule) and add a validation note.
- Settled: severity comes from the pack; the gate stays deterministic. Don't change the contracts.
- Tune the W1/W2 pack wording if needed (W1: the code that generates personalised buy/sell recommendations; W2: the onboarding/profile code missing the knowledge, experience and loss-capacity questions).

## Definition of done

- [ ] `tests/test_code_evidence.py` (scripted FunctionModel): a doc-only violation on a code-hinted requirement triggers one retry, and the retry with code refs is persisted; when retries are exhausted, the doc-only violation is kept with a note, not uncertain; a requirement without code hints accepts doc-only evidence.
- [ ] Live: `python -m cco.agent.check --ref v0.9.0 --release 0.9.0` and `--bundle` on the demo/step1 code (`git -C ../FinTechProto archive demo/step1`), 2 runs each. W1 and W2 cite ≥ 1 code ref in every run; the score stays ≥ 9/10. Record it in the evidence.
- [ ] The existing evaluator and validation tests stay green.
