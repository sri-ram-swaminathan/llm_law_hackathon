# CCOmmit

**An AI Chief Compliance Officer for startups.** CCOmmit reads a company's documents and code, checks both against EU and French law, and answers one question: *can we launch this release?*

Every finding quotes the company's own text or code lines next to the official legal text. Release PRs get a GitHub check that comments on the faulty lines.

- **Jury guide** (run it, what works, what doesn't): [docs/JURY.md](docs/JURY.md)
- **Reproducing the results** (tests, scores, snapshot, legal index, CI red → green): [docs/REPRODUCE.md](docs/REPRODUCE.md)
- **Live GitHub check** on the demo company: [PR #4](https://github.com/RomanGrebnev/FinTechProto/pull/4)
- **Demo company code:** [RomanGrebnev/FinTechProto](https://github.com/RomanGrebnev/FinTechProto) (fictional)

```bash
cp .env.example .env   # MISTRAL_API_KEY optional, only for live runs
make up                # web http://127.0.0.1:20001 (token: dev-token) · api http://127.0.0.1:20000/docs
```

Stack: Python 3.12, FastAPI, PydanticAI with Mistral (Codestral, mistral-embed), Postgres + pgvector, React + Vite.

AI pre-assessment, not legal advice.
