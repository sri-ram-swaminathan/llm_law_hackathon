"""Read-only view over an evidence bundle: the data the evaluator tools work on.

Everything is confined to the bundle root (no `..`, no symlink escapes, no secrets).
"""

from __future__ import annotations

import fnmatch
import json
from dataclasses import dataclass, field
from pathlib import Path

from cco.contracts.bundle import EXCLUDED_GLOBS
from cco.contracts.domain import ArtifactKind, LegalProvision

MAX_FILE_BYTES = 200 * 1024
MAX_GREP_HITS = 30
MAX_READ_LINES = 200
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}
TEXT_SUFFIXES = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".yaml", ".yml",
    ".toml", ".html", ".css", ".sh", ".ini", ".cfg", ".sql", ".conf", "",
}
_REPO_ROOT = Path(__file__).resolve().parents[3]
PROVISIONS_FIXTURE = _REPO_ROOT / "contracts" / "fixtures" / "provisions.json"


@dataclass
class ArtifactDoc:
    id: str
    kind: ArtifactKind
    path: str  # relative to the bundle root
    text: str


def load_provisions(path: Path | None = None) -> dict[str, LegalProvision]:
    data = json.loads((path or PROVISIONS_FIXTURE).read_text(encoding="utf-8"))
    return {p["id"]: LegalProvision.model_validate(p) for p in data["provisions"]}


class BundleError(ValueError):
    """Raised by tools for bad arguments; the message goes back to the model."""


@dataclass
class EvidenceBundle:
    root: Path
    artifacts: list[ArtifactDoc]
    code_artifact_id: str = "code"
    provisions: dict[str, LegalProvision] = field(default_factory=dict)
    _files: list[str] | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        self.root = Path(self.root).resolve()
        if not self.provisions:
            try:
                self.provisions = load_provisions()
            except OSError:
                self.provisions = {}

    # ------------------------------------------------------------ artifacts
    def artifact(self, ref: str) -> ArtifactDoc | None:
        for a in self.artifacts:
            if a.id == ref or a.path == ref:
                return a
        return None

    def kinds_present(self) -> set[str]:
        return {a.kind for a in self.artifacts if a.text.strip()} | {"code_repo"}

    # ------------------------------------------------------------ files
    def _excluded(self, rel: str) -> bool:
        parts = rel.split("/")
        if any(p in SKIP_DIRS for p in parts[:-1]):
            return True
        name = parts[-1]
        return any(fnmatch.fnmatch(name, g) for g in EXCLUDED_GLOBS if not g.endswith("/"))

    def code_files(self) -> list[str]:
        if self._files is None:
            files: list[str] = []
            for p in sorted(self.root.rglob("*")):
                if not p.is_file() or p.is_symlink():
                    continue
                rel = p.relative_to(self.root).as_posix()
                if self._excluded(rel) or p.suffix.lower() not in TEXT_SUFFIXES:
                    continue
                if p.stat().st_size > MAX_FILE_BYTES or rel.endswith("package-lock.json"):
                    continue
                files.append(rel)
            self._files = files
        return self._files

    def resolve(self, rel: str) -> Path:
        rel = rel.strip().removeprefix("./")
        if not rel or rel.startswith("/"):
            raise BundleError(f"path must be relative to the bundle root: {rel!r}")
        p = (self.root / rel).resolve()
        if p != self.root and self.root not in p.parents:
            raise BundleError(f"path escapes the bundle: {rel!r}")
        relp = p.relative_to(self.root).as_posix()
        if self._excluded(relp):
            raise BundleError(f"path is not readable: {rel!r}")
        return p

    def read_text(self, rel: str) -> str:
        p = self.resolve(rel)
        if not p.is_file():
            raise BundleError(f"no such file: {rel!r}")
        return p.read_text(encoding="utf-8", errors="replace")

    def match_globs(self, globs: list[str]) -> list[str]:
        out: list[str] = []
        for f in self.code_files():
            if any(fnmatch.fnmatch(f, g) for g in globs) and f not in out:
                out.append(f)
        return out

    # ------------------------------------------------------------ tools
    def read_artifact(self, artifact_id: str, section: str | None = None) -> str:
        a = self.artifact(artifact_id)
        if a is None:
            ids = ", ".join(x.id for x in self.artifacts) or "(none)"
            raise BundleError(f"unknown artifact {artifact_id!r}; known: {ids}")
        text = a.text
        if section:
            lines = text.splitlines()
            start = next(
                (i for i, ln in enumerate(lines) if ln.lstrip().startswith("#") and section.lower() in ln.lower()),
                None,
            )
            if start is None:
                raise BundleError(f"no heading containing {section!r} in {a.id}")
            level = len(lines[start]) - len(lines[start].lstrip("#"))
            end = len(lines)
            for j in range(start + 1, len(lines)):
                ln = lines[j]
                if ln.startswith("#") and (len(ln) - len(ln.lstrip("#"))) <= level:
                    end = j
                    break
            text = "\n".join(lines[start:end])
        return text[:20000]

    def grep_code(self, fixed_string: str, glob: str | None = None) -> str:
        if not fixed_string:
            raise BundleError("fixed_string must not be empty")
        needle = fixed_string.lower()
        hits: list[str] = []
        for f in self.code_files():
            if glob and not fnmatch.fnmatch(f, glob):
                continue
            try:
                lines = self.read_text(f).splitlines()
            except BundleError:
                continue
            for i, ln in enumerate(lines, 1):
                if needle in ln.lower():
                    hits.append(f"{f}:{i}: {ln.strip()[:200]}")
                    if len(hits) >= MAX_GREP_HITS:
                        return "\n".join(hits) + f"\n(truncated at {MAX_GREP_HITS} hits)"
        return "\n".join(hits) if hits else "no matches"

    def read_file(self, path: str, start: int = 1, end: int | None = None) -> str:
        lines = self.read_text(path).splitlines()
        start = max(1, start)
        end = min(len(lines), end if end is not None else start + MAX_READ_LINES - 1, start + MAX_READ_LINES - 1)
        if start > len(lines):
            raise BundleError(f"{path} has only {len(lines)} lines")
        return "\n".join(f"{i}: {lines[i - 1]}" for i in range(start, end + 1))

    def get_provision(self, provision_id: str) -> str:
        p = self.provisions.get(provision_id)
        if p is None:
            raise BundleError(f"unknown provision {provision_id!r}; known: {', '.join(sorted(self.provisions))}")
        ref = f"{p.act_title}, Art. {p.article}" + (f"({p.paragraph})" if p.paragraph else "")
        return f"[{p.id}] {ref}\n{p.text}"
