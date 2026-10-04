import type { Readiness } from "@/api/client";
import type { StatusKey } from "@/lib/status";

/** Gate presentation: READY without full counsel review is "Ready (AI)" (dashed), counsel-reviewed READY is solid. */
export function gateView(r: Readiness): { label: string; status: StatusKey; dashed: boolean; sub: string } {
  const { reviewed, total } = r.counsel_reviewed;
  if (r.gate === "NOT_READY") return { label: "Not ready", status: "blocker", dashed: false, sub: "Resolve the blockers before launch." };
  if (r.gate === "REVIEW_REQUIRED") return { label: "Review required", status: "uncertain", dashed: false, sub: "Counsel needs to review open items." };
  const full = total > 0 && reviewed >= total;
  return { label: full ? "Ready" : "Ready (AI)", status: "satisfied", dashed: !full, sub: full ? "Counsel-reviewed. No open blockers." : "No open blockers. Counsel review still pending." };
}
