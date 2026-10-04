---
id: T04
title: Legal layer — CELLAR, curated cache, guidance, embeddings
kind: work
deps: [T01]
owns: [backend/cco/legal/**, data/corpus-cache/**, data/sources/**, backend/tests/test_legal.py]
repo: .
needs: [cmd:uv, env:MISTRAL_API_KEY@.env]
verify: cd backend && uv run pytest tests/test_legal.py -q -m "not integration"
review: none
status: todo
---

# T04 — Legal layer: CELLAR, curated cache, guidance, embeddings

## Goal

Every provision the pack cites can be served offline from a committed cache, with official source URLs. Guidance is marked separately from law.

## Context

SPEC §6.5 (seed corpus table), D6, D20.

**CELLAR:** REST by CELEX with `Accept: application/xhtml+xml` and `Accept-Language: eng`. Verified on 4 Oct for `32016R0679`, `02016R0679-20160504`, `32014L0065`, `32017R0565` and `32024R1689`.

**French texts:** `data/sources/legifrance/CMF-L541-1.md` and `CMF-L546-1.md` already exist (provided by Roman).
- L.321-1 isn't provided. Leave a TODO entry in `data/sources/legifrance/README.md`.

**Guidance:** curate short excerpts.
- ESMA35-43-3172 (suitability guidelines; PDF at esma.europa.eu, checked 4 Oct).
- AMF pages on CIF status.
- CNIL pages on information notices and the right to erasure.

Each excerpt is stored with `kind: guidance`, `issuer` and `source_url`.

The provision IDs the pack needs are listed in T01's fixtures (`citations`).

## Definition of done

- [ ] `CellarProvider.get_provision(celex, article, paragraph?)` fetches and splits a document by article and paragraph. · `test_legal.py::test_cellar_split` (uses a saved XHTML sample, offline)
- [ ] `python -m cco.legal.ingest` fills `data/corpus-cache/` with every provision cited in the fixtures and pack. Each is stored as JSON with `text`, `source_url`, `retrieved_at` and `kind`, including the manual CMF articles and the guidance excerpts. The output is committed. · `test_legal.py::test_cache_complete`
- [ ] `CorpusCache` serves every cached provision with no network access. · `test_legal.py::test_offline`
- [ ] Embeddings (`mistral-embed`, 1024 dims) are computed by the ingest step and stored in the cache files. `search(q)` ranks by cosine in memory, and Postgres + pgvector is used when available. · `test_legal.py::test_search_ranks` (with fake vectors)
- [ ] A deterministic ORIAS format check, `orias_number_valid(s)` (exactly 8 digits), is exposed for the evaluator. · `test_legal.py::test_orias_format`
- [ ] The live CELLAR call is marked `@pytest.mark.integration`. · `test_legal.py::test_cellar_live`

## Tests

`test_legal.py`.

## Out of scope

Live Légifrance (AC8b, stretch), and the UI drawer (T08).
