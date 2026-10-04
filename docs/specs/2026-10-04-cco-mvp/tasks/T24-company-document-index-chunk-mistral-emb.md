---
id: T24
title: Company + legal indexes — chunk + mistral-embed, unified search API
kind: work                  # work | verify | gate
deps: [T04, T12]
owns: [backend/cco/api/__init__.py, backend/cco/search/**, backend/cco/api/search.py, backend/cco/main.py, backend/cco/ingest/**, backend/cco/legal/**, data/corpus-cache/**, data/legal-index/**, backend/tests/test_search.py, backend/tests/test_legal.py]                # work only: paths or globs this task may edit
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]              # preflight needs, e.g. env:OPENAI_API_KEY, kube:staging/ns, registry:host
verify: "cd backend && uv run pytest tests/test_search.py tests/test_ingest.py -q"
review: none                # none (merge on verify alone) | light (one review; only bugs in own files block)
status: done                   # todo | doing | review | done | blocked | skipped
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
- [ ] **Full legal index** (Roman: "both company index and the legal documents index"):
  - `python -m cco.legal.build_index` fetches the **full text** of GDPR (32016R0679), MiFID II (32014L0065), Del. Reg. 2017/565 (32017R0565) and the AI Act (32024R1689) from CELLAR.
  - It splits them by article (and paragraph where the structure allows), adds the existing CMF manual texts and the guidance excerpts, and embeds everything in batches.
  - The result is committed to `data/legal-index/` (compact `.npy` or float16 JSON, plus a metadata JSONL with id, act, article, title, `source_url`, `kind` law|guidance), about 400 chunks.
  - Existing cited provision ids in `data/corpus-cache` keep working.
  - · `test_search.py::test_legal_index_loads` (+ paste counts in Notes)
- [ ] **Legal search:** `cco.legal.search(query, k, kind=None)` and `related_provisions(id, k)` use the full index. Each hit carries act, article, `source_url` and kind. · `test_legal.py` keeps passing
- [ ] **Unified API:** `GET /api/search?q=&scope=company|legal|all&release_id=&k=` merges ranked hits, tagged with `source: company|legal`. · `test_search.py::test_unified_search`
- [ ] **Evaluator fallback hook** (not wired yet): `cco.search.retrieve_for_requirement(session, release_id, requirement, k=3)` builds a query from the requirement's `statement` + `evidence_needed`. It is used later behind `CCO_RETRIEVAL_FALLBACK=1`, after T20, if the golden check stays ≥ 9/10.
- [ ] **Live smoke:**
  - Index the v0.9.0 demo bundle. The query "data retention / deletion of user data" returns `PRODUCT_GUIDE.md` sections first.
  - Legal search for "personal recommendation investment advice" returns MiFID II Art. 4(1)(4) or CMF L.541-1 in the top 3.
  - · paste in Notes

## Tests

`test_search.py` (fake embedder, no network). `test_ingest.py` keeps passing.

## Out of scope

The UI search box (T19) and wiring the fallback into the evaluator (after T20).

## Notes
