import { Activity, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { FIXTURES } from "@/api/client";
import { AnimatedNumber } from "@/components/animated-number";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { EmptyState } from "@/components/feedback";
import { useCurrentRelease, useRunSummary, useRuns } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { runLabel } from "./labels";
import { counters, fmtElapsed } from "./model";
import { useRunStream } from "./stream";
import { Timeline } from "./Timeline";

export function RunBadge({ tone, text }: ReturnType<typeof runLabel>) {
  return (
    <span data-testid="activity-state" data-tone={tone}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        tone === "live" ? "border-satisfied-bd bg-satisfied-bg text-satisfied-fg"
          : tone === "failed" ? "border-blocker-bd bg-blocker-bg text-blocker-fg"
          : tone === "replay" ? "border-evidence-bd bg-evidence-bg text-evidence-fg" : "bg-surface-2 text-text-2")}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", tone === "live" && "animate-pulse2")} />
      {text}
    </span>
  );
}

function Counter({ label, value, testid }: { label: string; value: number | string; testid: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-surface px-3 py-2" data-testid={testid}>
      <div className="truncate text-[11px] uppercase tracking-[0.06em] text-text-3">{label}</div>
      <div className="font-mono text-base text-text">{typeof value === "number" ? <AnimatedNumber value={value} /> : <span className="tnum">{value}</span>}</div>
    </div>
  );
}

/** Activity `…/activity[?run=][&replay=1]` (DESIGN §4.11). */
export default function ActivityPage() {
  const { releaseId, release } = useCurrentRelease();
  const [sp] = useSearchParams();
  const runs = useRuns(releaseId);
  const runId = sp.get("run") ?? release?.latest_assessment?.run_id ?? runs.data?.[0]?.run_id ?? null;
  const run = useRunSummary(runId);
  const live = run.data?.status === "running";
  const [replay, setReplay] = useState<number | null>(sp.get("replay") ? 4 : null);
  const { events, streaming, restart } = useRunStream({ runId, enabled: !!runId && (!!run.data || FIXTURES), speed: replay ?? 1, instant: !live && replay == null });
  const replaying = replay != null && streaming && !live;
  const c = counters(events);
  const label = runLabel(run.data, replaying);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if ((live || replaying) && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [events.length, live, replaying]);

  if (!releaseId || run.isPending && !!runId) return <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><Skeleton className="h-64" /></div>;
  if (!runId) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState icon={Activity} title="No run yet">Run an assessment on this release to watch the agent work.</EmptyState></div>;

  const start = (s: number) => { setReplay(s); restart(); };
  const pct = c.ended ? 100 : c.requirementsTotal ? Math.round((c.requirements / c.requirementsTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6" data-testid="activity-page">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-text">Agent activity</h2>
        <RunBadge {...label} />
        {FIXTURES && <span className="rounded-full border bg-surface-2 px-2 py-0.5 text-[11px] text-text-3">Simulated (sample data)</span>}
        {!live && (
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Replay">
            {[1, 4].map((s) => (
              <Button key={s} size="sm" variant={replay === s && replaying ? "primary" : "secondary"} onClick={() => start(s)} data-testid={`speed-${s}`}>
                <Play className="h-3 w-3" /> Replay ×{s}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Counter testid="ctr-requirements" label="Requirements" value={c.requirementsTotal ? `${c.requirements}/${c.requirementsTotal}` : run.data?.totals.findings ?? 0} />
        <Counter testid="ctr-model" label="Model calls" value={c.modelCalls} />
        <Counter testid="ctr-tools" label="Tool calls" value={events.length ? c.toolCalls : run.data?.totals.tool_calls ?? 0} />
        <Counter testid="ctr-retries" label="Retries" value={events.length ? c.retries : run.data?.totals.retries ?? 0} />
        <Counter testid="ctr-elapsed" label="Elapsed" value={fmtElapsed(c.elapsedMs)} />
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Assessment progress">
        <div className="h-full rounded-full bg-accent transition-[width] duration-slow" style={{ width: `${pct}%` }} />
      </div>
      <div ref={scroller} className="mt-4 max-h-[calc(100dvh-20rem)] min-h-64 overflow-y-auto rounded-md border bg-surface px-2 pb-4">
        {events.length === 0
          ? <p className="px-3 py-10 text-center text-sm text-text-3">{streaming ? "Connecting to the agent…" : "No activity recorded."}</p>
          : <Timeline events={events} />}
      </div>
    </div>
  );
}
