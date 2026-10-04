import { Link, useParams, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Card, Mono, Skeleton } from "@/components/card";
import { StatusChip } from "@/components/status-chip";
import { aliasOf, reqIndex, useFindings, useRequirements } from "@/lib/queries";
import { domainLabel, findingStatus, STATUS_LABEL, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { BadgeCheck, GitCommitHorizontal } from "lucide-react";

export function register(): void {}

const FILTERS: StatusKey[] = ["blocker", "high", "evidence", "satisfied", "na", "uncertain"];
const RANK: Record<StatusKey, number> = { blocker: 0, high: 1, medium: 2, low: 3, evidence: 4, uncertain: 5, satisfied: 6, na: 7 };

export function FindingsListPage() {
  const { release = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const active = sp.get("status") as StatusKey | null;
  const { data, isLoading } = useFindings(release);
  const reqs = useRequirements();
  const idx = reqIndex(reqs.data);
  const reduce = useReducedMotion();

  const all = (data ?? []).map((f) => ({ f, s: findingStatus(f) })).sort((a, b) => RANK[a.s] - RANK[b.s]);
  const rows = active ? all.filter((x) => x.s === active) : all;
  const count = (k: StatusKey) => all.filter((x) => x.s === k).length;
  const toggle = (k: StatusKey | null) => setSp(k && k !== active ? { status: k } : {}, { replace: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="text-xl">Findings</h1>
        <p className="text-text-2">One finding per requirement in the pack. Select a row to open the workspace.</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button onClick={() => toggle(null)} aria-pressed={!active}
          className={cn("h-8 rounded-full border px-3 text-xs transition-colors duration-fast", !active ? "border-accent bg-accent-soft text-accent" : "bg-surface text-text-2 hover:bg-surface-2")}>
          All <span className="tnum ml-1 text-text-3">{all.length}</span>
        </button>
        {FILTERS.map((k) => (
          <button key={k} onClick={() => toggle(k)} aria-pressed={active === k} data-testid={`filter-${k}`}
            className={cn("rounded-full transition-opacity duration-fast", active && active !== k && "opacity-50 hover:opacity-100")}>
            <StatusChip status={k} className={cn("h-8 px-3", active === k && "ring-2 ring-accent ring-offset-1 ring-offset-bg")} label={`${STATUS_LABEL[k]} ${count(k)}`} />
          </button>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-72" /> : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[3.5rem_1fr_9rem_9rem] gap-3 border-b bg-surface-2 px-4 py-2 text-xs uppercase tracking-[0.04em] text-text-2 sm:grid">
            <span>ID</span><span>Requirement</span><span>Domain</span><span>Status</span>
          </div>
          <ul className="divide-y" data-testid="findings-list">
            {rows.map(({ f, s }, i) => (
              <motion.li key={f.id} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}>
                <Link to={`/r/${release}/findings/${f.id}`} data-testid={`finding-${aliasOf(idx, f.requirement_id)}`}
                  className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-fast hover:bg-surface-2 sm:grid-cols-[3.5rem_1fr_9rem_9rem]">
                  <Mono className="w-fit rounded-sm bg-surface-2 px-1.5 text-text-2">{aliasOf(idx, f.requirement_id)}</Mono>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">{f.title}</span>
                    <span className="flex items-center gap-2 text-xs text-text-3">
                      {f.applicable_review && <span className="inline-flex items-center gap-1 text-satisfied-fg"><BadgeCheck className="h-3 w-3" /> counsel-reviewed</span>}
                      {f.carried_from_version && <span className="inline-flex items-center gap-1"><GitCommitHorizontal className="h-3 w-3" /> carried from v{f.carried_from_version}</span>}
                    </span>
                  </span>
                  <span className="hidden text-sm text-text-2 sm:block">{domainLabel(idx.get(f.requirement_id)?.domain ?? "")}</span>
                  <span className="col-start-2 sm:col-start-auto"><StatusChip status={s} /></span>
                </Link>
              </motion.li>
            ))}
            {rows.length === 0 && <li className="px-4 py-10 text-center text-text-2">No findings match this filter.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
