import { useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, ChevronDown, Code2, FileText, ListChecks, Building2, ShieldCheck } from "lucide-react";
import type { FindingView, Requirement } from "@/api/client";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { Tabs } from "@/components/popover-menu";
import { StatusChip } from "@/components/status-chip";
import { Slot } from "@/lib/slots";
import { domainLabel, findingStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { AiInterpretation, ProvenanceLine, ProvisionHeader, ProvisionTitle, VerbatimText } from "@/features/legal";
import { useProvisions } from "@/features/viewer/data";

export const AI_LABEL = "AI pre-assessment, not legal advice";

export const band = (v: number) => (v >= 0.8 ? "High" : v >= 0.5 ? "Medium" : "Low");

function Meter({ value, tone }: { value: number; tone: "ok" | "warn" }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="presentation">
      <motion.div
        className="h-full rounded-full" style={{ background: tone === "ok" ? "var(--accent)" : "var(--medium-fg)" }}
        initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.round(value * 100)}%` }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </div>
  );
}

function ConfidenceRow({ name, value, reason }: { name: string; value: number; reason: string }) {
  const [open, setOpen] = useState(false);
  const b = band(value);
  return (
    <li className="rounded-md border bg-surface" data-testid={`confidence-${name.toLowerCase()}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-fast hover:bg-surface-2">
        <span className="w-24 shrink-0 text-sm">{name}</span>
        <span className="min-w-0 flex-1"><Meter value={value} tone={b === "Low" ? "warn" : "ok"} /></span>
        <span className={cn("w-[4.5rem] shrink-0 text-right text-xs", b === "Low" ? "text-medium-fg" : "text-text")}>{b} <span className="tnum text-text-3">{Math.round(value * 100)}%</span></span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-text-3 transition-transform duration-base", open && "rotate-180")} aria-hidden />
      </button>
      {open && <p className="border-t px-3 py-2 text-sm text-text-2">{reason}</p>}
    </li>
  );
}

function confidenceReasons(f: FindingView, req: Requirement | undefined) {
  const ev = f.evidence ?? [];
  const docs = ev.filter((e) => e.type === "document_span").length, code = ev.filter((e) => e.type === "code").length, missing = ev.filter((e) => e.type === "missing").length;
  const parts = [docs && `${docs} document passage${docs > 1 ? "s" : ""}`, code && `${code} code location${code > 1 ? "s" : ""}`, missing && `${missing} missing artifact${missing > 1 ? "s" : ""}`].filter(Boolean);
  return {
    applicability: `${band(f.confidence.applicability)} confidence that this requirement applies to the product.${req?.applies_when ? ` It applies when: ${req.applies_when}.` : ""}`,
    evidence: `${band(f.confidence.evidence)} confidence in the evidence${parts.length ? `: ${parts.join(", ")} cited` : ": none cited"}. Quotes were located verbatim in the bundle.`,
    finding: `${band(f.confidence.finding)} confidence in the conclusion after ${f.attempts} evaluation attempt${f.attempts === 1 ? "" : "s"}.${f.validation_notes?.length ? ` Validator notes: ${f.validation_notes.join("; ")}` : " No validator warnings."}`,
  };
}

const KIND_ICON = { code: Code2, document: FileText, organisational: Building2 } as const;

function RemediationSummary({ f, req, release }: { f: FindingView; req?: Requirement; release: string }) {
  const parts = req?.remediation?.parts ?? [];
  const done = f.effective_conclusion === "satisfied" || f.effective_conclusion === "not_applicable";
  return (
    <section aria-labelledby="rem-h" data-testid="remediation-summary">
      <h3 id="rem-h" className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.04em] text-text-2"><ListChecks className="h-3.5 w-3.5" aria-hidden /> Remediation</h3>
      {done || parts.length === 0 ? (
        <p className="text-sm text-text-2">{done ? "No remediation needed for this finding." : "No remediation steps are defined for this requirement."}</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {parts.map((p) => {
              const I = KIND_ICON[p.kind];
              return (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <I className="mt-[3px] h-3.5 w-3.5 shrink-0 text-text-3" aria-hidden />
                  <span><span className="font-mono text-code text-text-3">{p.id}</span> {p.title}</span>
                </li>
              );
            })}
          </ul>
          <Button asChild variant="secondary" className="mt-3"><Link to={`/r/${release}/fix-plan`}>Open fix plan</Link></Button>
        </>
      )}
    </section>
  );
}

