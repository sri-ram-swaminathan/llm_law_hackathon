---
id: T26
title: Real-run demo snapshot — reset restores validated live runs, no hand-written findings
kind: work                  # work | verify | gate
deps: [T25, T21]
owns: [scripts/demo_snapshot.sh, demo/snapshot/**, backend/cco/seed.py, backend/tests/test_seed_snapshot.py, Makefile, backend/cco/demo/**, backend/cco/api/demo.py, backend/cco/main.py, backend/tests/test_demo.py, backend/tests/data/snapshot/**]
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_seed_snapshot.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
---

# T26 — Real-run demo snapshot — reset restores validated live runs, no hand-written findings

## Goal

`make demo-reset` restores a demo database built from **real, validated live runs** of the three Wealthpilot bundles, not from the hand-written `contracts/fixtures` findings. Founder G2 comment 8; Opus critique blocker 1.

## Context

- Existing pieces: `cco audit` (backend/cco/cli/ci.py) writes `result.json`, `cco import` imports a CI result into the DB, `python -m cco.agent.check` scores a run against `expected.yaml`, `backend/cco/seed.py` seeds from `contracts/fixtures`, `make demo-reset` = `down -v` + db + seed.
- Settled: the backend stays as is apart from seed.py; `contracts/fixtures` stay unchanged because the tests and the contract use them.
- The W8 counsel review (not applicable, AI Act Art. 50) must still exist on 0.9.0 and carry forward to rc and 1.0.0, so 1.0.0 is READY and rc is REVIEW_REQUIRED or whatever its real run gives.
- Release provenance must be honest: `source: ci` only with a real run URL. Otherwise `source: ui` or `cli`, with `ci_run_url` and `pr_number` null. No fabricated links.

## Definition of done

- [ ] `scripts/demo_snapshot.sh` runs `cco audit` live on `demo/wealthpilot/{v0.9.0,rc,v1.0.0}/upload`, checks each result against `expected.yaml` (gate, plus every blocker/high conclusion), retries a release at most 2 times, and writes `demo/snapshot/{0.9.0,1.0.0-rc,1.0.0}/result.json` plus `demo/snapshot/MANIFEST.json` (model, date, scores). Proven by running it once (output in evidence).
- [ ] `python -m cco.seed --snapshot demo/snapshot` (or the equivalent flag) seeds the pack, the product and profile (confirmed), the three releases from the snapshot results with their activity events, and the W8 review. Proven by `tests/test_seed_snapshot.py::test_snapshot_seed_gates`: 0.9.0 NOT_READY with W1 and W2 blockers; 1.0.0 READY; no release with a ci_run_url unless source is ci.
- [ ] `make demo-reset` uses the snapshot when `demo/snapshot/MANIFEST.json` exists, and the fixtures otherwise. `make demo-snapshot` regenerates it.
- [ ] The committed snapshot has code evidence on 0.9.0 W1 or W2 (at least one code ref). Proven in the test.

## Tests

`backend/tests/test_seed_snapshot.py`, using the committed snapshot. No network.

## Out of scope

UI changes; changing the evaluator.
