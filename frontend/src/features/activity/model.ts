import type { AgentEvent } from "@/api/client";

/** A timeline row. Paired events (tool_call+tool_result, model_request+model_response) collapse into one row. */
export type Row = {
  id: string;
  kind: AgentEvent["type"];
  seq: number;
  requirementId: string | null;
  summary: string;
  tool?: string | null;
  input?: string | null;
  output?: string | null;
  latencyMs?: number | null;
  tokens?: number | null;
  attempt?: number | null;
  error?: string | null;
  done: boolean; // false while a call is awaiting its result
};

export type Group = {
  key: string;
  kind: "setup" | "requirement" | "wrapup";
  requirementId: string | null;
  rows: Row[];
  finished: boolean;
};

export type Counters = {
  requirements: number;
  requirementsTotal: number;
  modelCalls: number;
  toolCalls: number;
  retries: number;
  elapsedMs: number;
  ended: boolean;
};

const rowOf = (e: AgentEvent): Row => ({
  id: `${e.seq}`,
  kind: e.type,
  seq: e.seq,
  requirementId: e.requirement_id ?? null,
  summary: e.summary,
  tool: e.tool,
  input: e.input_preview,
  output: e.output_preview,
  latencyMs: e.latency_ms,
  tokens: e.tokens,
  attempt: e.attempt,
  error: e.error,
  done: true,
});

/** Collapse call/result pairs into single rows, preserving order of the first event of each pair. */
export function toRows(events: AgentEvent[]): Row[] {
  const rows: Row[] = [];
  const openTool = new Map<string, Row>();
  const openModel = new Map<string, Row>();
  for (const e of events) {
    if (e.type === "tool_call") {
      const r = rowOf(e);
      r.done = false;
      rows.push(r);
      openTool.set(`${e.requirement_id}|${e.tool}`, r);
    } else if (e.type === "tool_result") {
      const k = `${e.requirement_id}|${e.tool}`;
      const r = openTool.get(k);
      if (r) {
        r.output = e.output_preview ?? r.output;
        r.latencyMs = e.latency_ms;
        r.error = e.error;
        r.done = true;
        if (e.summary && r.summary === r.tool) r.summary = e.summary;
        openTool.delete(k);
      } else rows.push(rowOf(e));
    } else if (e.type === "model_request") {
      const r = rowOf(e);
      r.done = false;
      rows.push(r);
      openModel.set(`${e.requirement_id}|${e.attempt}`, r);
    } else if (e.type === "model_response") {
      const k = `${e.requirement_id}|${e.attempt}`;
      const r = openModel.get(k);
      if (r) {
        r.output = e.output_preview;
        r.latencyMs = e.latency_ms;
        r.tokens = (r.tokens ?? 0) + (e.tokens ?? 0);
        r.error = e.error;
        r.done = true;
        openModel.delete(k);
      } else rows.push(rowOf(e));
    } else rows.push(rowOf(e));
  }
  return rows;
}

/**
 * Group by step (run setup -> per requirement -> wrap-up), then by requirement.
 * Run-level events before the first requirement event are "setup"; run-level events after the last are "wrap-up".
 */
export function groupRows(events: AgentEvent[]): Group[] {
  const rows = toRows(events);
  const lastReqSeq = rows.reduce((m, r) => (r.requirementId ? Math.max(m, r.seq) : m), 0);
  const groups: Group[] = [];
  const byReq = new Map<string, Group>();
  const setup: Group = { key: "setup", kind: "setup", requirementId: null, rows: [], finished: false };
  const wrap: Group = { key: "wrapup", kind: "wrapup", requirementId: null, rows: [], finished: false };
  for (const r of rows) {
    if (r.requirementId) {
      let g = byReq.get(r.requirementId);
      if (!g) {
        g = { key: r.requirementId, kind: "requirement", requirementId: r.requirementId, rows: [], finished: false };
        byReq.set(r.requirementId, g);
      }
      g.rows.push(r);
      if (r.kind === "finding") g.finished = true;
    } else (r.seq > lastReqSeq && lastReqSeq > 0 ? wrap : setup).rows.push(r);
  }
  if (setup.rows.length) groups.push(setup);
  groups.push(...byReq.values());
  if (wrap.rows.length) groups.push(wrap);
  for (const g of groups) if (g.kind !== "requirement") g.finished = g.rows.every((r) => r.done) && (g.kind === "setup" ? groups.length > 1 : g.rows.some((r) => r.kind === "run_end"));
  return groups;
}

export function counters(events: AgentEvent[]): Counters {
  let total = 0;
  const done = new Set<string>();
  let modelCalls = 0, toolCalls = 0, retries = 0, ended = false;
  for (const e of events) {
    if (e.type === "scope" && !e.requirement_id) {
      const m = /(\d+)\s+requirements? loaded/.exec(e.summary);
      if (m) total = Number(m[1]);
    }
    if (e.type === "finding" && e.requirement_id) done.add(e.requirement_id);
    if (e.type === "model_request") modelCalls++;
    if (e.type === "tool_call") toolCalls++;
    if (e.type === "retry") retries++;
    if (e.type === "run_end") ended = true;
  }
  const t = (e?: AgentEvent) => (e ? Date.parse(e.ts) : 0);
  const elapsedMs = events.length ? Math.max(0, t(events[events.length - 1]) - t(events[0])) : 0;
  return { requirements: done.size, requirementsTotal: Math.max(total, done.size), modelCalls, toolCalls, retries, elapsedMs, ended };
}

/** Wait between two recorded events when replaying: recorded gap, long idle stretches clamped, divided by speed. */
export const MAX_GAP_MS = 2500;
export function gapMs(prev: Pick<AgentEvent, "ts">, next: Pick<AgentEvent, "ts">, speed: number): number {
  const d = Date.parse(next.ts) - Date.parse(prev.ts);
  return Math.min(Math.max(Number.isFinite(d) ? d : 0, 0), MAX_GAP_MS) / Math.max(speed, 0.25);
}

export const fmtElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** "W3 insufficient_evidence (high): ..." -> { conclusion, severity } for the finding chip. */
export function parseFindingSummary(s: string) {
  const m = /\b(satisfied|potential_violation|insufficient_evidence|not_applicable|uncertain)\s*\((blocker|high|medium|low)\)/.exec(s);
  return m ? { conclusion: m[1], severity: m[2] } : null;
}

export const prettyJson = (s: string | null | undefined) => {
  if (!s) return "";
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
};
