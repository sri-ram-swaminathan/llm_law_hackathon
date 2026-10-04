import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import type { FindingView, Readiness, Requirement } from "@/api/client";
import { StatusChip } from "@/components/status-chip";
import { Tip } from "@/components/tooltip";
import type { Category } from "@/lib/categories";
import { paths } from "@/lib/routes";
import { AI_LABEL, counselReviewedLabel, GATE_STYLE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { toneVar } from "@/components/status-chip";

/** Alias pill ("W1"); the requirement id lives only in the tooltip (DESIGN §4.5). */
export function Alias({ req, id, className }: { req?: Requirement; id: string; className?: string }) {
  return (
    <Tip label={<span className="font-mono">{id}</span>}>
      <span className={cn("inline-flex h-5 min-w-[28px] shrink-0 items-center justify-center rounded-sm border bg-surface-2 px-1 font-mono text-[11.5px] font-medium text-text", className)}>
        {req?.alias ?? id}
      </span>
    </Tip>
  );
}

/** One risk row inside a category card: alias · title · status chip. */
export function RiskLine({ f, req, productId, version, i = 0 }: {
  f: FindingView; req?: Requirement; productId: string; version: string; i?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: Math.min(i, 5) * 0.03 }}>
      <Link
        to={paths.risks(productId, version, f.id)}
        data-testid={`risk-${req?.alias ?? f.requirement_id}`}
        className="group flex min-h-9 items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-fast hover:bg-surface-2"
      >
        <Alias req={req} id={f.requirement_id} />
        <span className="min-w-0 flex-1 truncate text-sm text-text-2 group-hover:text-text" title={f.title}>{req?.title ?? f.title}</span>
        <StatusChip conclusion={f.effective_conclusion} severity={f.severity} icon={false} />
      </Link>
    </motion.li>
  );
}

export function CategoryCard({ category, findings, reqs, productId, version }: {
  category: Category; findings: FindingView[]; reqs: Map<string, Requirement>; productId: string; version: string;
}) {
  const I = category.icon;
  const open = findings.filter((f) => f.effective_conclusion !== "satisfied" && f.effective_conclusion !== "not_applicable").length;
  return (
    <section data-testid={`category-${category.key}`} data-category-card className="flex min-w-0 flex-col rounded-md border bg-surface">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <I className="h-4 w-4 text-text-2" strokeWidth={1.75} aria-hidden />
        <h3 className="text-sm font-medium text-text">{category.label}</h3>
        <span className="tnum text-xs text-text-3">{findings.length}</span>
        {open > 0 && <span className="ml-auto text-xs text-text-3"><span className="tnum">{open}</span> open</span>}
      </header>
      {findings.length === 0 ? (
        <p className="px-3 py-4 text-sm text-text-3">No risks in this category.</p>
      ) : (
        <ul className="p-1">
          {findings.map((f, i) => <RiskLine key={f.id} f={f} req={reqs.get(f.requirement_id)} productId={productId} version={version} i={i} />)}
        </ul>
      )}
    </section>
  );
}

/** "Counsel-reviewed 1/10" with a thin progress bar. */
export function CounselProgress({ r, className }: { r: Pick<Readiness, "counsel_reviewed">; className?: string }) {
  const { reviewed, total } = r.counsel_reviewed;
  const pct = total ? Math.round((reviewed / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="text-xs text-text-2" data-testid="counsel-reviewed">{counselReviewedLabel(r.counsel_reviewed)}</span>
      <span className="h-1 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <motion.span className="block h-full rounded-full bg-counsel-fg" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.32 }} />
      </span>
    </div>
  );
}

/** AI label, verbatim from `readiness.labels` when present. */
export function AiLabel({ r, className }: { r?: Pick<Readiness, "labels"> | null; className?: string }) {
  const label = r?.labels?.find((l) => /not legal advice/i.test(l)) ?? AI_LABEL;
  return <span data-testid="ai-label" className={cn("text-xs text-text-3", className)}>{label}</span>;
}

/** The big gate word in its tone. */
export function GateWord({ r, className }: { r: Pick<Readiness, "gate" | "gate_label">; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={r.gate_label}
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      data-testid="gate-headline"
      className={cn("text-gate", className)}
      style={{ color: toneVar(GATE_STYLE[r.gate]) }}
    >
      {r.gate_label}
    </motion.span>
  );
}

export const Arrow = () => <ChevronRight className="h-3.5 w-3.5" aria-hidden />;
