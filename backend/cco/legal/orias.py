"""Deterministic ORIAS registration-number format check (live register lookup is off)."""

from __future__ import annotations

import re

_ORIAS_RE = re.compile(r"[0-9]{8}")


def orias_number_valid(s: str | None) -> bool:
    """True iff `s` is exactly 8 ASCII digits (no spaces, no prefix)."""
    return bool(s) and _ORIAS_RE.fullmatch(s) is not None
