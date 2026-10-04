import type { FindingView } from "@/api/client";
import { missingLabel } from "@/features/check/model";

/** Risks filters (DESIGN §4.5). "Blocking" = in `readiness.blockers`; "Needs counsel" = uncertain and not yet decided. */
export const FILTERS = ["all", "blocking", "counsel", "compliant", "na"] as const;
export type Filter = (typeof FILTERS)[number];
export const FILTER_LABEL: Record<Filter, string> = { all: "All", blocking: "Blocking", counsel: "Needs counsel", compliant: "Compliant", na: "Not applicable" };

export function matches(f: Pick<FindingView, "requirement_id" | "effective_conclusion" | "conclusion" | "applicable_review">, filter: Filter, blockers: string[]): boolean {
  switch (filter) {
    case "blocking": return blockers.includes(f.requirement_id);
    case "counsel": return f.effective_conclusion === "uncertain" || (f.conclusion === "uncertain" && !f.applicable_review);
    case "compliant": return f.effective_conclusion === "satisfied";
    case "na": return f.effective_conclusion === "not_applicable";
    default: return true;
  }
}

export const filterCounts = (findings: Parameters<typeof matches>[0][], blockers: string[]) =>
  Object.fromEntries(FILTERS.map((k) => [k, findings.filter((f) => matches(f, k, blockers)).length])) as Record<Filter, number>;

/** "2 document clauses · 1 code location" or "Document missing: Privacy policy". */
export function evidenceSummary(f: Pick<FindingView, "evidence">): string {
  const ev = f.evidence ?? [];
  const docs = ev.filter((e) => e.type === "document_span").length;
  const code = ev.filter((e) => e.type === "code").length;
  const missing = ev.flatMap((e) => (e.type === "missing" ? [missingLabel(e.artifact_kind)] : []));
  const parts: string[] = [];
  if (docs) parts.push(`${docs} document ${docs === 1 ? "clause" : "clauses"}`);
  if (code) parts.push(`${code} code ${code === 1 ? "location" : "locations"}`);
  if (missing.length) parts.push(`Missing: ${missing.join(", ")}`);
  return parts.join(" · ") || "No evidence cited";
}
