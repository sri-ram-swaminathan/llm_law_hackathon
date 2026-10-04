---
id: T24
title: Company-document index — chunk + mistral-embed at ingest, evidence search API
kind: work                  # work | verify | gate
deps: [T04, T12]
owns: [backend/cco/search/**, backend/cco/api/search.py, backend/cco/main.py, backend/cco/ingest/**, backend/tests/test_search.py]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_search.py tests/test_ingest.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: todo                   # todo | doing | review | done | blocked | skipped
---

# T24 — Company-document index — chunk + mistral-embed at ingest, evidence search API

## Goal

Build a semantic index of each release's company documents and code (Roman, 4 Oct: "build the index for documents with embeddings for our organization"). It powers evidence search in the UI and an optional retrieval fallback for the evaluator.

## Context

- **Embeddings:** `mistral-embed`, 1024 dims, 60 req/min. One request takes a *list* of inputs, so batch 32–64 chunks per call.
- **Storage:** Postgres + pgvector when available; vectors in a JSON column on SQLite. Same approach as `cco.legal` (T04), which does in-memory cosine search.
- **Ingest:** `cco.ingest.ingest_bundle` (T12) creates the artifacts. Hook indexing in at the end of ingest.
  - If `MISTRAL_API_KEY` is unset or the call fails, skip with a warning; ingest must never fail because of indexing.
  - Seeded fixture releases get indexed lazily on first search.
- **Router registration:** the `ROUTERS` list in `backend/cco/main.py` (one-line addition).
- **Settled:** R3 (the audit uses evidence hints first; retrieval is a fallback only), D15 and D16.

## Definition of done

- [ ] **Chunker:**
  - Markdown is split by heading/section (≤ ~1,200 chars, small overlap).
  - Code is split by top-level def/class/component (Python, JS/JSX) or by fixed line windows.
  - Each chunk keeps `artifact_id`, `path`, `start_line`, `end_line` and `kind` (doc/code).
  - · `test_search.py::test_chunking`
- [ ] **Index:** `cco.search.index_release(session, release_id)` embeds in batches with 429 backoff and stores the vectors. It is idempotent per release (keyed by artifact sha256). · `test_search.py::test_index_idempotent` (fake embedder)
- [ ] **Search:** `cco.search.search_evidence(session, release_id, query, k=5, kind=None)` returns ranked hits with path, lines, snippet and score. · `test_search.py::test_search_ranks` (fake vectors)
- [ ] **API:** `GET /api/releases/{id}/search?q=&k=&kind=` returns the same hits as `search_evidence`. · `test_search.py::test_endpoint`
- [ ] **Evaluator fallback hook** (not wired yet): `cco.search.retrieve_for_requirement(session, release_id, requirement, k=3)` builds a query from the requirement's `statement` + `evidence_needed`. It is used later behind `CCO_RETRIEVAL_FALLBACK=1`, after T20, if the golden check stays ≥ 9/10.
- [ ] **Live smoke:** index the v0.9.0 demo bundle for real. The query "data retention / deletion of user data" returns `PRODUCT_GUIDE.md` sections first. · paste in Notes

## Tests

`test_search.py` (fake embedder, no network). `test_ingest.py` keeps passing.

## Out of scope

The UI search box (T19) and wiring the fallback into the evaluator (after T20).

## Notes
