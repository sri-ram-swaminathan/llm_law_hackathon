import { Link, useParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ListChecks, Play, ShieldCheck, Wrench } from "lucide-react";
import type { Readiness } from "@/api/client";
import { Button } from "@/components/button";
import { Card, CardHeader, Mono, Skeleton } from "@/components/card";
import { AnimatedNumber } from "@/components/animated-number";
import { StatusChip, StatusDot, STATUS_CLASS } from "@/components/status-chip";
import { Slot } from "@/lib/slots";
import { openActivity } from "@/lib/activityStore";
import { aliasOf, reqIndex, useFindings, useReadiness, useReleases, useRequirements, versionLabel } from "@/lib/queries";
import { domainLabel, findingStatus, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { gateView } from "./gate";

export function register(): void {
  // Overview has no slot registrations; it renders `overview.whatChanged` (override) and `finding.*` are elsewhere.
}

const ease = [0.2, 0.7, 0.2, 1] as const;

export function OverviewPage() {
  const { release = "" } = useParams();
  const readiness = useReadiness(release);
  const findings = useFindings(release);
  const releases = useReleases();
  const reqs = useRequirements();
  const reduce = useReducedMotion();
  const idx = reqIndex(reqs.data);
  const rel = releases.data?.find((r) => r.release.id === release);
  const r = readiness.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.04em] text-text-3">Wealthpilot · release readiness</p>
          <h1 className="text-xl">Can we launch {rel ? versionLabel(rel.release.version) : "this release"}?</h1>
        </div>
        {rel?.latest_assessment && (
          <button
            onClick={() => openActivity(rel.latest_assessment!.run_id ?? null)}
            className="inline-flex items-center gap-2 rounded-md border bg-surface px-3 py-1.5 text-sm text-text-2 transition-colors duration-fast hover:bg-surface-2 hover:text-text"
          >
            <Play className="h-3.5 w-3.5" /> Latest run
            <Mono className="text-text-3">{rel.latest_assessment.model}</Mono>
          </button>
        )}
      </div>

      {readiness.isLoading || !r ? <Skeleton className="h-60" /> : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={release}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease }}
          >
            <GateCard r={r} release={release} />
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-6">
                <Blockers r={r} release={release} findings={findings.data} idx={idx} />
                <Coverage r={r} />
              </div>
              <Slot
                name="overview.whatChanged"
                props={{ releaseId: release, readiness: r }}
                fallback={<WhatChanged r={r} idx={idx} release={release} versions={Object.fromEntries((releases.data ?? []).map((x) => [x.release.id, x.release.version]))} />}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function GateCard({ r, release }: { r: Readiness; release: string }) {
  const g = gateView(r);
  const c = r.counts;
  const { reviewed, total } = r.counsel_reviewed;
  const counts: { key: string; label: string; v: number; s: StatusKey; id: string }[] = [
    { key: "b", label: "Blockers", v: c.blockers, s: "blocker", id: "count-blockers" },
    { key: "e", label: "Needs evidence", v: c.missing_evidence, s: "evidence", id: "count-evidence" },
    { key: "h", label: "High", v: c.high, s: "high", id: "count-high" },
    { key: "u", label: "Uncertain", v: c.uncertain_unreviewed, s: "uncertain", id: "count-uncertain" },
  ];
  return (
    <section
      aria-label="Release gate"
      className={cn("overflow-hidden rounded-lg border-2 bg-surface", g.dashed && "border-dashed")}
      style={{ borderColor: `var(--${g.status}-bd)`, backgroundImage: `linear-gradient(135deg, var(--${g.status}-bg), var(--surface) 62%)` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-8 p-6 sm:p-8">
        <div className="min-w-[16rem]">
          <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", STATUS_CLASS[g.status], g.dashed && "border-dashed")}>
            <ShieldCheck className="h-3.5 w-3.5" /> Release gate
          </span>
          <h2 data-testid="gate-headline" className="mt-4 text-[44px] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ color: `var(--${g.status}-fg)` }}>
            {g.label}
          </h2>
          <p className="mt-2 max-w-sm text-text-2">{g.sub}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="md">
              <Link to={`/r/${release}/fix-plan`}><Wrench className="h-4 w-4" /> Fix plan</Link>
            </Button>
            <Button asChild variant="ghost" size="md">
              <Link to={`/r/${release}/findings`}><ListChecks className="h-4 w-4" /> All findings <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map((x) => (
            <div key={x.key} data-testid={x.id} className="min-w-[6.5rem] rounded-md border bg-surface/80 p-3 backdrop-blur" style={{ borderColor: x.v ? `var(--${x.s}-bd)` : undefined }}>
              <dt className="flex items-center gap-1.5 text-xs text-text-2"><StatusDot status={x.s} /> {x.label}</dt>
              <dd className="mt-1 text-[32px] font-semibold leading-none" style={{ color: x.v ? `var(--${x.s}-fg)` : "var(--text-3)" }}>
                <AnimatedNumber value={x.v} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-surface-2 px-6 py-2.5 text-xs text-text-2 sm:px-8">
        <span data-testid="gate-label">{r.labels[0] ?? "AI pre-assessment, not legal advice"}</span>
        <span className="flex items-center gap-3">
          <span data-testid="counsel-reviewed" className="tnum">counsel-reviewed {reviewed}/{total}</span>
          <span className="h-1 w-24 overflow-hidden rounded-full bg-border" aria-hidden>
            <span className="block h-full rounded-full bg-accent transition-[width] duration-slow" style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }} />
          </span>
          <span className="tnum">{c.requirements_evaluated}/{c.requirements_total} evaluated</span>
        </span>
      </div>
    </section>
  );
}

function Blockers({ r, release, findings, idx }: { r: Readiness; release: string; findings?: ReturnType<typeof useFindings>["data"]; idx: ReturnType<typeof reqIndex> }) {
  const rows = (r.blockers ?? []).map((id) => findings?.find((f) => f.requirement_id === id)).filter(Boolean) as NonNullable<typeof findings>;
  return (
    <Card>
      <CardHeader title="Blocking launch" right={<span className="tnum text-xs text-text-3">{rows.length}</span>} />
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-text-2"><StatusDot status="satisfied" /> No blockers on this release.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((f) => (
            <li key={f.id}>
              <Link to={`/r/${release}/findings/${f.id}`} data-testid={`blocker-${aliasOf(idx, f.requirement_id)}`} className="group flex items-start gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-2">
                <Mono className="mt-0.5 w-7 shrink-0 rounded-sm bg-blocker-bg px-1 text-center text-blocker-fg">{aliasOf(idx, f.requirement_id)}</Mono>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{f.title}</span>
                  <span className="block truncate text-sm text-text-2">{f.reasoning_summary}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-3 transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Coverage({ r }: { r: Readiness }) {
  const segs: { k: keyof Readiness["coverage"][number]; s: StatusKey }[] = [
    { k: "potential_violation", s: "blocker" }, { k: "insufficient_evidence", s: "evidence" },
    { k: "uncertain", s: "uncertain" }, { k: "satisfied", s: "satisfied" }, { k: "not_applicable", s: "na" },
  ];
  const names: Record<string, string> = { potential_violation: "violation", insufficient_evidence: "evidence", uncertain: "uncertain", satisfied: "verified", not_applicable: "n/a" };
  return (
    <Card>
      <CardHeader title="Coverage by domain" right={<span className="tnum text-xs text-text-3">{r.counts.requirements_total} requirements</span>} />
      <ul className="divide-y">
        {r.coverage.map((d) => (
          <li key={d.domain} className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-medium">{domainLabel(d.domain)}</span>
              <span className="flex flex-wrap justify-end gap-1">
                {segs.filter((s) => (d[s.k] as number) > 0).map((s) => (
                  <StatusChip key={s.k} status={s.s} icon={false} label={`${d[s.k]} ${names[s.k]}`} className="tnum" />
                ))}
              </span>
            </div>
            <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${d.total} requirements`}>
              {segs.map((s) => (d[s.k] as number) > 0 && (
                <div key={s.k} className="transition-[flex-grow] duration-slow" style={{ flexGrow: d[s.k] as number, background: `var(--${s.s}-fg)`, opacity: s.s === "na" ? 0.35 : 1 }} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WhatChanged({ r, idx, release, versions }: { r: Readiness; idx: ReturnType<typeof reqIndex>; release: string; versions: Record<string, string> }) {
  const ch = r.changes_since_previous ?? {};
  const prev = r.previous_release_id ? versions[r.previous_release_id] : null;
  const groups: { title: string; ids: string[]; s: StatusKey }[] = [
    { title: "Resolved", ids: ch.resolved ?? [], s: "satisfied" },
    { title: "New", ids: ch.new ?? [], s: "blocker" },
    { title: "Unchanged", ids: ch.unchanged ?? [], s: "na" },
  ];
  const empty = !r.previous_release_id;
  return (
    <Card className="self-start" data-testid="what-changed">
      <CardHeader title="What changed" right={prev ? <span className="text-xs text-text-3">since {versionLabel(prev)}</span> : undefined} />
      {empty ? (
        <p className="px-4 py-6 text-sm text-text-2">First assessment of Wealthpilot. Switch to a later release to see what moved.</p>
      ) : (
        <div className="divide-y">
          {groups.map((g) => (
            <div key={g.title} className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-text-2">
                <StatusDot status={g.s} /> {g.title} <span className="tnum text-text-3">{g.ids.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.ids.length === 0 && <span className="text-sm text-text-3">None</span>}
                {g.ids.map((id) => (
                  <Link key={id} to={`/r/${release}/findings`} title={id}
                    className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-code transition-colors duration-fast hover:bg-surface-2", g.title !== "Unchanged" && "animate-flash", STATUS_CLASS[g.s])}>
                    {aliasOf(idx, id)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
