import type { FindingView, LegalProvision, Readiness, ReleaseOut, Requirement, RunSummary } from "@/api/client";
import { secondsBetween } from "@/lib/format";

/**
 * Pure derivations behind the Summary and the product hero (DESIGN §4.4). Every number comes from API data;
 * nothing here is invented, so the value line is as honest as the run it describes.
 */

/** Short display name of an act: "Regulation (EU) 2016/679 (GDPR)" → "GDPR", "Code monétaire et financier" → "CMF". */
export function shortAct(p: Pick<LegalProvision, "act_title" | "kind" | "issuer">): string {
  const t = p.act_title.trim();
  if (p.kind === "guidance") return p.issuer || t.split(/\s+/)[0];
  if (/^code mon[ée]taire et financier/i.test(t)) return "CMF";
  const paren = t.match(/\(([^()]+)\)\s*$/);
  if (paren && !/^EU$/i.test(paren[1])) return paren[1];
  const delreg = t.match(/delegated regulation \(EU\) (\d{4}\/\d+)/i);
  if (delreg) return `Del. Reg. ${delreg[1]}`;
  return t;
}

export type Checked = {
  documents: number;
  codeFiles: number;
  provisions: number;
  /** Binding acts, in first-cited order. */
  laws: string[];
  /** Guidance issuers (ESMA, AMF, CNIL…), shown apart: guidance interprets, it does not bind. */
  guidance: string[];
  requirements: number;
  outOfScope: number;
  seconds: number | null;
};

/** "What was checked": documents, code files, the union of cited provisions and their acts, run duration. */
export function checked(
  release: Pick<ReleaseOut, "artifacts" | "latest_assessment"> | undefined,
  findings: Pick<FindingView, "citations" | "effective_conclusion">[] | undefined,
  provisions: Map<string, LegalProvision | null | undefined>,
  readiness?: Pick<Readiness, "counts"> | null,
  run?: Pick<RunSummary, "started_at" | "ended_at" | "status"> | null,
): Checked {
  const arts = release?.artifacts ?? [];
  const ids: string[] = [];
  for (const f of findings ?? []) for (const c of f.citations ?? []) if (!ids.includes(c)) ids.push(c);
  const laws: string[] = [], guidance: string[] = [];
  for (const id of ids) {
    const p = provisions.get(id);
    if (!p) continue;
    const name = shortAct(p);
    const list = p.kind === "guidance" ? guidance : laws;
    if (!list.includes(name)) list.push(name);
  }
  const a = release?.latest_assessment;
  const seconds = run && run.status !== "running"
    ? secondsBetween(run.started_at, run.ended_at)
    : run ? null : secondsBetween(a?.started_at, a?.finished_at);
  return {
    documents: arts.filter((x) => x.kind !== "code_repo").length,
    codeFiles: arts.filter((x) => x.kind === "code_repo").reduce((n, x) => n + (x.files?.length ?? 0), 0),
    provisions: ids.length,
    laws,
    guidance,
    requirements: readiness?.counts.requirements_total ?? findings?.length ?? 0,
    outOfScope: (findings ?? []).filter((f) => f.effective_conclusion === "not_applicable").length,
    seconds: seconds ?? null,
  };
}

const PROBLEMS = new Set<FindingView["effective_conclusion"]>(["potential_violation", "insufficient_evidence"]);

export type Changes = { resolved: string[]; new: string[]; unchanged: string[] };

/** Diff of two releases' findings by requirement (same rule as the backend's `compute_changes`). */
export function whatChanged(
  base: Pick<FindingView, "requirement_id" | "effective_conclusion">[],
  current: Pick<FindingView, "requirement_id" | "effective_conclusion">[],
): Changes {
  const was = new Map(base.map((f) => [f.requirement_id, f.effective_conclusion]));
  const out: Changes = { resolved: [], new: [], unchanged: [] };
  for (const f of current) {
    const before = was.get(f.requirement_id);
    const bad = PROBLEMS.has(f.effective_conclusion);
    if (bad && !(before && PROBLEMS.has(before))) out.new.push(f.requirement_id);
    else if (before && PROBLEMS.has(before) && !bad) out.resolved.push(f.requirement_id);
    else out.unchanged.push(f.requirement_id);
  }
  const order = new Map(base.map((f, i) => [f.requirement_id, i]));
  out.resolved.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return out;
}

/** Fix-plan counts from the pack's remediation parts of open findings: code → code changes, the rest → founder actions. */
export function fixCounts(findings: Pick<FindingView, "requirement_id" | "effective_conclusion">[], reqs: Map<string, Requirement>) {
  let code = 0, founder = 0;
  for (const f of findings) {
    if (!PROBLEMS.has(f.effective_conclusion) && f.effective_conclusion !== "uncertain") continue;
    for (const p of reqs.get(f.requirement_id)?.remediation?.parts ?? []) (p.kind === "code" ? code++ : founder++);
  }
  return { code, founder };
}

/** Breakdown of `readiness.blockers` (the same list the count comes from). */
export function blockerBreakdown(blockers: string[], findings: Pick<FindingView, "requirement_id" | "effective_conclusion">[]) {
  const by = new Map(findings.map((f) => [f.requirement_id, f.effective_conclusion]));
  let violations = 0, missing = 0, other = 0;
  for (const id of blockers) {
    const c = by.get(id);
    if (c === "potential_violation") violations++;
    else if (c === "insufficient_evidence") missing++;
    else other++;
  }
  return { violations, missing, other };
}
