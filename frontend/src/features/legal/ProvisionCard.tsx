import { useState } from "react";
import { BookOpenText, ChevronDown, ExternalLink, Landmark, Scale, Sparkles } from "lucide-react";
import type { LegalProvision } from "@/api/client";
import { cn } from "@/lib/utils";
import { provisionLabel, useRelatedProvisions } from "@/features/viewer/data";

const SOURCE: Record<LegalProvision["source"], string> = { cellar: "EUR-Lex (Cellar)", legifrance: "Légifrance", manual: "Official text, manually curated" };

export function KindBadge({ kind, className }: { kind: LegalProvision["kind"]; className?: string }) {
  const law = kind === "law";
  return (
    <span
      data-testid={`kind-${kind}`}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs leading-none",
        law ? "border-accent/30 bg-accent-soft text-accent" : "border-dashed border-uncertain-bd bg-uncertain-bg text-uncertain-fg", className,
      )}
    >
      {law ? <Scale className="h-3 w-3" aria-hidden /> : <Landmark className="h-3 w-3" aria-hidden />}
      {law ? "Law" : "Guidance"}
    </span>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function ProvenanceLine({ p }: { p: LegalProvision }) {
  let host = "";
  try { host = new URL(p.source_url).host; } catch { /* keep empty */ }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
      <a href={p.source_url} target="_blank" rel="noreferrer" data-testid="source-link"
        className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
        <ExternalLink className="h-3 w-3" aria-hidden /> Official source{host && <span className="text-text-3">· {host}</span>}
      </a>
      <span className="text-text-3" data-testid="retrieved-at">Retrieved from {SOURCE[p.source]} · {fmtDate(p.retrieved_at)}</span>
    </div>
  );
}

/** The verbatim text, visibly distinct from any AI-written interpretation. */
export function VerbatimText({ p, clamp }: { p: LegalProvision; clamp?: boolean }) {
  const [open, setOpen] = useState(!clamp);
  const long = p.text.length > 260;
  return (
    <figure>
      <blockquote className={cn("border-l-2 border-accent/40 pl-3 font-serif text-[14px] leading-[22px] text-text", !open && long && "line-clamp-3")}>{p.text}</blockquote>
      {clamp && long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-xs text-accent hover:underline">{open ? "Show less" : "Show full text"}</button>
      )}
    </figure>
  );
}

export function AiInterpretation({ text, label = "AI interpretation for this finding" }: { text: string; label?: string }) {
  return (
    <div className="rounded-md border border-dashed bg-surface-2 p-3" data-testid="ai-interpretation">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-text-2"><Sparkles className="h-3.5 w-3.5 text-uncertain-fg" aria-hidden /> {label}</div>
      <p className="text-sm text-text">{text}</p>
      <p className="mt-1.5 text-xs text-text-3">An AI reading of the law applied to this product. It is not the law and not legal advice.</p>
    </div>
  );
}

export function ProvisionHeader({ p }: { p: LegalProvision }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <KindBadge kind={p.kind} />
      <span className="rounded-sm bg-surface-2 px-1.5 text-xs text-text-2">{p.jurisdiction}</span>
      {p.issuer && <span className="text-xs text-text-2">{p.issuer}</span>}
    </div>
  );
}

export function RelatedProvisions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useRelatedProvisions(id, open);
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs text-text-2 transition-colors duration-fast hover:text-text">
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-base", open && "rotate-180")} aria-hidden /> Related provisions
      </button>
      {open && (
        <ul className="mt-2 space-y-2" data-testid="related-provisions">
          {q.isLoading && <li className="text-xs text-text-3">Loading…</li>}
          {q.data?.length === 0 && <li className="text-xs text-text-3">No related provisions available.</li>}
          {q.data?.map((r) => (
            <li key={r.id} className="rounded-md border bg-surface-2 p-2.5">
              <div className="mb-1 flex items-center gap-2 text-xs"><KindBadge kind={r.kind} /><span className="text-text-2">{provisionLabel(r)}</span></div>
              <VerbatimText p={r} clamp />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProvisionTitle({ p }: { p: LegalProvision }) {
  return (
    <h3 className="flex items-start gap-2 text-base font-semibold">
      <BookOpenText className="mt-[3px] h-4 w-4 shrink-0 text-text-3" aria-hidden />
      <span>{provisionLabel(p)}<span className="block text-xs font-normal text-text-3">{p.act_title}</span></span>
    </h3>
  );
}
