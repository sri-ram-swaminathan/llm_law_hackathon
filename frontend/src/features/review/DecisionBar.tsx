import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Ban, CheckCircle2, FileQuestion, Gavel, Loader2, Pencil, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { describeError, type FindingView } from "@/api/client";
import { Button } from "@/components/button";
import { StatusChip } from "@/components/status-chip";
import { GateChip } from "@/components/tags";
import { useMode } from "@/lib/mode";
import { aliasOf, reqIndex, useCreateReview, useFindings, useRequirements, useRevokeReview } from "@/lib/queries";
import { DECISION_WORD, effectiveConclusion, GATE_WORD, STATUS_WORD, type Conclusion, type Decision } from "@/lib/status";
import { cn } from "@/lib/utils";
import { previewDecision } from "./gatePreview";

export const DECISIONS: { v: Decision; label: string; Icon: typeof Gavel }[] = [
  { v: "confirm", label: "Confirm", Icon: CheckCircle2 },
  { v: "override", label: "Override", Icon: Pencil },
  { v: "not_applicable", label: "Not applicable", Icon: Ban },
  { v: "need_evidence", label: "Need evidence", Icon: FileQuestion },
];
const OVERRIDES: Conclusion[] = ["satisfied", "potential_violation", "insufficient_evidence", "uncertain", "not_applicable"];

const NAME_KEY = "cco.reviewerName";
const getName = () => { try { return localStorage.getItem(NAME_KEY) || "Counsel"; } catch { return "Counsel"; } };

const spanCount = (f: FindingView) => (f.evidence ?? []).filter((e) => e.type === "code" || e.type === "document_span").length;

/**
 * Counsel decision row (DESIGN §4.10). Rendered in the compliance check (`check.actions`), document/code
 * margin notes (`annotation.actions`, compact) and the review queue. Founder mode renders nothing.
 */
