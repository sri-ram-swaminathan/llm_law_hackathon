import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FIXTURES, http, type FindingView } from "@/api/client";
import { AnimatedNumber } from "@/components/animated-number";
import { Button } from "@/components/button";
import { closeActivity, useActivity } from "@/lib/activityStore";
import { useReleases } from "@/lib/queries";
import { registerSlot } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { counters, fmtElapsed } from "./model";
import { useRunStream } from "./stream";
import { Timeline } from "./Timeline";

type RunTotals = { status: string; totals: { events: number; tool_calls: number; retries: number; findings: number } };

function Counter({ label, value, testid }: { label: string; value: number | string; testid: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-surface px-2.5 py-1.5" data-testid={testid}>
      <div className="truncate text-[10px] uppercase tracking-[0.06em] text-text-3">{label}</div>
      <div className="font-mono text-[15px] text-text">{typeof value === "number" ? <AnimatedNumber value={value} /> : <span className="tnum">{value}</span>}</div>
    </div>
  );
}

function Panel({ runId }: { runId: string | null }) {
  const reduce = useReducedMotion();
  const [speed, setSpeed] = useState(1);
  const { events, streaming, restart } = useRunStream({ runId, enabled: true, speed });
  const c = counters(events);
  const totals = useQuery({
    queryKey: ["run-totals", runId],
    queryFn: () => http<RunTotals>(`/api/runs/${runId}`),
    enabled: !FIXTURES && !!runId && !streaming && events.length === 0,
  });
  const runInfo = useQuery({
    queryKey: ["run-info", runId],
    queryFn: () => http<{ status?: string }>(`/api/runs/${runId}`),
    enabled: !FIXTURES && !!runId,
    staleTime: Infinity,
  });
  const live = streaming && runInfo.data?.status === "running";
  const pct = c.ended ? 100 : c.requirementsTotal ? Math.round((c.requirements / c.requirementsTotal) * 100) : 0;
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [events.length, reduce]);

  const t = totals.data?.totals;
  return (
    <>
      <div className="border-b px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent"><Activity className="h-3.5 w-3.5" /></span>
          <h2 className="text-sm font-medium text-text">Agent activity</h2>
          <span className={cn("ml-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", live ? "border-satisfied-bd bg-satisfied-bg text-satisfied-fg" : "bg-surface-2 text-text-2")} data-testid="activity-state">
            <span className={cn("h-1.5 w-1.5 rounded-full bg-current", live && "animate-pulse2")} />
            {live ? "Live" : streaming ? "Replay of recorded run" : c.ended ? "Completed" : "Idle"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <div role="group" aria-label="Replay speed" className="flex rounded-md border p-0.5">
              {[1, 4].map((s) => (
                <button key={s} type="button" onClick={() => setSpeed(s)} aria-pressed={speed === s} data-testid={`speed-${s}`}
                  className={cn("h-6 rounded px-2 font-mono text-[11px] transition-colors duration-fast", speed === s ? "bg-accent text-white" : "text-text-2 hover:bg-surface-2")}>×{s}</button>
              ))}
            </div>
            <Button variant="ghost" size="icon" aria-label="Replay run" title="Replay run" onClick={restart}><RotateCcw className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" aria-label="Close activity panel" onClick={closeActivity} data-testid="activity-close"><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          <Counter testid="ctr-requirements" label="Reqs" value={c.requirementsTotal ? `${c.requirements}/${c.requirementsTotal}` : t ? t.findings : 0} />
          <Counter testid="ctr-model" label="Model" value={c.modelCalls} />
          <Counter testid="ctr-tools" label="Tools" value={events.length ? c.toolCalls : t?.tool_calls ?? 0} />
          <Counter testid="ctr-retries" label="Retries" value={events.length ? c.retries : t?.retries ?? 0} />
          <Counter testid="ctr-elapsed" label="Elapsed" value={fmtElapsed(c.elapsedMs)} />
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Assessment progress">
          <div className="h-full rounded-full bg-accent transition-[width] duration-slow ease-[cubic-bezier(.2,.7,.2,1)]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-2 pb-6"
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {events.length === 0
          ? <p className="px-3 py-10 text-center text-sm text-text-3">{streaming ? "Connecting to the agent…" : "No activity recorded."}</p>
          : <Timeline events={events} />}
      </div>
    </>
  );
}

export function ActivityPanel() {
  const { open, runId } = useActivity();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && closeActivity();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="activity"
          role="complementary"
          aria-label="Agent activity"
          data-testid="activity-panel"
          initial={reduce ? { opacity: 0 } : { x: 460, opacity: 0.6 }}
          animate={reduce ? { opacity: 1 } : { x: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { x: 460, opacity: 0 }}
          transition={{ duration: reduce ? 0.01 : 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          className="fixed bottom-0 right-0 top-12 z-40 flex w-full max-w-[460px] flex-col border-l bg-surface shadow-overlay"
        >
          <Panel runId={runId} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** "How this was produced": the same timeline, filtered by the finding's requirement. */
export function ProducedTab({ finding }: { finding: FindingView }) {
  const releases = useReleases();
  const runId = releases.data?.find((r) => r.latest_assessment?.id === finding.assessment_id)?.latest_assessment?.run_id ?? null;
  const ready = FIXTURES || !releases.isPending;
  const { events } = useRunStream({ runId, enabled: ready, speed: 1, requirementId: finding.requirement_id, instant: true });
  return (
    <div data-testid="produced-tab" className="rounded-md border bg-surface px-1">
      {events.length === 0
        ? <p className="px-3 py-8 text-center text-sm text-text-3">
            No agent activity is stored for this finding{finding.carried_from_version ? ` — it was carried from v${finding.carried_from_version.replace(/^v/, "")} without re-evaluation` : ""}.
          </p>
        : <Timeline events={events} flat />}
    </div>
  );
}

export function register(): void {
  registerSlot("finding.tab.produced", ProducedTab, { id: "produced" });
}
