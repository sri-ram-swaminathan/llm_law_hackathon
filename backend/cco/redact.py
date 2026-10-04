"""Secret redactor (key-shaped regexes plus Shannon entropy). Shared by ingestion and agent events."""

from __future__ import annotations

import math
import re

REDACTED = "[REDACTED]"

_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S),
    re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"),  # JWT
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]{16,}"),
]
_URL_CREDS = re.compile(r"(?i)\b([a-z][a-z0-9+.\-]*://)[^\s:/@]+:[^\s@/]+@")
# NAME = "value" where NAME looks secret-bearing
_ASSIGN = re.compile(
    r"""(?ix)
    (\b[A-Za-z0-9_.\-]*(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|credential)[A-Za-z0-9_.\-]*\b
    \s*[:=]\s*["']?)([^\s"'#,;]{6,})"""
)
_CANDIDATE = re.compile(r"[A-Za-z0-9+/=_\-]{24,}")


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in (s.count(ch) for ch in set(s)))


def _entropy_sub(m: re.Match) -> str:
    tok = m.group(0)
    has_mix = any(c.isdigit() for c in tok) and any(c.isalpha() for c in tok)
    if has_mix and shannon_entropy(tok) >= 4.0:
        return REDACTED
    return tok


_ENV_LOOKUP = re.compile(r"(?i)^(os\.|process\.env|getenv|environ|settings\.|config\.|import\.meta\.env)")


def _assign_sub(m: re.Match) -> str:
    value = m.group(2)
    # Code that *reads* a secret (os.getenv(...), settings.X, f(...)) is not a secret value: keep it,
    # otherwise evidence like `secret = os.getenv("JWT_SECRET", "")` turns into a fake hard-coded secret.
    if "(" in value or "[" in value or _ENV_LOOKUP.match(value):
        return m.group(0)
    return m.group(1) + REDACTED


def redact(text: str) -> str:
    if not text:
        return text
    for p in _PATTERNS:
        text = p.sub(REDACTED, text)
    text = _URL_CREDS.sub(lambda m: m.group(1) + REDACTED + "@", text)
    text = _ASSIGN.sub(_assign_sub, text)
    return _CANDIDATE.sub(_entropy_sub, text)
