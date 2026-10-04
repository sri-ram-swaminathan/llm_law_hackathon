import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Ban, CheckCircle2, FileQuestion, Gavel, Loader2, Pencil, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FIXTURES, http, type FindingView, type Review } from "@/api/client";
import { Button } from "@/components/button";
import { StatusChip } from "@/components/status-chip";
import { usePersona } from "@/features/persona";
import { registerSlot } from "@/lib/slots";
import { findingStatus, STATUS_LABEL, type Conclusion } from "@/lib/status";
import { cn } from "@/lib/utils";

type Decision = Review["decision"];
const DECISIONS: { v: Decision; label: string; Icon: typeof Gavel }[] = [
  { v: "confirm", label: "Confirm", Icon: CheckCircle2 },
  { v: "override", label: "Override", Icon: Pencil },
  { v: "not_applicable", label: "Not applicable", Icon: Ban },
  { v: "need_evidence", label: "Need evidence", Icon: FileQuestion },
];
const CONCLUSIONS: Conclusion[] = ["satisfied", "potential_violation", "insufficient_evidence", "uncertain", "not_applicable"];
const CONCLUSION_LABEL: Record<Conclusion, string> = {
  satisfied: "Satisfied", potential_violation: "Potential violation", insufficient_evidence: "Insufficient evidence",
  uncertain: "Uncertain", not_applicable: "Not applicable",
};
const NAME_KEY = "cco.reviewerName";
const getName = () => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } };

const chipFor = (c: Conclusion, severity: FindingView["severity"]) =>
  findingStatus({ effective_conclusion: c, severity });

/** What the counsel decision means for the effective conclusion (mirrors SPEC section 6.3). */
export function effectiveFor(f: Pick<FindingView, "conclusion">, d: Decision, override?: Conclusion | null): Conclusion {
  return d === "confirm" ? f.conclusion : d === "override" ? override ?? f.conclusion : d === "not_applicable" ? "not_applicable" : "insufficient_evidence";
}

