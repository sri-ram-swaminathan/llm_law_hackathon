---
id: T16
title: `cco audit` / `import` / `export-baseline`, PR comment, eval harness
kind: work
deps: [G1, T06, T10, T12, T14]
owns: [backend/cco/cli/**, backend/cco/eval/**, demo/wealthpilot/injection/**, backend/tests/test_ci.py]
repo: .
needs: [cmd:uv]
verify: cd backend && uv run pytest tests/test_ci.py -q
review: none
status: done
---

# T16 — `cco audit` / `import` / `export-baseline`, PR comment, eval harness

## Goal

Run CCOmmit headless for CI and for the golden eval, and import CI results into the local app.

## Context

SPEC §6.8 CLI, §6.12 (exit codes 1/0/2, marker `<!-- ccommit-check -->`, release naming, baseline carry-forward), §6.9, AC4, AC13a, D14. `cli/spike.py` (T06) stays and becomes a subcommand.

## Definition of done

- [ ] `cco audit --bundle … --version … --sha … --baseline … --out out/` writes `result.json`, `comment.md` and `fix-plan.md`. It exits 1/0/2 per the gate or an engine error (scripted model + fixture bundles). · `test_ci.py::test_exit_codes`
- [ ] `comment.md` equals the snapshot generated from `expected.yaml` for the partial state. · `test_ci.py::test_comment_snapshot`
- [ ] `cco export-baseline <version>` and `cco import <result.json|zip>`. The imported release shows `source: ci`. · `test_ci.py::test_import_roundtrip`
- [ ] `cco eval wealthpilot --runs N` runs live assessments of v0.9.0, the rc and v1.0.0, with the W8 review seeded. It compares **all** requirements to `expected.yaml`, includes the injection fixture, and prints a pass rate and the total time. · used by V3 (AC4)

## Tests

`test_ci.py`.
