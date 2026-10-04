import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { api, FIXTURES } from "@/api/client";
import { fmtClock, fmtSeconds, secondsBetween } from "@/lib/format";
import { invalidateAssessmentData, qk, useReadiness, useRequirements, useRunSummary } from "@/lib/queries";
import { paths } from "@/lib/routes";
import type { SlotProps } from "@/lib/slots";
import { GATE_WORD } from "@/lib/status";
import { bundleCounts, useSourceRef } from "@/features/demo/source";

/** Latest run of a release; polls so a run started elsewhere (Start demo, CI) shows up. */
export function useLatestRun(releaseId: string) {
  const runs = useQuery({ queryKey: qk.runs(releaseId), queryFn: () => api.runs(releaseId), enabled: !!releaseId, refetchInterval: FIXTURES ? false : 5000 });
  const latest = runs.data?.[0]?.run_id ?? null;
  return useRunSummary(latest, 1500);
}

function useElapsed(since: string | null | undefined, on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return since ? Math.max(0, (now - Date.parse(since)) / 1000) : 0;
}

/**
 * Run strip (DESIGN §4.11) under the release tabs: "● Live · 4/10 · 00:23 · Watch the agent →" while a run on this
 * release is `running`. Each new finding refreshes findings + readiness so the Summary fills in live; at the end the
 * strip collapses into "Assessment finished · Not ready · 46 s".
 */
export function RunStrip({ releaseId, version, productId, release }: SlotProps["release.runStrip"]) {
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const run = useLatestRun(releaseId);
  const reqs = useRequirements();
  const readiness = useReadiness(releaseId);
  const r = run.data;
  const live = r?.status === "running";
  const elapsed = useElapsed(r?.started_at, live);
  const seen = useRef<{ findings: number; status?: string }>({ findings: -1 });
  const [done, setDone] = useState<null | { seconds: number | null }>(null);

  useEffect(() => {
    if (!r) return;
    const prev = seen.current;
    if (live && r.totals.findings !== prev.findings) {
      qc.invalidateQueries({ queryKey: qk.findings(releaseId) });
      qc.invalidateQueries({ queryKey: qk.readiness(releaseId) });
    }
    if (prev.status === "running" && r.status !== "running") {
      invalidateAssessmentData(qc);
      setDone({ seconds: secondsBetween(r.started_at, r.ended_at) });
      window.setTimeout(() => setDone(null), 8000);
    }
    seen.current = { findings: r.totals.findings, status: r.status };
  }, [r, live, qc, releaseId]);

  const total = reqs.data?.length ?? 10;
  const src = useSourceRef(version, release.release);
  const n = bundleCounts(release.artifacts);
  const what = [n.code ? `${n.code} code files` : "", n.docs ? `${n.docs} documents` : ""].filter(Boolean).join(" + ") || "the documents and code";
  return (
    <AnimatePresence initial={false}>
      {live && (
        <motion.div key="live" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-satisfied-bd bg-satisfied-bg" data-testid="run-strip">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
            <span className="inline-flex items-center gap-1.5 font-medium text-satisfied-fg">
              <span className="h-2 w-2 animate-pulse2 rounded-full bg-current" aria-hidden /> Live
            </span>
            <span className="tnum text-text">{Math.min(r!.totals.findings, total)}/{total} requirements</span>
            <span className="tnum text-text-2">{fmtClock(elapsed)}</span>
            <span className="hidden text-text-2 sm:inline" data-testid="run-strip-source">
              Analyzing {what}{src ? <> from <a href={src.treeUrl} target="_blank" rel="noreferrer" className="font-mono text-code text-text hover:underline">{src.name}@{src.short}</a></> : <> of v{version}</>}
            </span>
            <Link to={paths.activity(productId, version, { run: r!.run_id })} className="ml-auto inline-flex items-center gap-1 font-medium text-satisfied-fg hover:underline" data-testid="run-strip-watch">
              Watch the agent <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      )}
      {!live && done && (
        <motion.div key="done" initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="border-b bg-surface" data-testid="run-finished" role="status">
          <div className="mx-auto flex max-w-[1360px] items-center gap-2 px-4 py-2 text-sm sm:px-6">
            <CircleCheck className="h-4 w-4 text-satisfied-fg" aria-hidden />
            <span className="text-text">Assessment finished</span>
            {readiness.data && <span className="text-text-2">· {readiness.data.gate_label || GATE_WORD[readiness.data.gate]}</span>}
            {done.seconds != null && <span className="text-text-2">· {fmtSeconds(done.seconds)}</span>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
