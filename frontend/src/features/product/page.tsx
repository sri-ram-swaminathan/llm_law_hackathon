import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy, FileUp, PackagePlus, TriangleAlert, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { ReleaseOut } from "@/api/client";
import { Button } from "@/components/button";
import { Card, CardHeader, Skeleton } from "@/components/card";
import { EmptyState, ErrorBanner } from "@/components/feedback";
import { ProvenanceLine, ValueLine } from "@/components/provenance";
import { GateChip } from "@/components/tags";
import { ImportDialog, NewReleaseDialog } from "@/features/releases";
import { AiLabel, CounselProgress } from "@/features/summary/parts";
import { useReport } from "@/features/summary/useReport";
import { fmtRelative, plural, versionLabel } from "@/lib/format";
import { useProduct, useReadiness, useReleasesSorted, useRunSummary } from "@/lib/queries";
import { DEFAULT_PRODUCT_ID, paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import workflowYaml from "./compliance.yml?raw";

/** Product home `/p/:productId` (DESIGN §4.2): value up front, honest release history, Connect CI, profile. */
export default function ProductPage() {
  const product = useProduct();
  const releases = useReleasesSorted();
  const [dialog, setDialog] = useState<"new" | "import" | null>(null);
  const pid = product.data?.product.id ?? DEFAULT_PRODUCT_ID;
  const list = releases.data ?? [];
  const latest = list[0];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6" data-testid="product-page">
      <div className="mb-6">
        <h1 className="text-2xl text-text">{product.data?.product.name ?? <Skeleton className="h-8 w-40" />}</h1>
        {product.data && <p className="mt-1 max-w-2xl text-sm text-text-2">{product.data.product.description}</p>}
      </div>

      {releases.isError && <ErrorBanner error={releases.error} onRetry={() => releases.refetch()} />}
      {releases.isPending && <Skeleton className="h-44" />}
      {latest && <Hero release={latest} productId={pid} />}

      <section className="mt-10" aria-labelledby="releases-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="releases-h" className="text-lg text-text">Releases</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog("import")} data-testid="import-ci"><FileUp className="h-3.5 w-3.5" /> Import CI run</Button>
            <Button variant="primary" onClick={() => setDialog("new")} data-testid="new-release"><PackagePlus className="h-3.5 w-3.5" /> New release</Button>
          </div>
        </div>
        {releases.data && list.length === 0 && <EmptyState title="No releases yet">Upload a bundle of your product's documents and code to create the first release.</EmptyState>}
        <ol className="relative" data-testid="timeline">
          {list.map((r, i) => <TimelineRow key={r.release.id} r={r} productId={pid} i={i} last={i === list.length - 1} />)}
        </ol>
      </section>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <ConnectCi />
        <ProfileCard productId={pid} />
      </div>

      <NewReleaseDialog open={dialog === "new"} onClose={() => setDialog(null)} releases={list} />
      <ImportDialog open={dialog === "import"} onClose={() => setDialog(null)} />
    </div>
  );
}

function Hero({ release, productId }: { release: ReleaseOut; productId: string }) {
  const rep = useReport(release);
  const r = rep.readiness.data;
  const v = release.release.version;
  const f = rep.findings.data ?? [];
  const high = f.filter((x) => x.effective_conclusion === "potential_violation" && x.severity === "high").length;
  const counsel = f.filter((x) => x.effective_conclusion === "uncertain").length;
  const title = !rep.assessed ? `${versionLabel(v)} hasn't been assessed yet`
    : !r ? null
    : r.gate === "READY" ? `${versionLabel(v)} is ready to launch`
    : r.gate === "NOT_READY" ? `${versionLabel(v)} is not ready to launch`
    : `${versionLabel(v)} needs counsel review`;
  return (
    <section className="rounded-lg border bg-surface p-5 sm:p-6" data-testid="value-hero">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl text-text" data-testid="hero-title">{title ?? <Skeleton className="h-8 w-72" />}</h2>
        {r && <GateChip gate={r.gate} label={r.gate_label} aiOnly={r.counsel_reviewed.reviewed === 0} size="lg" />}
      </div>
      {rep.findings.data && <ValueLine className="mt-2" data={{ ...rep.checked, acts: [...rep.checked.laws, ...rep.checked.guidance] }} />}
      {r && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-2">
            <span className="text-text">{r.blockers?.length ?? 0} blocking</span> · {high} high · {plural(counsel, "needs counsel", "need counsel")}
          </p>
          <div className="flex gap-2">
            <Button asChild><Link to={paths.fixPlan(productId, v)}><Wrench className="h-3.5 w-3.5" /> Fix plan</Link></Button>
            <Button asChild variant="primary" data-testid="open-report"><Link to={paths.summary(productId, v)}>Open report <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      )}
      {r && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
          <AiLabel r={r} />
          <CounselProgress r={r} />
        </div>
      )}
    </section>
  );
}

