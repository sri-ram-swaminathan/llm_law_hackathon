import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, GitPullRequest, Loader2, RotateCw } from "lucide-react";
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router";
import { ApiError, describeError, FIXTURES, http, type FindingView, type ReleaseOut } from "@/api/client";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { ErrorBanner, NotFound } from "@/components/feedback";
import { ProvenanceLine } from "@/components/provenance";
import { GateChip } from "@/components/tags";
import { Tip } from "@/components/tooltip";
import { versionLabel } from "@/lib/format";
import { useMode } from "@/lib/mode";
import { useCurrentRelease, useFindings, useReadiness, useRunSummary, useStartAssessment } from "@/lib/queries";
import { paths, type ReleaseTab } from "@/lib/routes";
import { Slot } from "@/lib/slots";
import { isOpen } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Tab counts (DESIGN §4.3): open risks, documents, cited code files, unreviewed findings (counsel). */
export function tabCounts(release: ReleaseOut, findings: FindingView[] | undefined) {
  const docs = (release.artifacts ?? []).filter((a) => a.kind !== "code_repo").length;
  const codeFiles = new Set<string>();
  for (const f of findings ?? []) for (const e of f.evidence ?? []) if (e.type === "code") codeFiles.add(e.path);
  return {
    risks: findings ? findings.filter(isOpen).length : undefined,
    documents: docs,
    code: findings ? codeFiles.size : undefined,
    review: findings ? findings.filter((f) => !f.applicable_review).length : undefined,
  };
}

