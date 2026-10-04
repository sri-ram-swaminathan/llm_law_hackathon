"""mistral-embed (1024 dims; 60 req/min, so batch and pace)."""

from __future__ import annotations

import os
import time

import httpx

MODEL = "mistral-embed"
URL = "https://api.mistral.ai/v1/embeddings"
MAX_CHARS = 6000


def _key() -> str:
    key = os.environ.get("MISTRAL_API_KEY")
    if not key:
        from dotenv import find_dotenv, load_dotenv

        load_dotenv(find_dotenv(usecwd=True))
        key = os.environ.get("MISTRAL_API_KEY")
    if not key:
        raise RuntimeError("MISTRAL_API_KEY is not set")
    return key


def embed_texts(texts: list[str], batch: int = 16, pause: float = 1.5) -> list[list[float]]:
    out: list[list[float]] = []
    headers = {"Authorization": f"Bearer {_key()}"}
    with httpx.Client(timeout=60) as c:
        for i in range(0, len(texts), batch):
            chunk = [t[:MAX_CHARS] for t in texts[i : i + batch]]
            for attempt in range(4):
                r = c.post(URL, headers=headers, json={"model": MODEL, "input": chunk})
                if r.status_code == 429:
                    time.sleep(5 * (attempt + 1))
                    continue
                r.raise_for_status()
                break
            out.extend(d["embedding"] for d in sorted(r.json()["data"], key=lambda d: d["index"]))
            if i + batch < len(texts):
                time.sleep(pause)
    return out
