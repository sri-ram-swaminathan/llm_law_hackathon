import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import type { FindingView, Requirement } from "@/api/client";
import { Skeleton } from "@/components/card";
import { EmptyState, ErrorBanner } from "@/components/feedback";
import { StatusChip } from "@/components/status-chip";
import { SeverityTag } from "@/components/tags";
import { carriedLabel } from "@/features/check/model";
import { Alias } from "@/features/summary/parts";
import { groupByCategory } from "@/lib/categories";
import { reqIndex, useCurrentRelease, useFindings, useReadiness, useRequirements } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { evidenceSummary, FILTER_LABEL, FILTERS, filterCounts, matches, type Filter } from "./model";

/** Risks `…/risks` (DESIGN §4.5): every finding, grouped by category, in plain words. */
export default function RisksPage() {
  const { productId, version, releaseId, release } = useCurrentRelease();
  const findings = useFindings(release?.latest_assessment ? releaseId : undefined);
  const readiness = useReadiness(release?.latest_assessment ? releaseId : undefined);
  const reqs = useRequirements();
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const [sp, setSp] = useSearchParams();
  const filter = (FILTERS as readonly string[]).includes(sp.get("filter") ?? "") ? (sp.get("filter") as Filter) : "all";
  const blockers = readiness.data?.blockers ?? [];
  const counts = findings.data ? filterCounts(findings.data, blockers) : null;
  const shown = findings.data?.filter((f) => matches(f, filter, blockers)) ?? [];
  const groups = groupByCategory(shown, idx);
  const setFilter = (k: Filter) => {
    const n = new URLSearchParams(sp);
    if (k === "all") n.delete("filter"); else n.set("filter", k);
    setSp(n, { replace: true });
  };

  if (!release) return null;
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6" data-testid="risks-page">
      {!release.latest_assessment && <EmptyState title="This release hasn't been assessed">Run the assessment from the header to see its risks.</EmptyState>}
      {findings.isError && <ErrorBanner error={findings.error} onRetry={() => findings.refetch()} />}

      <div role="tablist" aria-label="Filter risks" className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="risk-filters">
        {FILTERS.map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} data-testid={`filter-${k}`} onClick={() => setFilter(k)}
            className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-fast",
              filter === k ? "border-text bg-text text-surface" : "bg-surface text-text-2 hover:text-text")}>
            {FILTER_LABEL[k]} {counts && <span className={cn("tnum text-xs", filter === k ? "opacity-70" : "text-text-3")}>{counts[k]}</span>}
          </button>
        ))}
      </div>

      {findings.isPending && release.latest_assessment && <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}
      {findings.data && shown.length === 0 && <EmptyState title="No risks match this filter" />}

      <div className="space-y-6">
        {groups.map((g) => {
          const I = g.category.icon;
          return (
            <section key={g.category.key} data-testid={`risks-${g.category.key}`} aria-labelledby={`cat-${g.category.key}`}>
              <h2 id={`cat-${g.category.key}`} className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                <I className="h-4 w-4 text-text-2" strokeWidth={1.75} /> {g.category.label} <span className="tnum text-xs text-text-3">{g.findings.length}</span>
              </h2>
              <div className="overflow-x-auto rounded-md border bg-surface">
                <ul className="min-w-[720px] divide-y" data-testid="risk-list">
                  {g.findings.map((f, i) => <Row key={f.id} f={f} req={idx.get(f.requirement_id)} productId={productId} version={version} i={i} />)}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Row({ f, req, productId, version, i }: { f: FindingView; req?: Requirement; productId: string; version: string; i: number }) {
  const reduce = useReducedMotion();
  const carried = carriedLabel(f, version);
  return (
    <motion.li initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: Math.min(i, 5) * 0.03 }}>
      <Link to={paths.risks(productId, version, f.id)} data-testid={`finding-${req?.alias ?? f.requirement_id}`}
        className="grid grid-cols-[40px_minmax(0,1fr)_150px_84px_minmax(150px,220px)_120px] items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-fast hover:bg-surface-2/60">
        <Alias req={req} id={f.requirement_id} />
        <span className="min-w-0">
          <span className="block truncate text-text">{req?.title ?? f.title}</span>
          <span className="block truncate text-xs text-text-3">{f.title}</span>
        </span>
        <span><StatusChip conclusion={f.effective_conclusion} severity={f.severity} label={undefined} /></span>
        <SeverityTag severity={f.severity} />
        <span className="truncate text-xs text-text-2">{evidenceSummary(f)}</span>
        <span className="truncate text-xs text-text-2">
          {f.applicable_review ? <span className="inline-flex items-center gap-1 text-counsel-fg"><Check className="h-3 w-3" />{carried ?? "Reviewed"}</span> : <span className="text-text-3">—</span>}
        </span>
      </Link>
    </motion.li>
  );
}
