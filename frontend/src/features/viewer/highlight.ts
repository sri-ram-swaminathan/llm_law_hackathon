import type { CSSProperties } from "react";
import type { FindingView } from "@/api/client";
import { findingStatus, type StatusKey } from "@/lib/status";

/** One highlighted range in a document (character offsets) or a code file (1-based inclusive lines). */
export type DocHighlight = { start: number; end: number; findingId: string; title: string; status: StatusKey };
export type LineHighlight = { startLine: number; endLine: number; findingId: string; title: string; status: StatusKey };

const RANK: Record<StatusKey, number> = { blocker: 0, high: 1, medium: 2, low: 3, evidence: 4, uncertain: 5, satisfied: 6, na: 7 };
export const moreSevere = (a: StatusKey, b: StatusKey) => (RANK[a] <= RANK[b] ? a : b);
export const statusRank = (s: StatusKey) => RANK[s];

const colorVar = (s: StatusKey) => `var(--${s === "low" ? "medium" : s}-fg)`;

/** Inline style for a mark / code band. `active` = the finding currently open in the workspace. */
export function markStyle(status: StatusKey, active: boolean): CSSProperties {
  const c = colorVar(status);
  return {
    background: `color-mix(in srgb, ${c} ${active ? 30 : 14}%, transparent)`,
    boxShadow: `inset 0 -2px 0 ${c}`,
    outline: active ? `1.5px solid color-mix(in srgb, ${c} 70%, transparent)` : undefined,
    outlineOffset: active ? 1 : undefined,
  };
}
export function bandStyle(status: StatusKey, active: boolean): CSSProperties {
  const c = colorVar(status);
  return {
    background: `color-mix(in srgb, ${c} ${active ? 18 : 9}%, transparent)`,
    boxShadow: `inset 3px 0 0 ${c}`,
  };
}

export function docHighlights(findings: FindingView[], artifactId: string): DocHighlight[] {
  const out: DocHighlight[] = [];
  for (const f of findings) {
    for (const e of f.evidence ?? []) {
      if (e.type === "document_span" && e.artifact_id === artifactId && e.start != null && e.end != null && e.end > e.start) {
        out.push({ start: e.start, end: e.end, findingId: f.id, title: f.title, status: findingStatus(f) });
      }
    }
  }
  return out;
}

export function lineHighlights(findings: FindingView[], artifactId: string, path: string): LineHighlight[] {
  const out: LineHighlight[] = [];
  for (const f of findings) {
    for (const e of f.evidence ?? []) {
      if (e.type === "code" && e.artifact_id === artifactId && e.path === path) {
        out.push({ startLine: e.start_line, endLine: e.end_line, findingId: f.id, title: f.title, status: findingStatus(f) });
      }
    }
  }
  return out;
}

export const KIND_LABEL: Record<string, string> = {
  business_plan: "Business plan", product_spec: "Product spec", privacy_policy: "Privacy policy",
  terms: "Terms of service", regulatory_registration: "Regulatory registration", code_repo: "Code repository", other: "Other",
};
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

export const EXPECTED_KINDS = ["business_plan", "product_spec", "privacy_policy", "terms", "regulatory_registration", "code_repo"] as const;
