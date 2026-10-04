import type { components } from "@/api/types";

export type FindingView = components["schemas"]["FindingView"];
export type Conclusion = FindingView["conclusion"];
export type Severity = FindingView["severity"];

/** Visual status key mapped to design.md palette names. */
export type StatusKey = "blocker" | "high" | "medium" | "evidence" | "uncertain" | "satisfied" | "na" | "low";

export function findingStatus(f: Pick<FindingView, "effective_conclusion" | "severity">): StatusKey {
  switch (f.effective_conclusion) {
    case "potential_violation":
      return f.severity === "blocker" ? "blocker" : f.severity === "high" ? "high" : "medium";
    case "insufficient_evidence": return "evidence";
    case "uncertain": return "uncertain";
    case "satisfied": return "satisfied";
    default: return "na";
  }
}

export const STATUS_LABEL: Record<StatusKey, string> = {
  blocker: "Blocker", high: "High", medium: "Medium", low: "Low",
  evidence: "Needs evidence", uncertain: "Uncertain", satisfied: "Verified", na: "N/A",
};

export const GATE_STYLE = {
  NOT_READY: "blocker", REVIEW_REQUIRED: "uncertain", READY: "satisfied",
} as const;

export const DOMAIN_LABEL: Record<string, string> = {
  licensing: "Licensing", suitability: "Suitability", data_protection: "Data protection",
  privacy: "Privacy", ai: "AI transparency", security: "Security", gdpr: "GDPR",
};
export const domainLabel = (d: string) =>
  DOMAIN_LABEL[d] ?? d.replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase());
