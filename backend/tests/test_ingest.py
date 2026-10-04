import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cco.contracts import CiResult, ReleaseFixture
from cco.db import session_scope
from cco.ingest import ingest_bundle
from cco.main import create_app

H = {"Authorization": "Bearer test-deploy-token"}
DEMO = Path(__file__).resolve().parents[2] / "demo" / "wealthpilot"


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path))
    return tmp_path


def make_zip(files: dict[str, str]) -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w", zipfile.ZIP_DEFLATED) as z:
        for k, v in files.items():
            z.writestr(k, v)
    return b.getvalue()


FIX = {
    "backend/app/main.py": "print('hi')\n",
    "frontend/src/App.jsx": "export default 1\n",
    "README.md": "# demo\n",
    "docs/PRODUCT_GUIDE.md": "# guide\n",
    "compliance/business-plan.md": "# plan\n",
    "compliance/terms.md": "# terms\n",
}


def test_ingest_fixture_bundle(tmp_path):
    with session_scope("sqlite://") as s:
        rel, arts = ingest_bundle(s, make_zip(FIX), "0.9.0")
        kinds = {a.path: a.kind for a in arts}
        assert rel.id == "rel-0.9.0"
        assert kinds["compliance/business-plan.md"] == "business_plan"
        assert kinds["compliance/terms.md"] == "terms"
        assert kinds["docs/PRODUCT_GUIDE.md"] == "product_spec"
        code = next(a for a in arts if a.kind == "code_repo")
        assert {f.path for f in code.files} >= {"backend/app/main.py", "frontend/src/App.jsx", "README.md"}
        assert (tmp_path / "bundles" / "rel-0.9.0" / "compliance" / "terms.md").is_file()


def test_demo_bundles_dir():
    up = DEMO / "v1.0.0" / "upload"
    if not up.is_dir():
        pytest.skip("demo bundles not built")
    with session_scope("sqlite://") as s:
        _, arts = ingest_bundle(s, up, "1.0.0")
    kinds = {a.kind for a in arts}
    assert {"regulatory_registration", "privacy_policy", "terms", "business_plan", "code_repo"} <= kinds


def test_endpoints():
    with TestClient(create_app("sqlite://")) as c:
        r = c.post("/api/releases", headers=H, data={"version": "0.9.1"},
                   files={"bundle": ("b.zip", make_zip(FIX), "application/zip")})
        assert r.status_code == 201, r.text
        assert r.json()["release"]["version"] == "0.9.1"
        dup = c.post("/api/releases", headers=H, data={"version": "0.9.1"},
                     files={"bundle": ("b.zip", make_zip(FIX), "application/zip")})
        assert dup.status_code == 409
        bad = c.post("/api/releases", headers=H, data={"version": "0.9.2"},
                     files={"bundle": ("b.zip", make_zip({"../x": "y"}), "application/zip")})
        assert bad.status_code == 400
        assert c.post("/api/releases", data={"version": "1"}, files={"bundle": ("b.zip", b"x")}).status_code == 401

        # import a CI result (json and zipped)
        fx = Path(__file__).resolve().parents[2] / "contracts" / "fixtures" / "release-1.0.0-rc.json"
        f = ReleaseFixture.model_validate_json(fx.read_text())
        res = CiResult(exit_code=1, release=f.release.model_copy(update={"id": "rel-ci", "version": "ci-1", "source": "ci"}),
                       assessment=f.assessment.model_copy(update={"release_id": "rel-ci"}),
                       findings=f.findings, reviews=[], readiness=f.readiness)
        body = res.model_dump_json().encode()
        r = c.post("/api/releases/import", headers=H, files={"result": ("result.json", body)})
        assert r.status_code == 201, r.text
        assert r.json()["release"]["id"] == "rel-ci"
        res2 = res.model_copy(update={"release": res.release.model_copy(update={"id": "rel-ci2", "version": "ci-2"})})
        assert c.post("/api/releases/import", headers=H,
                      files={"result": ("a.zip", make_zip({"out/result.json": res2.model_dump_json()}))}).status_code == 409
        assert c.post("/api/releases/import", headers=H, files={"result": ("result.json", body)}).status_code == 409
    with TestClient(create_app("sqlite://")) as c2:  # zipped artifact form, fresh DB
        r = c2.post("/api/releases/import", headers=H,
                    files={"result": ("a.zip", make_zip({"out/result.json": body.decode()}))})
        assert r.status_code == 201, r.text
        assert c.post("/api/releases/import", headers=H, files={"result": ("r.json", b"{}")}).status_code == 422
