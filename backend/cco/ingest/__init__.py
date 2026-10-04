"""Safe bundle ingestion (SPEC §6.6): zip or directory -> Release + Artifacts. Nothing is ever executed."""

from __future__ import annotations

import hashlib
import io
import os
import re
import stat
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts import Artifact, Release
from ..contracts.bundle import (
    EXCLUDED_GLOBS,
    MAX_COMPRESSED_BYTES,
    MAX_COMPRESSION_RATIO,
    MAX_FILES,
    MAX_UNCOMPRESSED_BYTES,
    Bundle,
    ProductEvidenceConfig,
    bundle_root,
)
from ..contracts.domain import CodeFile
from ..models import ArtifactRow, ReleaseRow
from ..redact import redact

PRODUCTS_DIR = Path(__file__).resolve().parents[3] / "data" / "products"


class BundleError(ValueError):
    """The upload is unsafe or malformed; maps to HTTP 400."""


# ------------------------------------------------------------------ config / globs


def load_product_config(product_id: str = "wealthpilot") -> ProductEvidenceConfig:
    p = PRODUCTS_DIR / f"{product_id}.yaml"
    if not p.is_file():
        raise BundleError(f"unknown product: {product_id}")
    return ProductEvidenceConfig.model_validate(yaml.safe_load(p.read_text()))


def _glob_re(pat: str) -> re.Pattern:
    out, i = "", 0
    while i < len(pat):
        if pat.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif pat.startswith("**", i):
            out += ".*"
            i += 2
        elif pat[i] == "*":
            out += "[^/]*"
            i += 1
        elif pat[i] == "?":
            out += "[^/]"
            i += 1
        else:
            out += re.escape(pat[i])
            i += 1
    return re.compile(out + r"\Z")


def _matches(path: str, pats: list[str]) -> bool:
    return any(_glob_re(p).match(path) for p in pats)


def _fn(pat: str, name: str) -> bool:
    return bool(_glob_re(pat).match(name))


def is_excluded(path: str) -> bool:
    """Secret-bearing / vendored / VCS paths that are dropped at ingestion (not rejected)."""
    parts = path.split("/")
    for g in EXCLUDED_GLOBS:
        if g.endswith("/"):
            if g[:-1] in parts[:-1]:
                return True
        elif _fn(g, parts[-1]):
            return True
    return False


# ------------------------------------------------------------------ collection


def _clean_path(name: str) -> str:
    if not name or "\\" in name or "\x00" in name:
        raise BundleError(f"unsafe path: {name!r}")
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        raise BundleError(f"absolute path in bundle: {name!r}")
    parts = PurePosixPath(name).parts
    if ".." in parts:
        raise BundleError(f"path traversal in bundle: {name!r}")
    return "/".join(p for p in parts if p != ".")


def _collect_zip(data: bytes | Path, files: dict[str, bytes], budget: dict, *, nested: bool = False) -> None:
    size = len(data) if isinstance(data, bytes) else data.stat().st_size
    if size > MAX_COMPRESSED_BYTES:
        raise BundleError("bundle exceeds the 50 MB compressed limit")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data) if isinstance(data, bytes) else data)
    except zipfile.BadZipFile as e:
        raise BundleError(f"not a valid zip: {e}") from e
    with zf:
        infos = zf.infolist()
        if len(infos) + budget["count"] > MAX_FILES:
            raise BundleError("bundle exceeds the 5000 file limit")
        declared = sum(i.file_size for i in infos)
        if declared + budget["bytes"] > MAX_UNCOMPRESSED_BYTES:
            raise BundleError("bundle exceeds the 200 MB uncompressed limit")
        if declared > max(size, 1) * MAX_COMPRESSION_RATIO:
            raise BundleError("compression ratio above 1:100 (zip bomb)")
        for i in infos:
            name = _clean_path(i.filename)  # validate everything, kept or not
            mode = i.external_attr >> 16
            if mode and (stat.S_ISLNK(mode) or stat.S_ISCHR(mode) or stat.S_ISBLK(mode)
                         or stat.S_ISFIFO(mode) or stat.S_ISSOCK(mode)):
                raise BundleError(f"symlink or special file in bundle: {i.filename!r}")
            if i.is_dir() or not name:
                continue
            budget["count"] += 1
            if is_excluded(name):
                continue
            # never trust the declared size: cap the actual read
            with zf.open(i) as fh:
                raw = fh.read(i.file_size + 1)
            if len(raw) > i.file_size:
                raise BundleError(f"size mismatch (zip bomb?): {i.filename!r}")
            budget["bytes"] += len(raw)
            if budget["bytes"] > MAX_UNCOMPRESSED_BYTES:
                raise BundleError("bundle exceeds the 200 MB uncompressed limit")
            if name == "code.zip" and not nested:
                # demo/UI upload layout: one zip holding code.zip + compliance/ — unpack one level only
                _collect_zip(raw, files, budget, nested=True)
                continue
            files[name] = raw


