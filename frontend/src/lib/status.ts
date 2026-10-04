import type { components } from "@/api/types";

/**
 * Status vocabulary seam (DESIGN §4.5, frozen by T27). Trust surfaces never show raw enums:
 * every conclusion/severity/gate word comes from here.
 *
 *   effective_conclusion   → statusWord      tone
 *   potential_violation    → "Violation"     blocker | high | medium (by severity; low → medium)
 *   insufficient_evidence  → "Missing evidence"  evidence
 *   uncertain              → "Needs counsel"     uncertain
 *   satisfied              → "Compliant"         satisfied
 *   not_applicable         → "Not applicable"    na
 *
 * The chip reads `chipLabel(f)` = "Violation · Blocker" (severity only for violations).
 */

export type FindingView = components["schemas"]["FindingView"];
export type Conclusion = FindingView["conclusion"];
export type Severity = FindingView["severity"];
export type Gate = components["schemas"]["Readiness"]["gate"];
export type Decision = components["schemas"]["Review"]["decision"];

/** Visual tone key; each maps to the `--{key}-fg/bg/bd` CSS triplet ("low" reuses medium). */
export type StatusKey = "blocker" | "high" | "medium" | "evidence" | "uncertain" | "satisfied" | "na" | "low";

export const CONCLUSIONS: Conclusion[] = ["potential_violation", "insufficient_evidence", "uncertain", "satisfied", "not_applicable"];
export const SEVERITIES: Severity[] = ["blocker", "high", "medium", "low"];

export const STATUS_WORD: Record<Conclusion, string> = {
  potential_violation: "Violation",
  insufficient_evidence: "Missing evidence",
  uncertain: "Needs counsel",
  satisfied: "Compliant",
  not_applicable: "Not applicable",
};
export const SEVERITY_TAG: Record<Severity, string> = { blocker: "Blocker", high: "High", medium: "Medium", low: "Low" };
export const DECISION_WORD: Record<Decision, string> = {
  confirm: "Confirmed", override: "Overridden", not_applicable: "Not applicable", need_evidence: "Needs evidence",
};

export const statusWord = (c: Conclusion) => STATUS_WORD[c];
export const severityTag = (s: Severity) => SEVERITY_TAG[s];

/** Tone of a (conclusion, severity) pair. */
export function statusTone(c: Conclusion, s: Severity): StatusKey {
  switch (c) {
    case "potential_violation": return s === "blocker" ? "blocker" : s === "high" ? "high" : "medium";
    case "insufficient_evidence": return "evidence";
    case "uncertain": return "uncertain";
    case "satisfied": return "satisfied";
    default: return "na";
  }
}

/** Tone of a finding, from its effective (counsel-applied) conclusion. */
export const findingStatus = (f: Pick<FindingView, "effective_conclusion" | "severity">): StatusKey =>
  statusTone(f.effective_conclusion, f.severity);

/** "Violation · Blocker" | "Missing evidence" | "Needs counsel" | "Compliant" | "Not applicable". */
export function chipLabel(c: Conclusion, s: Severity): string {
  return c === "potential_violation" ? `${STATUS_WORD[c]} · ${SEVERITY_TAG[s]}` : STATUS_WORD[c];
}
export const findingChipLabel = (f: Pick<FindingView, "effective_conclusion" | "severity">) => chipLabel(f.effective_conclusion, f.severity);

/** Open = still needs work: anything but Compliant / Not applicable (Risks tab count). */
export const isOpen = (f: Pick<FindingView, "effective_conclusion">) =>
  f.effective_conclusion !== "satisfied" && f.effective_conclusion !== "not_applicable";

/** Severity order, most severe first: sort with `(a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b]`. */
export const SEVERITY_RANK: Record<Severity, number> = { blocker: 0, high: 1, medium: 2, low: 3 };
/** Status order for rows: violation, missing evidence, needs counsel, compliant, n/a. */
export const CONCLUSION_RANK: Record<Conclusion, number> = {
  potential_violation: 0, insufficient_evidence: 1, uncertain: 2, satisfied: 3, not_applicable: 4,
};
export const compareFindings = (a: Pick<FindingView, "severity" | "effective_conclusion">, b: typeof a) =>
  CONCLUSION_RANK[a.effective_conclusion] - CONCLUSION_RANK[b.effective_conclusion] || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];

/** Effective conclusion after a counsel decision (SPEC §6.3; mirrors the backend). */
export function effectiveConclusion(ai: Conclusion, d: Decision, override?: Conclusion | null): Conclusion {
  return d === "confirm" ? ai : d === "override" ? override ?? ai : d === "not_applicable" ? "not_applicable" : "insufficient_evidence";
}

/** Tone-key label (legacy chips that only know a tone). Prefer `chipLabel`. */
export const STATUS_LABEL: Record<StatusKey, string> = {
  blocker: "Blocker", high: "High", medium: "Medium", low: "Low",
  evidence: "Missing evidence", uncertain: "Needs counsel", satisfied: "Compliant", na: "Not applicable",
};

/** Gate → tone. The gate *word* is always `readiness.gate_label` verbatim; `GATE_WORD` is only the fallback. */
export const GATE_STYLE = { NOT_READY: "blocker", REVIEW_REQUIRED: "uncertain", READY: "satisfied" } as const satisfies Record<Gate, StatusKey>;
export const GATE_WORD: Record<Gate, string> = { NOT_READY: "Not ready", REVIEW_REQUIRED: "Review required", READY: "Ready" };

/** Labels every gate surface carries (verbatim from `readiness.labels` when present). */
export const AI_LABEL = "AI pre-assessment, not legal advice";
export const counselReviewedLabel = (c: { reviewed: number; total: number }) => `Counsel-reviewed ${c.reviewed}/${c.total}`;

/** @deprecated use `categoryOf` / `CATEGORY` from lib/categories.ts. */
export { domainLabel, DOMAIN_LABEL } from "./categories";