function FindingTab({ f, req, release, onOpenLegal }: { f: FindingView; req?: Requirement; release: string; onOpenLegal: () => void }) {
  const s = findingStatus(f);
  const r = confidenceReasons(f, req);
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusChip status={s} />
          <span className="text-xs text-text-2">{domainLabel(req?.domain ?? "")}</span>
          {f.carried_from_version && <span className="text-xs text-text-3">carried from v{f.carried_from_version}</span>}
        </div>
        <h2 className="text-lg" data-testid="finding-title">{f.title}</h2>
        <p className="mt-2 text-sm text-text-2" data-testid="reasoning">{f.reasoning_summary}</p>
      </div>
      <section aria-labelledby="conf-h">
        <h3 id="conf-h" className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.04em] text-text-2"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Confidence</h3>
        <ul className="space-y-1.5">
          <ConfidenceRow name="Applicability" value={f.confidence.applicability} reason={r.applicability} />
          <ConfidenceRow name="Evidence" value={f.confidence.evidence} reason={r.evidence} />
          <ConfidenceRow name="Finding" value={f.confidence.finding} reason={r.finding} />
        </ul>
      </section>
      <RemediationSummary f={f} req={req} release={release} />
      <Slot name="finding.panel.review" props={{ finding: f }} />
      {(f.citations?.length ?? 0) > 0 && (
        <Button variant="secondary" onClick={onOpenLegal} data-testid="open-legal">Legal basis ({f.citations!.length})</Button>
      )}
      <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-text-3" data-testid="ai-label">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {AI_LABEL}
        {f.applicable_review && <span className="text-satisfied-fg">· counsel-reviewed</span>}
      </p>
    </div>
  );
}

function LegalTab({ f, onOpen }: { f: FindingView; onOpen: () => void }) {
  const ids = f.citations ?? [];
  const qs = useProvisions(ids);
  if (ids.length === 0) return <p className="text-sm text-text-2">No legal provisions are cited for this finding.</p>;
  return (
    <div className="space-y-5" data-testid="legal-tab">
      <p className="text-sm text-text-2">Provisions this finding relies on, shown verbatim from the official source. The AI&rsquo;s reading is kept separate below.</p>
      {qs.map((q, i) => {
        if (q.isLoading) return <Skeleton key={ids[i]} className="h-24" />;
        const p = q.data;
        if (!p) return <div key={ids[i]} className="rounded-md border border-dashed p-3 text-sm text-text-2">Provision <code className="font-mono">{ids[i]}</code> is not available.</div>;
        return (
          <section key={p.id} className="space-y-2.5 rounded-md border bg-surface p-3" data-testid={`provision-card-${p.id}`}>
            <ProvisionHeader p={p} />
            <ProvisionTitle p={p} />
            <VerbatimText p={p} clamp />
            <ProvenanceLine p={p} />
          </section>
        );
      })}
      <AiInterpretation text={f.reasoning_summary} />
      <Button variant="secondary" onClick={onOpen}>Open legal basis drawer</Button>
    </div>
  );
}

export function FindingPanel({ f, req, release, tab, onTab, onOpenLegal }: {
  f: FindingView; req?: Requirement; release: string; tab: string; onTab: (t: string) => void; onOpenLegal: () => void;
}) {
  const items = [["finding", "Finding"], ["legal", "Legal basis"], ["produced", "How this was produced"]] as const;
  return (
    <Tabs.Root value={tab} onValueChange={onTab} className="flex h-full min-h-0 flex-col">
      <Tabs.List className="flex shrink-0 gap-1 overflow-x-auto border-b px-3" aria-label="Finding sections">
        {items.map(([v, l]) => (
          <Tabs.Trigger key={v} value={v} data-testid={`tab-${v}`}
            className="relative whitespace-nowrap px-2.5 py-3 text-sm text-text-2 transition-colors duration-fast hover:text-text data-[state=active]:text-text data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-accent">
            {l}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tabs.Content value="finding" className="p-4 focus-visible:outline-none"><FindingTab f={f} req={req} release={release} onOpenLegal={onOpenLegal} /></Tabs.Content>
        <Tabs.Content value="legal" className="p-4 focus-visible:outline-none"><LegalTab f={f} onOpen={onOpenLegal} /></Tabs.Content>
        <Tabs.Content value="produced" className="p-4 focus-visible:outline-none">
          <Slot name="finding.tab.produced" props={{ finding: f }}
            fallback={<p className="text-sm text-text-2">The evaluation trail for this finding appears here.</p>} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
