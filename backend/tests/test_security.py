import io
import os
import stat
import zipfile

import pytest

from cco.db import session_scope
from cco.ingest import BundleError, collect_files, ingest_bundle

FAKE_KEY = "sk-" + "a1B2c3D4e5F6g7H8i9J0k1L2m3"


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CCO_DATA_DIR", str(tmp_path))


def zbytes(entries, compress=zipfile.ZIP_DEFLATED) -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w", compress) as z:
        for e in entries:
            if isinstance(e, zipfile.ZipInfo):
                z.writestr(e, "target")
            else:
                z.writestr(*e)
    return b.getvalue()


@pytest.mark.parametrize("name", ["../evil.py", "/etc/passwd", "a/../../b.py", "C:/x.py"])
def test_path_traversal_rejected(name):
    with pytest.raises(BundleError):
        collect_files(zbytes([(name, "x")]))


def test_symlink_and_device_rejected():
    for mode in (stat.S_IFLNK, stat.S_IFCHR):
        zi = zipfile.ZipInfo("link")
        zi.external_attr = (mode | 0o777) << 16
        with pytest.raises(BundleError):
            collect_files(zbytes([zi]))


def test_zip_bomb_ratio():
    with pytest.raises(BundleError, match="ratio"):
        collect_files(zbytes([("a.txt", "0" * 5_000_000)]))


def test_too_many_files():
    with pytest.raises(BundleError, match="5000"):
        collect_files(zbytes([(f"f{i}.txt", "x") for i in range(5001)], zipfile.ZIP_STORED))


def test_dir_symlink_rejected(tmp_path):
    d = tmp_path / "b"
    d.mkdir()
    (d / "ok.md").write_text("x")
    os.symlink("/etc/passwd", d / "link.md")
    with pytest.raises(BundleError):
        collect_files(d)


def test_excluded_files_dropped_and_secret_redacted(tmp_path):
    key_pem = "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----"
    data = zbytes([
        ("backend/app/main.py", f'API_KEY = "{FAKE_KEY}"\nx = 1\n'),
        (".env", "SECRET=1"), (".env.local", "A=1"), ("k.pem", key_pem), ("deploy.key", "k"),
        ("id_rsa", "k"), ("frontend/node_modules/x/index.js", "x"), (".git/config", "x"),
        ("logo.png", "\x00\x01binary"),
        ("compliance/business-plan.md", "# plan"),
    ])
    files = collect_files(data)
    assert set(files) == {"backend/app/main.py", "logo.png", "compliance/business-plan.md"}
    with session_scope("sqlite://") as s:
        _, arts = ingest_bundle(s, data, "9.9.9")
    code = next(a for a in arts if a.kind == "code_repo")
    assert [f.path for f in code.files] == ["backend/app/main.py"]
    assert FAKE_KEY not in code.files[0].content and "[REDACTED]" in code.files[0].content
    on_disk = (tmp_path / "bundles" / "rel-9.9.9" / "backend/app/main.py").read_text()
    assert FAKE_KEY not in on_disk
    assert not (tmp_path / "bundles" / "rel-9.9.9" / "logo.png").exists()
