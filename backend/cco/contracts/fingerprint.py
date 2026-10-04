"""evidence_fingerprint (SPEC §6.2): sha256 of the sorted (path, quote) pairs of a finding's
evidence plus the sorted kinds of its `missing` refs. Paths (not artifact ids) are used so the
fingerprint survives across releases."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping

from .domain import CodeRef, DocumentSpanRef, MissingRef


def evidence_fingerprint(
    evidence: Iterable[DocumentSpanRef | CodeRef | MissingRef],
    artifact_paths: Mapping[str, str],
) -> str:
    pairs: list[list[str]] = []
    missing: list[str] = []
    for ref in evidence:
        if isinstance(ref, MissingRef):
            missing.append(ref.artifact_kind)
        elif isinstance(ref, CodeRef):
            pairs.append([ref.path, ref.quote])
        else:
            pairs.append([artifact_paths.get(ref.artifact_id, ref.artifact_id), ref.quote])
    payload = {"pairs": sorted(pairs), "missing": sorted(missing)}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