export function DecisionBar({ findingId, releaseId, compact, onRecorded }: { findingId: string; releaseId: string; compact?: boolean; onRecorded?: () => void }) {
  const mode = useMode();
  const reduce = useReducedMotion();
  const findings = useFindings(releaseId);
  const reqs = useRequirements();
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const create = useCreateReview();
  const revoke = useRevokeReview();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [override, setOverride] = useState<Conclusion>("satisfied");
  const [note, setNote] = useState("");
  const [name, setName] = useState(getName);
  const [open, setOpen] = useState(!compact);

  const f = findings.data?.find((x) => x.id === findingId);
  const preview = useMemo(
    () => (f && decision && findings.data ? previewDecision(findings.data, idx, f.id, decision, decision === "override" ? override : null) : null),
    [f, decision, override, findings.data, idx],
  );
  if (mode !== "counsel" || !f) return null;

  const alias = aliasOf(idx, f.requirement_id);
  const review = f.applicable_review && !f.applicable_review.revoked_at ? f.applicable_review : null;
  const n = spanCount(f);
  const applies = `Applies to ${alias}${n > 1 ? ` (all ${n} evidence spans)` : ""}`;

  if (review) {
    return (
      <div data-testid="decision-recorded" className={cn("flex flex-wrap items-center gap-2 rounded-md border border-counsel-bd bg-counsel-bg/60 px-3 py-2 text-sm", compact && "text-xs")}>
        <Gavel className="h-3.5 w-3.5 text-counsel-fg" aria-hidden />
        <span className="text-text"><span className="font-medium">{DECISION_WORD[review.decision]}</span> by {review.reviewer_name}</span>
        {review.comment && <span className="min-w-0 truncate italic text-text-2">“{review.comment}”</span>}
        {f.carried_from_version && <span className="text-text-3">carried from v{f.carried_from_version.replace(/^v/, "")}</span>}
        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => revoke.mutate(review.id)} disabled={revoke.isPending} data-testid="decision-revoke">
          {revoke.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Revoke
        </Button>
      </div>
    );
  }

  if (compact && !open) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} data-testid="decision-open"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-counsel-bd bg-counsel-bg px-2 text-xs font-medium text-counsel-fg transition-colors duration-fast hover:brightness-95">
        <Gavel className="h-3.5 w-3.5" aria-hidden /> Decide on {alias}
      </button>
    );
  }

  const canRecord = !!decision && note.trim().length > 0 && name.trim().length > 0 && !create.isPending;
  const record = () => {
    if (!canRecord || !decision) return;
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
    create.mutate(
      { findingId: f.id, body: { reviewer_name: name.trim(), decision, comment: note.trim(), override_conclusion: decision === "override" ? override : null } },
      { onSuccess: () => { setDecision(null); setNote(""); onRecorded?.(); } },
    );
  };
  const after = decision ? effectiveConclusion(f.conclusion, decision, decision === "override" ? override : null) : null;

  return (
    <motion.form
      initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => { e.preventDefault(); record(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); record(); } }}
      data-testid="decision-bar" aria-label={`Counsel decision on ${alias}`}
      className={cn("grid gap-2.5 rounded-md border border-counsel-bd bg-surface", compact ? "p-2.5 text-xs" : "p-4 text-sm")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Gavel className="h-3.5 w-3.5 text-counsel-fg" aria-hidden />
        <span className="text-text-2">AI:</span>
        <StatusChip conclusion={f.conclusion} severity={f.severity} />
        <span className="text-text-3">· {applies}</span>
      </div>
      <div role="radiogroup" aria-label="Decision" className={cn("grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {DECISIONS.map(({ v, label, Icon }) => (
          <button key={v} type="button" role="radio" aria-checked={decision === v} data-testid={`decision-${v}`} onClick={() => setDecision(v)}
            className={cn("inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs transition-colors duration-fast",
              decision === v ? "border-counsel-fg bg-counsel-bg font-medium text-counsel-fg" : "text-text-2 hover:bg-surface-2 hover:text-text")}>
            <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {decision === "override" && (
        <label className="grid gap-1 text-xs text-text-2">Override the conclusion to
          <select value={override} onChange={(e) => setOverride(e.target.value as Conclusion)} data-testid="override-conclusion"
            className="h-8 rounded-md border bg-surface px-2 text-sm text-text">
            {OVERRIDES.map((c) => <option key={c} value={c}>{STATUS_WORD[c]}</option>)}
          </select>
        </label>
      )}
      <div className={cn("grid gap-2", !compact && "sm:grid-cols-[1fr_11rem]")}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required): why this decision" aria-label="Note"
          data-testid="decision-note" className="h-8 rounded-md border bg-surface px-2 text-sm text-text placeholder:text-text-3" />
        {!compact && (
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Reviewer" data-testid="reviewer-name"
            className="h-8 rounded-md border bg-surface px-2 text-sm text-text" />
        )}
      </div>
      {preview && after && (
        <div data-testid="gate-impact" className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-text-2">
          <span>{alias}:</span>
          <StatusChip conclusion={f.effective_conclusion} severity={f.severity} />
          <ArrowRight className="h-3 w-3" aria-hidden />
          <StatusChip conclusion={after} severity={f.severity} />
          <span className="mx-1 text-text-3">·</span>
          <span>Gate</span>
          <GateChip gate={preview.before.gate} />
          <ArrowRight className="h-3 w-3" aria-hidden />
          <GateChip gate={preview.after.gate} />
          {preview.after.blockers.length > 0 && (
            <span className="text-text-3">({preview.after.blockers.map((r) => aliasOf(idx, r)).join(", ")} still block)</span>
          )}
          <span className="mx-1 text-text-3">·</span>
          <span>Counsel-reviewed {preview.before.reviewed} → {preview.after.reviewed}/{preview.after.total}</span>
          <span className="sr-only">{GATE_WORD[preview.after.gate]}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={!canRecord} data-testid="decision-record" className="bg-counsel-fg">
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Record decision
        </Button>
        {!compact && <span className="text-xs text-text-3">⌘↵ records</span>}
        {create.isError && <span role="alert" className="text-xs text-blocker-fg">Could not save: {describeError(create.error)}. Your decision is kept.</span>}
      </div>
    </motion.form>
  );
}
