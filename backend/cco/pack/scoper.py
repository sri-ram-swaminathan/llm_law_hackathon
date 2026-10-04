"""Deterministic scoping: evaluate each requirement's `applies_when` over the regulatory profile."""

from __future__ import annotations

import ast
from typing import NamedTuple

from cco.contracts.domain import RegulatoryProfile, Requirement

from .loader import Pack, load_pack

_FIELDS = ("jurisdictions", "industry", "activities", "customer_types", "data_categories", "ai_uses", "stage")
_ALLOWED_NODES = (
    ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.Compare, ast.In, ast.NotIn,
    ast.Eq, ast.NotEq, ast.Gt, ast.GtE, ast.Lt, ast.LtE, ast.Constant, ast.Name, ast.Load, ast.Call,
    ast.List, ast.Tuple,
)


class ScopeResult(NamedTuple):
    requirement: Requirement
    applicable: bool
    reason: str
    applicability_confidence: float


def evaluate_applies_when(expr: str, profile: RegulatoryProfile) -> bool:
    """Evaluate a restricted expression: names are profile fields, `len()` is the only call."""
    tree = ast.parse(expr, mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError(f"unsupported syntax in applies_when {expr!r}: {type(node).__name__}")
        if isinstance(node, ast.Name) and node.id not in _FIELDS and node.id != "len":
            raise ValueError(f"unknown profile field {node.id!r} in applies_when {expr!r}")
        if isinstance(node, ast.Call) and not (isinstance(node.func, ast.Name) and node.func.id == "len"):
            raise ValueError(f"only len() may be called in applies_when {expr!r}")
    env = {f: getattr(profile, f) for f in _FIELDS}
    return bool(eval(compile(tree, "<applies_when>", "eval"), {"__builtins__": {}, "len": len}, env))  # noqa: S307


def scope(profile: RegulatoryProfile, pack: Pack | None = None) -> list[ScopeResult]:
    """One entry per requirement in pack order. Out-of-scope ones become not_applicable findings upstream."""
    pack = pack or load_pack()
    out: list[ScopeResult] = []
    for req in pack.requirements:
        applicable = evaluate_applies_when(req.applies_when, profile)
        if applicable:
            reason = f"Profile satisfies: {req.applies_when}"
        else:
            reason = f"Profile does not satisfy: {req.applies_when} (activities: {', '.join(profile.activities) or 'none'})"
        out.append(ScopeResult(req, applicable, reason, 1.0))
    return out
