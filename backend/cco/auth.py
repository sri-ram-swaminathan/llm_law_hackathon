"""Deploy-token bearer auth for /api/* (SPEC §6.13)."""

from __future__ import annotations

import hmac

from fastapi import HTTPException, Request

from . import config


def require_token(request: Request) -> None:
    expected = request.app.state.deploy_token
    header = request.headers.get("authorization", "")
    scheme, _, given = header.partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(given.strip().encode(), expected.encode()):
        raise HTTPException(401, "invalid or missing deploy token", headers={"WWW-Authenticate": "Bearer"})


def load_token() -> str:
    return config.deploy_token()
