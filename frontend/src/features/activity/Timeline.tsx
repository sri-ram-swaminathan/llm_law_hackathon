import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Bot, Brain, CheckCheck, ChevronRight, Flag, Layers, ListChecks, Loader2, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AgentEvent } from "@/api/client";
import { StatusChip } from "@/components/status-chip";
import { aliasOf, reqIndex, useRequirements } from "@/lib/queries";
import { GATE_STYLE, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { groupRows, parseFindingSummary, prettyJson, type Group, type Row } from "./model";

const KIND_ICON: Partial<Record<Row["kind"], typeof Bot>> = {
  step: Layers, scope: ListChecks, model_request: Brain, model_response: Brain,
  tool_call: Wrench, tool_result: Wrench, retry: AlertTriangle, finding: CheckCheck, gate: Flag, run_end: Flag,
};

const conclusionStatus = (c: string, sev: string): StatusKey =>
  c === "potential_violation" ? (sev === "blocker" ? "blocker" : sev === "high" ? "high" : "medium")
    : c === "insufficient_evidence" ? "evidence" : c === "uncertain" ? "uncertain" : c === "satisfied" ? "satisfied" : "na";

function Json({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-text-3">{label}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-surface-2 p-2 font-mono text-[11px] leading-relaxed text-text-2">{prettyJson(value)}</pre>
    </div>
  );
}

function RowView({ row }: { row: Row }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[row.kind] ?? Bot;
  const expandable = !!(row.input || row.output) && (row.kind === "tool_call" || row.kind === "model_request" || row.kind === "tool_result");
  const retry = row.kind === "retry";
  const fin = row.kind === "finding" ? parseFindingSummary(row.summary) : null;
  const gate = row.kind === "gate" ? /Gate (NOT_READY|REVIEW_REQUIRED|READY)/.exec(row.summary)?.[1] : undefined;
  const pending = !row.done;

  const head = (
    <>
      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
        retry ? "border-medium-bd bg-medium-bg text-medium-fg" : "bg-surface-2 text-text-2")}>
        {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-label="running" /> : <Icon className="h-3 w-3" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("block text-[13px] leading-snug", retry ? "text-medium-fg" : "text-text")}>
          {row.tool && (row.kind === "tool_call" || row.kind === "tool_result") && <span className="mr-1.5 font-mono text-[12px] text-accent">{row.tool}</span>}
          {row.summary !== row.tool && row.summary}
        </span>
        {row.kind === "tool_call" && row.input && !open && (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-text-3">{row.input}</span>
        )}
        {retry && row.error && <span className="mt-1 block break-words rounded-md border border-medium-bd bg-medium-bg px-2 py-1.5 font-mono text-[11px] leading-relaxed text-medium-fg">{row.error}</span>}
        {fin && <span className="mt-1 inline-block"><StatusChip status={conclusionStatus(fin.conclusion, fin.severity)} label={`${fin.conclusion.replace(/_/g, " ")} · ${fin.severity}`} /></span>}
        {gate && <span className="mt-1 inline-block"><StatusChip status={GATE_STYLE[gate as keyof typeof GATE_STYLE]} label={gate.replace(/_/g, " ").toLowerCase()} /></span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-mono text-[11px] tabular-nums text-text-3">
        {row.attempt != null && row.kind.startsWith("model") && <span>try {row.attempt}</span>}
        {row.tokens ? <span>{row.tokens} tok</span> : null}
        {row.latencyMs != null && <span>{row.latencyMs >= 1000 ? `${(row.latencyMs / 1000).toFixed(1)}s` : `${row.latencyMs}ms`}</span>}
        {expandable && <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-fast", open && "rotate-90")} aria-hidden />}
      </span>
    </>
  );

  return (
    <motion.li
      layout="position"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn("rounded-md", retry && "ring-1 ring-medium-bd")}
      data-testid={`activity-row-${row.kind}`}
      data-seq={row.seq}
    >
      {expandable ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">{head}</button>
      ) : (
        <div className="flex items-start gap-2 px-2 py-1.5">{head}</div>
      )}
      {open && expandable && (
        <div className="mx-2 mb-2 ml-9 grid gap-2">
          {row.input && <Json label="input" value={row.input} />}
          {row.output && <Json label="output" value={row.output} />}
        </div>
      )}
    </motion.li>
  );
}

function GroupView({ g, title, hideHeader }: { g: Group; title: ReactNode; hideHeader?: boolean }) {
  return (
    <section className="py-2" data-testid={`activity-group-${g.key}`}>
      {!hideHeader && (
        <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-surface/95 px-2 py-1.5 text-[11px] uppercase tracking-[0.06em] text-text-2 backdrop-blur">
          <span className={cn("h-1.5 w-1.5 rounded-full", g.finished ? "bg-satisfied-fg" : "animate-pulse2 bg-accent")} aria-hidden />
          {title}
          <span className="ml-auto font-mono normal-case tracking-normal text-text-3">{g.rows.length}</span>
        </h3>
      )}
      <ul className="space-y-0.5">
        <AnimatePresence initial={false}>{g.rows.map((r) => <RowView key={r.id} row={r} />)}</AnimatePresence>
      </ul>
    </section>
  );
}

/** Grouped timeline; `events` already filtered if needed. `flat` drops group headers (single-requirement view). */
export function Timeline({ events, flat }: { events: AgentEvent[]; flat?: boolean }) {
  const reqs = useRequirements();
  const idx = reqIndex(reqs.data);
  const groups = groupRows(events);
  return (
    <div className="divide-y divide-border" data-testid="activity-timeline">
      {groups.map((g) => (
        <GroupView
          key={g.key}
          g={g}
          hideHeader={flat}
          title={g.kind === "setup" ? "Run setup" : g.kind === "wrapup" ? "Gate & wrap-up" : (
            <><span className="font-mono text-text">{aliasOf(idx, g.requirementId!)}</span><span className="truncate normal-case tracking-normal text-text-3">{g.requirementId}</span></>
          )}
        />
      ))}
    </div>
  );
}
