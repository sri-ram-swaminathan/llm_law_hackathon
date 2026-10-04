# Légifrance manual sources

Hand-curated French texts (Légifrance pages saved as PDF by Roman), ingested by `python -m cco.legal.ingest` with `source: manual`.

| Provision id | File | In force since | Used by |
|---|---|---|---|
| `cmf-l541-1` | `CMF-L541-1.{pdf,md}` | 2019-05-24 | W1 |
| `cmf-l546-1` | `CMF-L546-1.{pdf,md}` | 2021-12-24 | W1 |

## TODO

- [ ] **CMF L.321-1** (definition of "conseil en investissement", point 5; referenced by L.541-1 I 1°). Not yet provided: save the Légifrance page as `CMF-L321-1.pdf`, write `CMF-L321-1.md` with the same front matter as the other files, and add `cmf-l321-1` to `MANUAL_FR` in `backend/cco/legal/seed.py`.
- [ ] Article-level LEGIARTI ids and live Légifrance API (stretch, AC8b).