def _collect_dir(root: Path, files: dict[str, bytes], budget: dict) -> None:
    for dp, dns, fns in os.walk(root, followlinks=False):
        for n in list(dns):
            if (Path(dp) / n).is_symlink():
                raise BundleError(f"symlink in bundle: {n!r}")
        dns[:] = [n for n in dns if not is_excluded(f"{Path(dp, n).relative_to(root).as_posix()}/x")]
        for n in fns:
            p = Path(dp) / n
            rel = p.relative_to(root).as_posix()
            st = p.lstat()
            if not stat.S_ISREG(st.st_mode):
                raise BundleError(f"symlink or special file in bundle: {rel!r}")
            if rel == "code.zip":
                _collect_zip(p, files, budget)
                continue
            budget["count"] += 1
            if budget["count"] > MAX_FILES:
                raise BundleError("bundle exceeds the 5000 file limit")
            if is_excluded(rel):
                continue
            budget["bytes"] += st.st_size
            if budget["bytes"] > MAX_UNCOMPRESSED_BYTES:
                raise BundleError("bundle exceeds the 200 MB uncompressed limit")
            files[rel] = p.read_bytes()


def collect_files(src: Path | bytes) -> dict[str, bytes]:
    """Validate and read a bundle into {relative path: bytes}. Excluded files are dropped."""
    files: dict[str, bytes] = {}
    budget = {"count": 0, "bytes": 0}
    if isinstance(src, bytes) or (Path(src).is_file()):
        _collect_zip(src if isinstance(src, bytes) else Path(src), files, budget)
    elif Path(src).is_dir():
        _collect_dir(Path(src), files, budget)
    else:
        raise BundleError(f"bundle not found: {src}")
    return files


def _text(raw: bytes) -> str | None:
    """Decoded text, or None for binaries (dropped)."""
    if b"\x00" in raw:
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return None


# ------------------------------------------------------------------ ingest


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", s).strip("-")


def ingest_bundle(
    session: Session,
    src: Path | bytes,
    version: str,
    *,
    source: str = "ui",
    product_id: str = "wealthpilot",
    git_sha: str | None = None,
    branch: str | None = None,
    pr_number: int | None = None,
    ci_run_url: str | None = None,
    base: Path | None = None,
) -> tuple[Release, list[Artifact]]:
    """Create a Release and its Artifacts from a zip/dir bundle; writes redacted text under bundle_root."""
    if not version or _slug(version) != version:
        raise BundleError("invalid version")
    cfg = load_product_config(product_id)
    files = collect_files(src)
    texts: dict[str, str] = {}
    for path, raw in files.items():
        t = _text(raw)
        if t is not None:
            texts[path] = redact(t)  # binaries dropped; nothing unredacted is kept
    if not texts:
        raise BundleError("bundle has no readable text files")

    release_id = f"rel-{version}"
    if session.get(ReleaseRow, release_id) is not None:
        raise BundleError(f"release {version} already exists")
    prev = session.scalars(
        select(ReleaseRow).where(ReleaseRow.product_id == product_id).order_by(ReleaseRow.created_at.desc())
    ).first()
    now = datetime.now(timezone.utc)
    release = Release(
        id=release_id, product_id=product_id, version=version, source=source, git_sha=git_sha,  # type: ignore[arg-type]
        branch=branch, pr_number=pr_number, ci_run_url=ci_run_url,
        previous_release_id=prev.id if prev else None, created_at=now,
    )

    arts: list[Artifact] = []
    doc_paths = {d.path for d in cfg.documents}
    for d in cfg.documents:
        if d.path in texts:
            arts.append(Artifact(
                id=f"art-{version}-{_slug(Path(d.path).stem)}", release_id=release_id, kind=d.kind,
                path=d.path, text=texts[d.path], sha256=hashlib.sha256(texts[d.path].encode()).hexdigest(),
            ))
    # other compliance markdown that the config does not list is kept as "other"
    for p in sorted(texts):
        if p.startswith("compliance/") and p.endswith(".md") and p not in doc_paths:
            arts.append(Artifact(
                id=f"art-{version}-{_slug(Path(p).stem)}", release_id=release_id, kind="other", path=p,
                text=texts[p], sha256=hashlib.sha256(texts[p].encode()).hexdigest(),
            ))
    code = [
        CodeFile(path=p, content=texts[p])
        for p in sorted(texts)
        if _matches(p, cfg.code_globs) and not _matches(p, cfg.exclude_globs)
    ]
    h = hashlib.sha256()
    for c in code:
        h.update(c.path.encode() + b"\0" + c.content.encode() + b"\0")
    arts.append(Artifact(id=f"art-{version}-code", release_id=release_id, kind="code_repo", path="code",
                         files=code, sha256=h.hexdigest()))

    root = bundle_root(release_id, base)
    for p, t in texts.items():
        dest = root / p
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(t)

    session.add(ReleaseRow(id=release.id, product_id=product_id, version=version,
                           created_at=now.isoformat(), data=release.model_dump(mode="json")))
    session.flush()
    for a in arts:
        session.add(ArtifactRow(id=a.id, release_id=release_id, data=a.model_dump(mode="json")))
    session.flush()
    try:  # semantic index of the release (T24); best effort, never fails ingest
        from ..search import index_on_ingest

        index_on_ingest(session, release_id, base)
    except Exception:  # noqa: BLE001
        pass
    return release, arts


def bundle_info(release_id: str, base: Path | None = None) -> Bundle:
    b = Bundle.for_release(release_id, base)
    root = Path(b.root_path)
    if root.is_dir():
        fs = [p for p in root.rglob("*") if p.is_file()]
        b.file_count, b.total_bytes = len(fs), sum(p.stat().st_size for p in fs)
    return b
