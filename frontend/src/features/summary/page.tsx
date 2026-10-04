import { ArrowRight, CircleAlert, CircleCheck, Minus, Play, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { ReleaseOut } from "@/api/client";
import { Button } from "@/components/button";
import { Card, CardHeader, Skeleton } from "@/components/card";
import { Banner, EmptyState, ErrorBanner } from "@/components/feedback";
import { ValueLine } from "@/components/provenance";
import { STATUS_CLASS } from "@/components/status-chip";
import { Tip } from "@/components/tooltip";
import { groupByCategory } from "@/lib/categories";
import { fmtDateTime, fmtSeconds, plural, versionLabel } from "@/lib/format";
import { aliasOf, reqIndex, useRequirements, useCurrentRelease, useFindings, useProduct, useReleasesSorted, useStartAssessment } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { compareVersions } from "@/lib/semver";
import { Slot } from "@/lib/slots";
import type { StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { blockerBreakdown, fixCounts, whatChanged, type Checked } from "./model";
import { AiLabel, CategoryCard, CounselProgress, GateWord } from "./parts";
import { useReport } from "./useReport";

/** Summary `…/summary` (DESIGN §4.4): can I launch, why not, what was checked, what next. */
export default function SummaryPage() {
  const { productId, version, release } = useCurrentRelease();
  if (!release) return null; // the layout renders skeleton / NotFound
  return <Summary release={release} productId={productId} version={version} />;
}

function Summary({ release, productId, version }: { release: ReleaseOut; productId: string; version: string }) {
  const rep = useReport(release);
  const product = useProduct();
  const r = rep.readiness.data;
  const findings = rep.findings.data;
  const run = useStartAssessment();

  if (!rep.assessed) {
    return (
      <Page>
        <EmptyState icon={Play} title="This release hasn't been assessed" action={
          <Button variant="primary" onClick={() => run.mutate(release.release.id)} disabled={run.isPending}>Run assessment</Button>
        }>Run the assessment to check its documents and code against the regulatory pack.</EmptyState>
      </Page>
    );
  }
  if (rep.readiness.error || rep.findings.error) {
    return <Page><ErrorBanner error={rep.readiness.error ?? rep.findings.error} onRetry={() => { rep.readiness.refetch(); rep.findings.refetch(); }} /></Page>;
  }

  const groups = findings ? groupByCategory(findings, rep.reqs, { keepEmpty: true }) : null;
  const unconfirmed = product.data && !product.data.profile.confirmed_at;

  return (
    <Page>
      {release.latest_assessment?.status === "failed" && (
        <Banner tone="error" title="The last run failed" className="mb-4">Re-run the assessment from the header to try again.</Banner>
      )}
      {rep.live && <Slot name="summary.liveOverlay" props={{ releaseId: release.release.id, runId: release.latest_assessment?.run_id ?? null }} />}

      <div className="mb-5 min-h-[28px]">
        {findings && !rep.live ? <ValueLine data={{ ...rep.checked, acts: [...rep.checked.laws, ...rep.checked.guidance] }} className="text-lg" /> : <Skeleton className="h-6 w-2/3" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <GateCard live={rep.live} r={r} findings={findings} />
        <CheckedCard c={rep.checked} live={rep.live} at={rep.run.data?.ended_at ?? release.latest_assessment?.finished_at} loading={!findings} />
      </div>

      <section className="mt-8" aria-labelledby="by-category">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="by-category" className="text-lg text-text">Risks by category</h2>
          <Link to={paths.risks(productId, version)} className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-text">All risks <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {groups
            ? groups.map((g) => <CategoryCard key={g.category.key} category={g.category} findings={g.findings} reqs={rep.reqs} productId={productId} version={version} />)
            : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {findings && <NextStep productId={productId} version={version} counts={fixCounts(findings, rep.reqs)} />}
        {findings && <WhatChanged release={release} productId={productId} version={version} />}
      </div>

      {unconfirmed && (
        <Banner tone="warning" className="mt-6" data-testid="profile-warning" title="Profile not confirmed"
          action={<Button asChild size="sm"><Link to={paths.profile(productId)}>Review profile</Link></Button>}>
          This gate assumes the seeded regulatory profile. Confirm it so the assessment matches your business.
        </Banner>
      )}
    </Page>
  );
}

const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6" data-testid="summary-page">{children}</div>
);

function GateCard({ r, findings, live }: { r: ReturnType<typeof useReport>["readiness"]["data"]; findings: ReturnType<typeof useReport>["findings"]["data"]; live: boolean }) {
  if (!r || !findings) return <Skeleton className="h-56" />;
  const blockers = r.blockers ?? [];
  const b = blockerBreakdown(blockers, findings);
  return (
    <Card className={cn("relative overflow-hidden p-5", r.counsel_reviewed.reviewed === 0 && "border-dashed")} data-testid="gate-card">
      <div className="text-xs uppercase tracking-[0.06em] text-text-3">Launch gate</div>
      <div className="mt-2">
        {live ? (
          <span className="text-gate text-text-2" data-testid="gate-headline">Assessing…</span>
        ) : <GateWord r={r} />}
      </div>
      {live ? (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full w-1/3 animate-pulse2 rounded-full bg-accent" /></div>
      ) : (
        <div className="mt-3">
          <p className="text-base text-text" data-testid="block-count">
            {blockers.length ? <>{plural(blockers.length, "risk")} block launch</> : "Nothing blocks launch"}
          </p>
          {blockers.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-sm text-text-2" data-testid="block-breakdown">
              {b.violations > 0 && <li className="flex items-center gap-2"><Dot tone="blocker" /> {plural(b.violations, "violation")} (blocker)</li>}
              {b.missing > 0 && <li className="flex items-center gap-2"><Dot tone="evidence" /> {b.missing} missing mandatory evidence</li>}
              {b.other > 0 && <li className="flex items-center gap-2"><Dot tone="uncertain" /> {b.other} other</li>}
            </ul>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
        <AiLabel r={r} />
        <CounselProgress r={r} />
      </div>
    </Card>
  );
}

const Dot = ({ tone }: { tone: StatusKey }) => <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${tone}-fg)` }} />;

function CheckedCard({ c, live, at, loading }: { c: Checked; live: boolean; at?: string | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-56" />;
  const Stat = ({ n, label, testid }: { n: number; label: string; testid: string }) => (
    <div data-testid={testid}>
      <div className="tnum text-2xl text-text">{n}</div>
      <div className="text-sm text-text-2">{label}</div>
    </div>
  );
  return (
    <Card className="p-5" data-testid="checked-card">
      <div className="text-xs uppercase tracking-[0.06em] text-text-3">What was checked</div>
      <div className="mt-3 grid grid-cols-3 gap-4">
        <Stat n={c.documents} label={c.documents === 1 ? "document" : "documents"} testid="checked-documents" />
        <Stat n={c.codeFiles} label={c.codeFiles === 1 ? "code file" : "code files"} testid="checked-code" />
        <Stat n={c.provisions} label={c.provisions === 1 ? "provision" : "provisions"} testid="checked-provisions" />
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        {c.laws.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 shrink-0 text-xs text-text-3">Law</span>
            {c.laws.map((a) => <span key={a} className="rounded-sm border bg-surface-2 px-1.5 py-0.5 font-law text-[13px] text-text">{a}</span>)}
          </div>
        )}
        {c.guidance.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 shrink-0 text-xs text-text-3">Guidance</span>
            {c.guidance.map((a) => <span key={a} className="rounded-sm border border-dashed px-1.5 py-0.5 text-[13px] text-text-2">{a}</span>)}
          </div>
        )}
      </div>
      <p className="mt-4 border-t pt-3 text-sm text-text-2">
        {plural(c.requirements, "requirement")}
        {c.outOfScope > 0 && <> · {c.outOfScope} out of scope</>}
        {c.seconds ? <> · <span className="tnum">{fmtSeconds(c.seconds)}</span></> : null}
        {" · "}
        {live ? <span className="inline-flex items-center gap-1.5 text-satisfied-fg"><span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-current" />Live</span> : <>Recorded {fmtDateTime(at)}</>}
      </p>
    </Card>
  );
}

function NextStep({ productId, version, counts }: { productId: string; version: string; counts: { code: number; founder: number } }) {
  const none = counts.code + counts.founder === 0;
  return (
    <Card data-testid="next-step">
      <CardHeader title="Next step" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border bg-surface-2"><Wrench className="h-4 w-4 text-text-2" /></span>
          {none ? <p className="text-base text-text">Nothing to fix for launch</p> : (
            <p className="text-base text-text">
              Fix plan: <span className="tnum font-medium">{plural(counts.code, "code change")}</span>
              {" · "}<span className="tnum font-medium">{plural(counts.founder, "founder action")}</span>
            </p>
          )}
        </div>
        {!none && <Button asChild variant="primary"><Link to={paths.fixPlan(productId, version)}>Open fix plan <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
      </div>
    </Card>
  );
}

function WhatChanged({ release, productId, version }: { release: ReleaseOut; productId: string; version: string }) {
  const releases = useReleasesSorted();
  const earlier = (releases.data ?? []).filter((r) => compareVersions(r.release.version, version) < 0 && r.latest_assessment);
  const fallback = earlier.find((r) => r.release.id === release.release.previous_release_id)?.release.id ?? earlier[0]?.release.id;
  const [picked, setPicked] = useState<string | undefined>();
  const baseId = picked ?? fallback;
  const base = useFindings(baseId);
  const cur = useFindings(release.release.id);
  const reqs = useRequirements();
  const rep = { reqs: reqIndex(reqs.data) };
  const ch = useMemo(() => (base.data && cur.data ? whatChanged(base.data, cur.data) : null), [base.data, cur.data]);
  const fid = (reqId: string) => cur.data?.find((f) => f.requirement_id === reqId)?.id;

  const Group = ({ title, ids, tone, Icon }: { title: string; ids: string[]; tone: StatusKey; Icon: typeof CircleCheck }) => (
    <div className="flex items-start gap-3 px-4 py-3" data-testid={`changed-${title.toLowerCase()}`}>
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-sm text-text-2"><Icon className="h-3.5 w-3.5" style={{ color: `var(--${tone}-fg)` }} aria-hidden />{title}</span>
      <div className="flex flex-wrap gap-1">
        {ids.length === 0 && <span className="text-sm text-text-3">—</span>}
        {ids.map((id) => (
          <Tip key={id} label={rep.reqs.get(id)?.title ?? id}>
            <Link to={paths.risks(productId, version, fid(id))} className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-code", tone === "na" ? "bg-surface-2 text-text-2" : STATUS_CLASS[tone])}>
              {aliasOf(rep.reqs, id)}
            </Link>
          </Tip>
        ))}
      </div>
    </div>
  );

  return (
    <Card data-testid="what-changed">
      <CardHeader title="What changed" right={earlier.length > 0 && (
        <label className="flex items-center gap-1.5 text-xs text-text-2">
          since
          <select data-testid="baseline-picker" value={baseId} onChange={(e) => setPicked(e.target.value)}
            className="h-7 rounded-sm border bg-surface px-1.5 font-mono text-code text-text outline-none focus:border-accent">
            {earlier.map((r) => <option key={r.release.id} value={r.release.id}>{versionLabel(r.release.version)}</option>)}
          </select>
        </label>
      )} />
      {earlier.length === 0 ? (
        <p className="px-4 py-5 text-sm text-text-2">The first assessed release of this product. Later releases show what moved since this one.</p>
      ) : !ch ? <div className="p-4"><Skeleton className="h-16" /></div> : (
        <div className="divide-y">
          <Group title="Resolved" ids={ch.resolved} tone="satisfied" Icon={CircleCheck} />
          <Group title="New" ids={ch.new} tone="blocker" Icon={CircleAlert} />
          <Group title="Unchanged" ids={ch.unchanged} tone="na" Icon={Minus} />
        </div>
      )}
    </Card>
  );
}