function ReRun({ releaseId, version, productId }: { releaseId: string; version: string; productId: string }) {
  const run = useStartAssessment();
  const conflict = run.error instanceof ApiError && run.error.status === 409;
  const label = `Re-run assessment on ${versionLabel(version)}`;
  return (
    <div className="flex items-center gap-2">
      {run.isSuccess && (
        <Link to={paths.activity(productId, version, { run: run.data.run_id })} className="hidden text-sm text-text-2 hover:text-text sm:inline" data-testid="rerun-started">
          Run started · Watch →
        </Link>
      )}
      {run.isError && (
        <span role="alert" className="hidden text-sm text-blocker-fg sm:inline" data-testid="rerun-error">
          {conflict ? <>A run is already in progress · <Link className="underline" to={paths.activity(productId, version)}>Watch</Link></> : describeError(run.error)}
        </span>
      )}
      <Tip label={label}>
        <Button variant="secondary" onClick={() => run.mutate(releaseId)} disabled={run.isPending} data-testid="rerun" aria-label={label}>
          {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Re-run</span>
          <span className="hidden font-mono text-code text-text-2 lg:inline">{versionLabel(version)}</span>
        </Button>
      </Tip>
    </div>
  );
}

type GhRun = { id: number; url: string; status: string; conclusion: string | null; sha: string; attempt: number; pr_number: number | null; pr_url: string | null };

/** Run the release check on GitHub Actions (re-runs the open release PR's `compliance` workflow) and link to it. */
function RunOnGitHub() {
  const checks = useQuery({
    queryKey: ["github-checks"],
    queryFn: () => http<{ repo: string; runs: GhRun[] }>("/api/github/checks?limit=3"),
    enabled: !FIXTURES, retry: false,
    refetchInterval: (q) => (q.state.data?.runs?.[0] && q.state.data.runs[0].status !== "completed" ? 5000 : 30000),
  });
  const rerun = useMutation({
    mutationFn: () => http<{ started: boolean; run: GhRun; pr_url: string }>("/api/github/rerun", { method: "POST" }),
    onSuccess: () => checks.refetch(),
  });
  if (FIXTURES || checks.isError) return null;
  const last = rerun.data?.run ?? checks.data?.runs?.[0];
  const state = !last ? null : last.status !== "completed" ? "running" : last.conclusion === "success" ? "passed" : "failed";
  const tone = state === "passed" ? "text-satisfied-fg" : state === "failed" ? "text-blocker-fg" : "text-text-2";
  return (
    <div className="flex items-center gap-2">
      {last && (
        <a href={last.url} target="_blank" rel="noreferrer" data-testid="github-run-link"
          className={cn("hidden items-center gap-1 text-sm hover:underline sm:inline-flex", tone)}
          title={`GitHub Actions run ${last.id} · attempt ${last.attempt} · commit ${last.sha}`}>
          {state === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          GitHub check {state === "running" ? "running" : state}{last.pr_number ? ` · PR #${last.pr_number}` : ""}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {rerun.isError && <span role="alert" className="hidden text-sm text-blocker-fg sm:inline">{describeError(rerun.error)}</span>}
      <Tip label="Re-run the compliance check on GitHub Actions for the open release PR">
        <Button variant="secondary" onClick={() => rerun.mutate()} disabled={rerun.isPending || state === "running"} data-testid="run-on-github">
          {rerun.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitPullRequest className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Run on GitHub</span>
        </Button>
      </Tip>
    </div>
  );
}

type TabDef = { key: ReleaseTab; label: string; count?: number };

function ReleaseTabs({ productId, version, tabs }: { productId: string; version: string; tabs: TabDef[] }) {
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Release sections" data-testid="release-tabs"
      className="no-scrollbar -mx-4 flex gap-0.5 overflow-x-auto px-4 pb-3 md:mx-0 md:gap-1 md:px-0 md:pb-0">
      <div className="flex shrink-0 gap-0.5 rounded-md bg-surface-2 p-0.5 md:gap-1 md:rounded-none md:bg-transparent md:p-0">
        {tabs.map((t) => (
          <NavLink
            key={t.key}
            to={paths.release(productId, version, t.key)}
            data-testid={`tab-${t.key}`}
            className={({ isActive }) => cn(
              "relative inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 text-sm transition-colors duration-fast",
              "md:h-10 md:rounded-none md:px-2.5",
              isActive ? "bg-surface text-text shadow-sm md:bg-transparent md:shadow-none" : "text-text-2 hover:text-text",
              t.key === "review" && "text-counsel-fg",
            )}
          >
            {({ isActive }) => (
              <>
                {t.label}
                {t.count !== undefined && (
                  <span className={cn("tnum rounded-sm px-1 text-xs", isActive ? "bg-surface-2 text-text-2" : "text-text-3")}>{t.count}</span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="release-tab-underline"
                    aria-hidden
                    className={cn("absolute inset-x-2 -bottom-px hidden h-0.5 rounded-full md:block", t.key === "review" ? "bg-counsel-fg" : "bg-text")}
                    transition={reduce ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/**
 * Release frame for every `/p/:productId/v/:version/*` route: header (version, gate, provenance, Re-run),
 * tabs with counts, the `release.banner` and `release.runStrip` slots, then the tab page.
 * Resolves the version through `GET /releases`; unknown → NotFound (never an infinite skeleton).
 */
export function ReleaseLayout() {
  const { productId, version, release, releaseId, isPending, error, notFound } = useCurrentRelease();
  const readiness = useReadiness(releaseId);
  const findings = useFindings(releaseId);
  const run = useRunSummary(release?.latest_assessment?.run_id);
  const mode = useMode();
  const counts = useMemo(() => (release ? tabCounts(release, findings.data) : null), [release, findings.data]);

  if (isPending) return <HeaderSkeleton />;
  if (error && !release) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><ErrorBanner error={error} onRetry={() => location.reload()} /></div>;
  if (notFound || !release || !releaseId || release.release.product_id !== productId) {
    return (
      <NotFound title={`${versionLabel(version)} isn't a release of this product`} backTo={paths.product(productId)}>
        Pick a release from the timeline.
      </NotFound>
    );
  }

  const tabs: TabDef[] = [
    { key: "summary", label: "Summary" },
    ...(mode === "counsel" ? [{ key: "review" as const, label: "Review", count: counts?.review }] : []),
    { key: "risks", label: "Risks", count: counts?.risks },
    { key: "documents", label: "Documents", count: counts?.documents },
    { key: "code", label: "Code", count: counts?.code },
    { key: "fix-plan", label: "Fix plan" },
    { key: "activity", label: "Activity" },
  ];
  const r = readiness.data;
  const slotProps = { releaseId, version, productId, release };

  return (
    <div data-testid="release-layout" data-release-id={releaseId}>
      <div className="border-b bg-surface">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-3 pt-4 md:pb-2 md:pt-5">
            <h1 className="font-mono text-xl font-semibold tracking-[-0.02em] text-text" data-testid="release-version">{versionLabel(version)}</h1>
            {r ? <GateChip gate={r.gate} label={r.gate_label} aiOnly={r.counsel_reviewed.reviewed === 0} size="md" />
              : release.latest_assessment ? <Skeleton className="h-6 w-20 rounded-full" /> : <span className="text-sm text-text-3">Not assessed</span>}
            <ProvenanceLine release={release.release} run={run.data} className="min-w-0 basis-full md:basis-auto" />
            <div className="ml-auto flex items-center gap-3"><RunOnGitHub /><ReRun releaseId={releaseId} version={version} productId={productId} /></div>
          </div>
          <ReleaseTabs productId={productId} version={version} tabs={tabs} />
        </div>
      </div>
      <Slot name="release.banner" props={slotProps} />
      <Slot name="release.runStrip" props={slotProps} />
      <Outlet />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="border-b bg-surface" data-testid="release-skeleton">
      <div className="mx-auto max-w-[1360px] px-4 pb-3 pt-5 sm:px-6">
        <div className="flex items-center gap-3"><Skeleton className="h-7 w-24" /><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-4 w-64" /></div>
        <div className="mt-4 flex gap-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-16" />)}</div>
      </div>
    </div>
  );
}

/** `…/review` is counsel-only: founder mode redirects to the same finding under Risks. */
export function CounselOnly({ children }: { children: React.ReactNode }) {
  const mode = useMode();
  const { productId = "", version = "", findingId } = useParams();
  if (mode !== "counsel") return <Navigate to={paths.risks(productId, version, findingId)} replace />;
  return <>{children}</>;
}
