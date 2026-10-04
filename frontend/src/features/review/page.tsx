import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Gavel } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import type { FindingView } from "@/api/client";
import { Card, Skeleton } from "@/components/card";
import { EmptyState } from "@/components/feedback";
import { StatusChip } from "@/components/status-chip";
import { CategoryIcon } from "@/components/tags";
import { useCurrentRelease, useFindings, useReadiness, useRequirements, reqIndex, aliasOf } from "@/lib/queries";
import { paths, useReleaseParams } from "@/lib/routes";
import { CONCLUSION_RANK, DECISION_WORD, SEVERITY_RANK, GATE_WORD } from "@/lib/status";
import { cn } from "@/lib/utils";
import { DecisionBar } from "./DecisionBar";

/** Queue order (DESIGN §4.10): unreviewed first — uncertain, then by severity, then missing evidence; reviewed last. */
export function queueOrder(fs: FindingView[]): FindingView[] {
  const bucket = (f: FindingView) =>
    f.applicable_review ? 3 : f.conclusion === "uncertain" ? 0 : f.conclusion === "insufficient_evidence" ? 2 : 1;
  return [...fs].sort((a, b) =>
    bucket(a) - bucket(b) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || CONCLUSION_RANK[a.conclusion] - CONCLUSION_RANK[b.conclusion]);
}

const firstSentence = (s: string) => s.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? s;

/** Counsel review queue `…/review[/:findingId]` (counsel-only route). */
export default function ReviewPage() {
  const { productId, version, releaseId } = useCurrentRelease();
  const { findingId } = useReleaseParams();
  const findings = useFindings(releaseId);
  const readiness = useReadiness(releaseId);
  const reqs = useRequirements();
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const queue = useMemo(() => queueOrder(findings.data ?? []), [findings.data]);
  const reviewed = queue.filter((f) => f.applicable_review).length;
  const selected = queue.find((f) => f.id === findingId) ?? queue.find((f) => !f.applicable_review) ?? queue[0];

  if (findings.isPending || !releaseId) return <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6"><Skeleton className="h-96" /></div>;
  if (!queue.length) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState icon={Gavel} title="Nothing to review">This release has no findings yet.</EmptyState></div>;

  const advance = () => {
    const next = queue.find((f) => !f.applicable_review && f.id !== selected?.id);
    if (next) navigate(paths.review(productId, version, next.id), { replace: true });
  };
  const unreviewed = queue.filter((f) => !f.applicable_review);

  return (
    <div className="mx-auto grid max-w-[1360px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)]" data-testid="review-page">
      <aside aria-label="Review queue">
        <Card className="overflow-hidden">
          <div className="border-b px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text">Queue</span>
              <span className="tnum text-text-2" data-testid="queue-progress">{reviewed}/{queue.length}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div className="h-full rounded-full bg-counsel-fg" initial={false} animate={{ width: `${(reviewed / queue.length) * 100}%` }} transition={{ duration: reduce ? 0 : 0.32 }} />
            </div>
          </div>
          <ul data-testid="review-queue" className="divide-y">
            {queue.map((f, i) => {
              const first = i === 0 && !f.applicable_review;
              const firstReviewed = f.applicable_review && (i === 0 || !queue[i - 1].applicable_review);
              return (
                <motion.li key={f.id} layout={!reduce} transition={{ duration: 0.2 }}>
                  {first && <div className="bg-surface-2 px-3 py-1 text-[11px] uppercase tracking-[0.06em] text-text-3">Needs you</div>}
                  {firstReviewed && <div className="bg-surface-2 px-3 py-1 text-[11px] uppercase tracking-[0.06em] text-text-3">Reviewed</div>}
                  <Link to={paths.review(productId, version, f.id)} replace data-testid={`queue-item-${aliasOf(idx, f.requirement_id)}`}
                    data-reviewed={f.applicable_review ? "true" : "false"} aria-current={f.id === selected?.id ? "true" : undefined}
                    className={cn("flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-fast hover:bg-surface-2",
                      f.id === selected?.id && "bg-counsel-bg hover:bg-counsel-bg")}>
                    {f.applicable_review ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-counsel-fg" aria-hidden /> : <span className="w-3.5" />}
                    <span className="w-7 shrink-0 font-mono text-xs text-text-2">{aliasOf(idx, f.requirement_id)}</span>
                    {f.applicable_review
                      ? <span className="truncate text-text-2">{DECISION_WORD[f.applicable_review.decision]}{f.carried_from_version ? " (carried)" : ` · ${f.applicable_review.reviewer_name}`}</span>
                      : <StatusChip conclusion={f.conclusion} severity={f.severity} />}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </Card>
      </aside>

      <section aria-label="Selected finding" className="min-w-0">
        {unreviewed.length === 0 && (
          <div className="mb-4 rounded-md border border-counsel-bd bg-counsel-bg px-4 py-3 text-sm text-counsel-fg" data-testid="all-reviewed">
            All {queue.length} findings have a counsel decision. Gate: {readiness.data?.gate_label ?? (readiness.data ? GATE_WORD[readiness.data.gate] : "…")}.
          </div>
        )}
        {selected && (
          <motion.div key={selected.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-text-2">{aliasOf(idx, selected.requirement_id)}</span>
                <StatusChip conclusion={selected.effective_conclusion} severity={selected.severity} size="md" />
                <CategoryIcon domain={idx.get(selected.requirement_id)?.domain} />
                <span className="text-xs text-text-3">{idx.get(selected.requirement_id)?.title}</span>
              </div>
              <h2 className="mt-2 text-xl text-text" data-testid="review-title">{selected.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{firstSentence(selected.reasoning_summary)}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link to={paths.risks(productId, version, selected.id)} className="inline-flex items-center gap-1 text-accent hover:underline">
                  Open the full compliance check <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link to={paths.documents(productId, version, undefined, { f: selected.id })} className="inline-flex items-center gap-1 text-text-2 hover:text-text">
                  See it in the documents <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
            <div className="mt-3">
              <DecisionBar findingId={selected.id} releaseId={releaseId} onRecorded={advance} />
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
}
