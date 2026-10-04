import type { Artifact, FindingView, LegalProvision } from "@/api/client";

/** Pure helpers of the compliance check (DESIGN §4.6). */

/** "Carried from v0.9.0" only when the decision came from another release (critique 10). */
export function carriedLabel(f: Pick<FindingView, "carried_from_version">, version: string): string | null {
  const c = f.carried_from_version?.replace(/^v/, "");
  return c && c !== version.replace(/^v/, "") ? `Carried from v${c}` : null;
}

const KIND_LABEL: Record<Artifact["kind"], string> = {
  business_plan: "Business plan", product_spec: "Product spec", privacy_policy: "Privacy policy", terms: "Terms",
  regulatory_registration: "Regulatory registration", code_repo: "Code", other: "Document",
};
/** "Business plan" · "Product guide" (from the file name when the kind is generic). */
export function artifactLabel(a: Pick<Artifact, "kind" | "path"> | undefined, kind?: Artifact["kind"]): string {
  if (!a) return KIND_LABEL[kind ?? "other"];
  if (a.kind === "product_spec" || a.kind === "other") {
    const base = a.path.split("/").pop()!.replace(/\.[a-z]+$/i, "").replace(/[_-]+/g, " ").toLowerCase();
    return base.replace(/^./, (c) => c.toUpperCase());
  }
  return KIND_LABEL[a.kind];
}
export const missingLabel = (kind: Artifact["kind"]) => KIND_LABEL[kind];

const clean = (s: string) => s.replace(/[*_`>#]+/g, "").replace(/\s+/g, " ");

/** The clause around a quote: nearest preceding heading, ±`pad` chars of context, the quote itself. */
export function clause(text: string, quote: string, start?: number | null, end?: number | null, pad = 120) {
  let s = start ?? -1;
  if (s < 0 || text.slice(s, s + quote.length) !== quote) s = text.indexOf(quote);
  if (s < 0) return { heading: null as string | null, before: "", quote, after: "" };
  const e = end && end > s ? end : s + quote.length;
  const head = [...text.slice(0, s).matchAll(/^#{1,6}\s+(.+)$/gm)].pop()?.[1] ?? null;
  let b = Math.max(0, s - pad), a = Math.min(text.length, e + pad);
  const nl = text.lastIndexOf("\n\n", s);
  if (nl > b) b = nl + 2;
  const nr = text.indexOf("\n\n", e);
  if (nr >= 0 && nr < a) a = nr;
  return {
    heading: head ? clean(head).trim() : null,
    before: (b > 0 && text[b - 1] !== "\n" ? "…" : "") + clean(text.slice(b, s)).replace(/^\s+/, ""),
    quote: clean(text.slice(s, e)),
    after: clean(text.slice(e, a)).replace(/\s+$/, "") + (a < text.length && text[a] !== "\n" ? "…" : ""),
  };
}

/** "Art. 4(1)(4)" · "Art. L541-1 (I)" · "General guideline 2". */
export function articleLabel(p: Pick<LegalProvision, "article" | "paragraph">): string {
  const art = /^(\d|L\d|R\d|D\d)/.test(p.article) ? `Art. ${p.article}` : p.article;
  if (!p.paragraph) return art;
  return /^\d/.test(p.paragraph) ? `${art}${p.paragraph.replace(/^(\d+)/, "($1)")}` : `${art} (${p.paragraph})`;
}

export const confidenceWord = (v: number) => (v >= 0.8 ? "high" : v >= 0.5 ? "medium" : "low");

export function sourceLabel(p: Pick<LegalProvision, "source" | "source_url">): string {
  if (p.source === "cellar") return "EUR-Lex";
  if (p.source === "legifrance") return "Légifrance";
  try {
    const h = new URL(p.source_url).host.replace(/^www\./, "");
    return h.includes("legifrance") ? "Légifrance" : h.includes("europa.eu") ? "EUR-Lex" : h;
  } catch { return "Official text"; }
}
