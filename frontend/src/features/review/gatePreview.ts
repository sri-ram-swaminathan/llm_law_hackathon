import type { FindingView, Requirement } from "@/api/client";
import { effectiveConclusion, type Conclusion, type Decision, type Gate } from "@/lib/status";

/**
 * Pure port of the backend gate (backend/cco/gate.py `compute_readiness`, SPEC §6.3) over effective
 * conclusions, so counsel sees what a decision changes before recording it.
 */
export type GateResult = { gate: Gate; blockers: string[]; reviewed: number; total: number };

type F = Pick<FindingView, "id" | "requirement_id" | "severity" | "effective_conclusion" | "conclusion" | "applicable_review">;

export function computeGate(findings: F[], reqs: Map<string, Pick<Requirement, "mandatory">>): GateResult {
  let blockers: string[] = [];
  let reviewRequired = false;
  let reviewed = 0;
  for (const f of findings) {
    const eff = f.effective_conclusion;
    if (f.applicable_review) reviewed++;
    if (eff === "potential_violation") {
      if (f.severity === "blocker") blockers = [...blockers, f.requirement_id];
      else if (f.severity === "high") reviewRequired = true;
    } else if (eff === "insufficient_evidence" && reqs.get(f.requirement_id)?.mandatory) {
      blockers = [...blockers, f.requirement_id];
    } else if (eff === "uncertain" && !f.applicable_review) {
      reviewRequired = true;
    }
  }
  const gate: Gate = blockers.length ? "NOT_READY" : reviewRequired ? "REVIEW_REQUIRED" : "READY";
  return { gate, blockers, reviewed, total: findings.length };
}

/** Gate before → after applying a candidate decision to one finding. */
export function previewDecision(
  findings: F[], reqs: Map<string, Pick<Requirement, "mandatory">>, findingId: string, decision: Decision, override?: Conclusion | null,
): { before: GateResult; after: GateResult } {
  const before = computeGate(findings, reqs);
  const after = computeGate(
    findings.map((f) =>
      f.id === findingId
        ? { ...f, effective_conclusion: effectiveConclusion(f.conclusion, decision, override), applicable_review: f.applicable_review ?? ({} as never) }
        : f,
    ),
    reqs,
  );
  return { before, after };
}
