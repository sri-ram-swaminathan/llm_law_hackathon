"""Environment configuration. Loads the repo-root .env if present; never logs secrets."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

log = logging.getLogger("cco")

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "contracts" / "fixtures"
DEFAULT_DEPLOY_TOKEN = "dev-token"
CORS_ORIGINS = ["http://localhost:20001", "http://127.0.0.1:20001"]

load_dotenv(REPO_ROOT / ".env", override=False)


def database_url() -> str:
    return os.environ.get("CCO_DATABASE_URL", "postgresql+psycopg://cco:cco@127.0.0.1:20002/cco")


def deploy_token() -> str:
    tok = os.environ.get("CCO_DEPLOY_TOKEN")
    if not tok:
        log.warning("CCO_DEPLOY_TOKEN is not set; using the insecure default %r", DEFAULT_DEPLOY_TOKEN)
        return DEFAULT_DEPLOY_TOKEN
    return tok


def mcp_token() -> str | None:
    return os.environ.get("CCO_MCP_TOKEN") or None
