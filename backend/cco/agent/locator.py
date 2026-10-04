"""Tolerant quote locator (SPEC §3).

Small models often quote Python string literals that are split across lines, e.g.
    DISCLAIMER = ("...only. "
                  "This is not financial advice. ...")
as one run of text. We therefore compare against two normalized forms of the
haystack (and of the quote), each keeping a map back to original offsets:

  1. `ws`:      whitespace collapsed.
  2. `literal`: quote characters removed (this also removes the `" "` joins between
                adjacent string literals), then whitespace collapsed.

Exact substring match first; otherwise a rapidfuzz partial-ratio alignment >= 0.9.
"""

from __future__ import annotations

from dataclasses import dataclass

from rapidfuzz import fuzz

THRESHOLD = 90.0
MIN_QUOTE_LEN = 6
_QUOTE_CHARS = set("\"'`“”‘’")


@dataclass(frozen=True)
class Match:
    start: int  # offsets into the original text
    end: int
    score: float  # 0..100
    form: str  # "ws" | "literal"


def _normalize(text: str, drop_quotes: bool) -> tuple[str, list[int]]:
    """Return (normalized, idx) where idx[i] is the original offset of normalized[i]."""
    out: list[str] = []
    idx: list[int] = []
    prev_space = True  # also strips leading whitespace
    for i, ch in enumerate(text):
        if drop_quotes and ch in _QUOTE_CHARS:
            continue
        if ch.isspace():
            if prev_space:
                continue
            out.append(" ")
            idx.append(i)
            prev_space = True
        else:
            out.append(ch)
            idx.append(i)
            prev_space = False
    while out and out[-1] == " ":
        out.pop()
        idx.pop()
    return "".join(out), idx


def locate(text: str, quote: str) -> Match | None:
    """Locate `quote` in `text`; return original [start, end) offsets or None."""
    if not quote or not quote.strip():
        return None
    best: Match | None = None
    for form, drop in (("ws", False), ("literal", True)):
        nq, _ = _normalize(quote, drop)
        if len(nq) < MIN_QUOTE_LEN:
            continue
        nt, idx = _normalize(text, drop)
        if not nt:
            continue
        pos = nt.find(nq)
        if pos >= 0:
            s, e, score = pos, pos + len(nq), 100.0
        else:
            al = fuzz.partial_ratio_alignment(nq, nt, score_cutoff=THRESHOLD)
            if al is None or al.score < THRESHOLD:
                continue
            s, e, score = al.dest_start, al.dest_end, float(al.score)
        if e <= s:
            continue
        if score < 100.0:  # fuzzy windows can start/end mid-word: snap outwards to word edges
            while s > 0 and nt[s - 1].isalnum() and nt[s].isalnum():
                s -= 1
            while e < len(nt) and nt[e].isalnum() and nt[e - 1].isalnum():
                e += 1
        m = Match(start=idx[s], end=idx[e - 1] + 1, score=score, form=form)
        if best is None or m.score > best.score:
            best = m
        if score == 100.0:
            break
    return best


def line_range(text: str, start: int, end: int) -> tuple[int, int]:
    """1-based inclusive line numbers covering [start, end)."""
    first = text.count("\n", 0, start) + 1
    last = text.count("\n", 0, max(start, end - 1)) + 1
    return first, last