function useReviewMutations(finding: FindingView) {
  const qc = useQueryClient();
  const patch = (review: Review | null) => {
    const eff = review && !review.revoked_at ? effectiveFor(finding, review.decision, review.override_conclusion) : finding.conclusion;
    qc.setQueriesData<FindingView[]>({ queryKey: ["findings"] }, (list) =>
      list?.map((f) => (f.id === finding.id ? { ...f, applicable_review: review && !review.revoked_at ? review : null, effective_conclusion: eff } : f)));
  };
  const refresh = () => ["readiness", "findings", "releases"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const submit = useMutation({
    mutationFn: async (body: { reviewer_name: string; decision: Decision; override_conclusion?: Conclusion | null; comment: string }) => {
      if (FIXTURES) {
        await new Promise((r) => setTimeout(r, 350)); // offline demo: simulate the round trip
        return {
          id: `rv-local-${Date.now()}`, finding_id: finding.id, product_id: "local", requirement_id: finding.requirement_id,
          evidence_fingerprint: finding.evidence_fingerprint, created_at: new Date().toISOString(), revoked_at: null, ...body,
        } satisfies Review;
      }
      return http<Review>(`/api/findings/${finding.id}/reviews`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (r) => { if (FIXTURES) patch(r); else refresh(); },
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      if (FIXTURES) { await new Promise((r) => setTimeout(r, 250)); return null; }
      return http(`/api/reviews/${id}/revoke`, { method: "POST" });
    },
    onSuccess: () => { if (FIXTURES) patch(null); else refresh(); },
  });
  return { submit, revoke };
}

function Side({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 rounded-md border bg-surface-2/60 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-text-3">{label}</div>
      {children}
    </div>
  );
}

export function ReviewPanel({ finding }: { finding: FindingView }) {
  const persona = usePersona();
  const reduce = useReducedMotion();
  const { submit, revoke } = useReviewMutations(finding);
  const [name, setName] = useState(getName() || "Counsel");
  const [decision, setDecision] = useState<Decision>("confirm");
  const [override, setOverride] = useState<Conclusion>("satisfied");
  const [comment, setComment] = useState("");
  const review = finding.applicable_review && !finding.applicable_review.revoked_at ? finding.applicable_review : null;
  if (persona !== "counsel") return null;

  const canSubmit = name.trim() && comment.trim() && !submit.isPending;
  const onSubmit = () => {
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
    submit.mutate({ reviewer_name: name.trim(), decision, comment: comment.trim(), override_conclusion: decision === "override" ? override : null });
    setComment("");
  };
  const carried = finding.carried_from_version;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
      aria-label="Counsel review"
      data-testid="review-panel"
      className="rounded-md border border-uncertain-bd bg-surface"
    >
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <Gavel className="h-3.5 w-3.5 text-uncertain-fg" aria-hidden />
        <h3 className="text-xs uppercase tracking-[0.04em] text-text-2">Counsel review</h3>
        {carried && (
          <span className="ml-auto rounded-full border border-evidence-bd bg-evidence-bg px-2 py-0.5 text-[11px] text-evidence-fg" data-testid="carried-label">
            carried from v{carried.replace(/^v/, "")}
          </span>
        )}
      </header>
      <div className="grid gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row" data-testid="review-compare">
          <Side label="AI assessment">
            <StatusChip status={chipFor(finding.conclusion, finding.severity)} label={CONCLUSION_LABEL[finding.conclusion]} />
            <p className="mt-2 text-xs text-text-2">Confidence: {Math.round(finding.confidence.finding * 100)}%</p>
          </Side>
          <Side label="Counsel decision">
            {review ? (
              <div data-testid="review-current">
                <StatusChip status={chipFor(finding.effective_conclusion, finding.severity)} label={CONCLUSION_LABEL[finding.effective_conclusion]} />
                <p className="mt-2 text-xs text-text-2">
                  <span className="text-text">{review.reviewer_name}</span> · {DECISIONS.find((d) => d.v === review.decision)?.label}
                </p>
                {review.comment && <p className="mt-1 text-xs italic text-text-2">“{review.comment}”</p>}
                {carried && <p className="mt-1 text-[11px] text-text-3">Still valid: evidence unchanged since v{carried.replace(/^v/, "")}.</p>}
                <Button size="sm" className="mt-3" onClick={() => revoke.mutate(review.id)} disabled={revoke.isPending} data-testid="review-revoke">
                  {revoke.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Revoke review
                </Button>
              </div>
            ) : (
              <p className="text-xs text-text-3" data-testid="review-none">Not reviewed. Effective status is the AI assessment: {STATUS_LABEL[findingStatus(finding)]}.</p>
            )}
          </Side>
        </div>

        {!review && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(); }}>
            <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {DECISIONS.map(({ v, label, Icon }) => (
                <button key={v} type="button" role="radio" aria-checked={decision === v} data-testid={`decision-${v}`} onClick={() => setDecision(v)}
                  className={cn("inline-flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors duration-fast",
                    decision === v ? "border-accent bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-2")}>
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </button>
              ))}
            </div>
            {decision === "override" && (
              <label className="grid gap-1 text-xs text-text-2">Override conclusion
                <select value={override} onChange={(e) => setOverride(e.target.value as Conclusion)} data-testid="override-conclusion"
                  className="h-8 rounded-md border bg-surface px-2 text-sm text-text">
                  {CONCLUSIONS.map((c) => <option key={c} value={c}>{CONCLUSION_LABEL[c]}</option>)}
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <label className="grid gap-1 text-xs text-text-2">Reviewer
                <input value={name} onChange={(e) => setName(e.target.value)} data-testid="reviewer-name" className="h-8 rounded-md border bg-surface px-2 text-sm text-text" />
              </label>
              <label className="grid gap-1 text-xs text-text-2">Comment
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for the decision" data-testid="review-comment" className="h-8 rounded-md border bg-surface px-2 text-sm text-text" />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={!canSubmit} data-testid="review-submit">
                {submit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Record decision
              </Button>
              {(submit.isError || revoke.isError) && <span className="text-xs text-blocker-fg" role="alert">Could not save the review. Try again.</span>}
            </div>
          </form>
        )}
        {revoke.isError && review && <span className="text-xs text-blocker-fg" role="alert">Could not revoke the review.</span>}
      </div>
    </motion.section>
  );
}

export function register(): void {
  registerSlot("finding.panel.review", ReviewPanel, { id: "review" });
}