function TimelineRow({ r, productId, i, last }: { r: ReleaseOut; productId: string; i: number; last: boolean }) {
  const reduce = useReducedMotion();
  const readiness = useReadiness(r.latest_assessment ? r.release.id : undefined);
  const run = useRunSummary(r.latest_assessment?.run_id);
  const g = readiness.data;
  const v = r.release.version;
  const live = run.data?.status === "running";
  return (
    <motion.li
      data-testid={`release-row-${v}`}
      initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: Math.min(i, 5) * 0.03 }}
      className="relative pl-7"
    >
      {!last && <span aria-hidden className="absolute bottom-0 left-[7px] top-6 w-px bg-border" />}
      <span aria-hidden className={cn("absolute left-0 top-[18px] h-[15px] w-[15px] rounded-full border-2 border-surface ring-1 ring-border")}
        style={{ background: g ? `var(--${g.gate === "READY" ? "satisfied" : g.gate === "NOT_READY" ? "blocker" : "uncertain"}-fg)` : "var(--na-fg)" }} />
      <div className="relative mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border bg-surface px-4 py-3 transition-colors duration-fast hover:bg-surface-2/60">
        <Link to={paths.summary(productId, v)} className="min-w-[96px] font-mono text-base font-medium text-text after:absolute after:inset-0 after:rounded-md">{versionLabel(v)}</Link>
        {g ? <GateChip gate={g.gate} label={g.gate_label} aiOnly={g.counsel_reviewed.reviewed === 0} /> : r.latest_assessment ? <Skeleton className="h-5 w-20 rounded-full" /> : <span className="text-xs text-text-3">Not assessed</span>}
        {g && (g.blockers?.length ?? 0) > 0 && <span className="tnum text-sm text-text-2">{g.blockers!.length} blocking</span>}
        <ProvenanceLine release={r.release} run={run.data} className="relative z-10 min-w-0 flex-1 basis-full text-xs sm:basis-auto sm:justify-end" />
        {live && <span className="text-xs text-satisfied-fg">live run {fmtRelative(run.data?.started_at)}</span>}
      </div>
    </motion.li>
  );
}

function ConnectCi() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(workflowYaml); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  return (
    <Card data-testid="connect-ci">
      <CardHeader title="Connect CI" right={<span className="text-xs text-text-3">GitHub Actions</span>} />
      <ol className="space-y-4 px-4 py-4 text-sm">
        <li>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-text"><Step n={1} /> Add <code className="font-mono text-code">.github/workflows/compliance.yml</code></span>
            <Button size="sm" variant="ghost" onClick={copy} data-testid="copy-yaml">{copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}</Button>
          </div>
          <pre data-testid="ci-yaml" className="max-h-56 overflow-auto rounded-md border bg-surface-2 p-3 font-mono text-[11.5px] leading-[17px] text-text-2">{workflowYaml}</pre>
        </li>
        <li className="text-text"><Step n={2} /> After a run, download the result: <code className="mt-1 block rounded-sm bg-surface-2 px-2 py-1 font-mono text-code text-text-2">gh run download &lt;run-id&gt; -n ccommit-result</code></li>
        <li className="text-text"><Step n={3} /> Use <span className="font-medium">Import CI run</span> above with <code className="font-mono text-code">result.json</code>.</li>
      </ol>
    </Card>
  );
}
const Step = ({ n }: { n: number }) => <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full border text-xs text-text-2">{n}</span>;

function ProfileCard({ productId }: { productId: string }) {
  const product = useProduct();
  const p = product.data?.profile;
  return (
    <Card data-testid="profile-card">
      <CardHeader title="Regulatory profile" />
      {!p ? <div className="p-4"><Skeleton className="h-24" /></div> : (
        <div className="space-y-3 px-4 py-4 text-sm">
          <p className="text-text">{p.stage.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())} · {p.jurisdictions.join(", ")} · {p.industry}</p>
          <div className="flex flex-wrap gap-1.5">
            {[...p.activities, ...p.customer_types, ...p.ai_uses].map((x) => <span key={x} className="rounded-sm border bg-surface-2 px-1.5 py-0.5 text-xs text-text-2">{x}</span>)}
          </div>
          {!p.confirmed_at ? (
            <div className="flex items-start gap-2 rounded-md border border-medium-bd bg-medium-bg px-3 py-2 text-medium-fg" data-testid="profile-unconfirmed">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-text-2"><span className="font-medium text-medium-fg">Not confirmed.</span> The gate assumes these values.</span>
            </div>
          ) : <p className="text-xs text-satisfied-fg">Confirmed</p>}
          <Button asChild size="sm"><Link to={paths.profile(productId)}>{p.confirmed_at ? "Edit profile" : "Review and confirm"}</Link></Button>
        </div>
      )}
    </Card>
  );
}
