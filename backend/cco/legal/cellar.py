"""CELLAR (EU Publications Office) provider: fetch XHTML by CELEX, split by article/paragraph."""

from __future__ import annotations

import re
from datetime import UTC, datetime

import httpx
from lxml import html as lhtml

from cco.contracts.domain import LegalProvision

CELLAR_URL = "http://publications.europa.eu/resource/celex/{celex}"
_HEADERS = {"Accept": "application/xhtml+xml, text/html", "Accept-Language": "eng"}
_PARA_ID = re.compile(r"^\d+\.\d+$")
_PARA_NO = re.compile(r"^\s*(\d+)\.\s")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def node_text(el) -> str:
    """Readable text of an element: <p> = one line, table rows = cells joined by a space."""
    lines: list[str] = []
    for child in el:
        tag = child.tag if isinstance(child.tag, str) else ""
        if tag == "p":
            t = _norm(child.text_content())
            if t:
                lines.append(t)
        elif tag == "table":
            for tr in child.iter("tr"):
                t = _norm(" ".join(_norm(td.text_content()) for td in tr.findall("td")))
                if t:
                    lines.append(t)
        elif tag == "div":
            t = node_text(child)
            if t:
                lines.append(t)
    return "\n".join(lines)


def split_article(xhtml: str | bytes, article: str) -> dict[str, str]:
    """Return {paragraph_number: text} for one article ("1" -> text). Raises KeyError if absent.

    Articles without numbered paragraphs come back as {"1": full text}.
    """
    root = lhtml.fromstring(xhtml)
    arts = root.xpath(f'//*[@id="art_{article}"]')
    if not arts:
        raise KeyError(f"article {article} not found")
    art = arts[0]
    paras: dict[str, str] = {}
    for i, div in enumerate(art.xpath("./div[@id]"), start=1):
        if not _PARA_ID.match(div.get("id", "")):
            continue
        text = node_text(div)
        m = _PARA_NO.match(text)
        key = m.group(1) if m else str(i)
        paras[key] = text
    if not paras:
        paras["1"] = node_text(art)
    return paras


def article_title(xhtml: str | bytes, article: str) -> str | None:
    root = lhtml.fromstring(xhtml)
    t = root.xpath(f'//*[@id="art_{article}.tit_1"]')
    return _norm(t[0].text_content()) if t else None


def extract_point(text: str, point: str) -> str:
    """Extract definition/point "(n)" from a paragraph text, up to the next "(n+1)"."""
    n = int(point)
    m = re.search(rf"(?:^|\s)\({n}\)\s", text)
    if not m:
        raise KeyError(f"point ({n}) not found")
    start = m.start() + (1 if text[m.start()].isspace() else 0)
    nxt = re.search(rf"\s\({n + 1}\)\s", text[start:])
    end = start + nxt.start() if nxt else len(text)
    return text[start:end].strip()


def select(paras: dict[str, str], paragraph: str | None) -> str:
    """paragraph: None (whole article), "2", or "1(4)" (point 4 of paragraph 1)."""
    if paragraph is None:
        return "\n".join(paras.values())
    m = re.fullmatch(r"(\d+)(?:\((\d+)\))?", paragraph)
    if not m:
        raise KeyError(f"bad paragraph ref {paragraph}")
    text = paras[m.group(1)]
    return extract_point(text, m.group(2)) if m.group(2) else text


class CellarProvider:
    def __init__(self, client: httpx.Client | None = None, timeout: float = 120.0):
        self._client = client or httpx.Client(timeout=timeout, follow_redirects=True)
        self._docs: dict[str, bytes] = {}

    def fetch(self, celex: str) -> bytes:
        if celex not in self._docs:
            r = self._client.get(CELLAR_URL.format(celex=celex), headers=_HEADERS)
            r.raise_for_status()
            self._docs[celex] = r.content
        return self._docs[celex]

    def get_provision(
        self,
        celex: str,
        article: str,
        paragraph: str | None = None,
        *,
        id: str | None = None,
        act_title: str = "",
        jurisdiction: str = "EU",
        celex_field: str | None = None,
    ) -> LegalProvision:
        paras = split_article(self.fetch(celex), article)
        text = select(paras, paragraph)
        return LegalProvision(
            id=id or f"{celex}-art{article}" + (f"-{paragraph}" if paragraph else ""),
            kind="law",
            source="cellar",
            jurisdiction=jurisdiction,
            act_title=act_title,
            celex=celex_field or celex,
            article=article,
            paragraph=paragraph,
            text=text,
            source_url=CELLAR_URL.format(celex=celex),
            retrieved_at=datetime.now(UTC),
        )
