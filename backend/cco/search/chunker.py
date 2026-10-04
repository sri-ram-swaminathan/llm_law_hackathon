"""Chunking of company documents (markdown) and code. Every chunk keeps path, 1-based line range and kind."""

from __future__ import annotations

import re
from dataclasses import dataclass

DOC_MAX = 1200  # chars per markdown chunk
DOC_OVERLAP = 150  # chars of trailing lines repeated at the start of the next chunk
CODE_WINDOW = 60  # lines per fixed window
CODE_OVERLAP = 5
CODE_MAX = 3000  # chars per code chunk

_HEADING = re.compile(r"^#{1,6}\s+(.*\S)")
_PY_TOP = re.compile(r"^(?:async\s+def|def|class)\s")
_JS_TOP = re.compile(r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\b|class\b|(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=)")


@dataclass
class Chunk:
    path: str
    start_line: int
    end_line: int
    kind: str  # doc | code
    text: str
    heading: str | None = None


def _split_long(lines: list[str], first: int, limit: int, overlap: int) -> list[tuple[int, int]]:
    """Greedy line ranges [start, end] (1-based, inclusive) of at most `limit` chars with trailing-line overlap."""
    out: list[tuple[int, int]] = []
    start, size = 0, 0
    i = 0
    while i < len(lines):
        ln = len(lines[i]) + 1
        if size and size + ln > limit:
            out.append((first + start, first + i - 1))
            back, acc = i, 0
            while back > start + 1 and acc + len(lines[back - 1]) + 1 <= overlap:
                back -= 1
                acc += len(lines[back]) + 1
            start, size = back, acc
            continue
        size += ln
        i += 1
    if start < len(lines):
        out.append((first + start, first + len(lines) - 1))
    return out


def chunk_markdown(path: str, text: str) -> list[Chunk]:
    lines = text.splitlines()
    sections: list[tuple[int, int, str | None]] = []  # 0-based [a, b) , heading
    cur, head = 0, None
    in_fence = False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
        m = None if in_fence else _HEADING.match(line)
        if m:
            if i > cur:
                sections.append((cur, i, head))
            cur, head = i, m.group(1)
    if cur < len(lines):
        sections.append((cur, len(lines), head))
    out: list[Chunk] = []
    for a, b, h in sections:
        seg = lines[a:b]
        if not "".join(seg).strip():
            continue
        for s, e in _split_long(seg, a + 1, DOC_MAX, DOC_OVERLAP):
            body = "\n".join(lines[s - 1 : e])
            if body.strip():
                out.append(Chunk(path, s, e, "doc", body, h))
    return out


def _top_level_starts(lines: list[str], path: str) -> list[int]:
    py = path.endswith(".py")
    pat = _PY_TOP if py else _JS_TOP
    starts: list[int] = []
    for i, line in enumerate(lines):
        if py and line.startswith("@") and (i == 0 or not lines[i - 1].startswith("@")):
            starts.append(i)
        elif pat.match(line) and not (py and i > 0 and lines[i - 1].startswith("@")):
            starts.append(i)
    return starts


def chunk_code(path: str, text: str) -> list[Chunk]:
    lines = text.splitlines()
    if not lines:
        return []
    structured = path.endswith((".py", ".js", ".jsx", ".ts", ".tsx", ".mjs"))
    starts = _top_level_starts(lines, path) if structured else []
    if starts:
        bounds = ([0] if starts[0] > 0 else []) + starts
        ranges = [(a, (bounds[j + 1] if j + 1 < len(bounds) else len(lines))) for j, a in enumerate(bounds)]
        # merge neighbouring small segments so tiny helpers do not become tiny chunks
        merged: list[list[int]] = []
        for a, b in ranges:
            size = sum(len(x) + 1 for x in lines[a:b])
            if merged and merged[-1][2] + size <= DOC_MAX:
                merged[-1][1], merged[-1][2] = b, merged[-1][2] + size
            else:
                merged.append([a, b, size])
        ranges = [(a, b) for a, b, _ in merged]
    else:
        ranges = [(0, len(lines))]
    out: list[Chunk] = []
    for a, b in ranges:
        seg = lines[a:b]
        if len(seg) <= CODE_WINDOW and sum(len(x) + 1 for x in seg) <= CODE_MAX:
            wins = [(a + 1, b)]
        else:
            wins = []
            step = CODE_WINDOW - CODE_OVERLAP
            for w in range(0, len(seg), step):
                wins.append((a + w + 1, a + min(w + CODE_WINDOW, len(seg))))
                if w + CODE_WINDOW >= len(seg):
                    break
        for s, e in wins:
            body = "\n".join(lines[s - 1 : e])
            if body.strip():
                out.append(Chunk(path, s, e, "code", body[:CODE_MAX * 2]))
    return out
