import os
from pathlib import Path

import pytest

os.environ.setdefault("CCO_DATABASE_URL", "sqlite://")
os.environ.setdefault("CCO_DEPLOY_TOKEN", "test-deploy-token")
os.environ.setdefault("CCO_MCP_TOKEN", "test-mcp-token")

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def fixtures_dir(repo_root) -> Path:
    return repo_root / "contracts" / "fixtures"
