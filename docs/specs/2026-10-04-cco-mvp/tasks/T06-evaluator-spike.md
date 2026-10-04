---
id: T06
title: Evaluator agent, quote locator and `cco spike`
kind: work
deps: [T01]
owns: [backend/cco/agent/**, backend/cco/cli/__init__.py, backend/cco/cli/spike.py, backend/tests/test_locator.py, backend/tests/test_evaluator.py]
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]
verify: cd backend && uv run pytest tests/test_locator.py tests/test_evaluator.py -q
review: none
status: todo
---

# T06 — Evaluator agent, quote locator and `cco spike`

## Goal

Build the PydanticAI evaluator for a single requirement against an evidence bundle, with validated quotes. Prove it live on W1–W3: this is the midpoint risk check (B4).

## Context

SPEC §3 (small models, tolerant locator), §6.4 (steps 5–7, tools, validation, `UsageLimits` = 6, `output_retries` = 2, prompt-injection framing), D4, D16.

**Models:** from `CCO_MODEL_EVAL` (default `codestral-latest`) via the PydanticAI Mistral provider. Codestral was verified on 4 Oct for strict JSON schema and tool calls.

**Severity is never taken from the model.**

**Inputs:** `cco spike` takes the FinTechProto checkout path and the git ref, and reads the requirements from T01's fixtures. The pack (T05) arrives in parallel, so it isn't used yet.

## Definition of done

- [ ] **Quote locator:** two normalized forms (whitespace collapsed; string-literal joins and quote characters removed), fuzzy match ≥ 0.9, returning offsets or line ranges. · `test_locator.py`. Include the `config.py:10-14` split-string case.
- [ ] **Evaluator:** read-only tools `read_artifact`, `grep_code` (fixed string), `read_file` and `get_provision`, confined to the bundle root. The output validator raises `ModelRetry` with error text. Exhausted retries or tool limits give `uncertain` + `validation_notes`. · `test_evaluator.py` (PydanticAI `FunctionModel`: bad quote → retry → ok; 3× bad → `uncertain`; tool limit → `uncertain`)
- [ ] **Events:** emitted through a callback interface (`on_event(AgentEvent)`) for T11 to persist. Types: `model_request`, `model_response`, `tool_call`, `tool_result`, `retry`, `finding`. · `test_evaluator.py::test_events_emitted`
- [ ] **`cco spike --repo ../FinTechProto --ref dbb8e64 --req W1,W2,W3`** prints one line per requirement (`conclusion` and located evidence) plus a match against `expected.yaml`. · run in V1 (live)

## Tests

`test_locator.py`, `test_evaluator.py` (no network).

## Out of scope

Running all requirements, DB persistence and the API (T10).
