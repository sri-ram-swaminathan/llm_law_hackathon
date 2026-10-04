import { ArrowRight } from "lucide-react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import type { FindingView } from "@/api/client";
import { toneVar, StatusChip } from "@/components/status-chip";
import { CategoryIcon } from "@/components/tags";
import { categoryOf } from "@/lib/categories";
import { paths } from "@/lib/routes";
import { Slot } from "@/lib/slots";
import { findingStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export type Note = {
  finding: FindingView;
  alias: string;
  domain?: string | null;
  /** Short names of the cited acts ("MiFID II", "CMF"). */
  laws: string[];
  /** Highlight spans of this finding in the current artifact. */
  spans: number;
};

export const firstSentence = (s: string) => s.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? s;

/** Collision-avoiding stack: keeps y order, min gap between cards. Pure (unit-tested). */
export function stackNotes(desired: number[], heights: number[], gap = 8): number[] {
  const out: number[] = [];
  for (let i = 0; i < desired.length; i++) {
    const prev = i ? out[i - 1] + heights[i - 1] + gap : -Infinity;
    out.push(Math.max(desired[i], prev));
  }
  return out;
}

/** One-shot 600 ms pulse on an element (Web Animations; skipped for reduced motion). */
export function pulse(el: Element | null | undefined, color = "var(--accent)") {
  if (!el || !(el as HTMLElement).animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  (el as HTMLElement).animate(
    [{ boxShadow: `0 0 0 0 color-mix(in srgb, ${color} 55%, transparent)` }, { boxShadow: `0 0 0 8px transparent` }],
    { duration: 600, easing: "cubic-bezier(.2,.7,.2,1)" },
  );
}

export const NoteCard = forwardRef<HTMLDivElement, {
  note: Note; active: boolean; onActivate: () => void; productId: string; version: string; releaseId: string; className?: string; style?: React.CSSProperties;
}>(function NoteCard({ note, active, onActivate, productId, version, releaseId, className, style }, ref) {
  const f = note.finding;
  const tone = findingStatus(f);
  return (
    <div
      ref={ref} style={{ ...style, borderLeftColor: toneVar(tone) }}
      data-testid={`note-${f.id}`} data-finding-id={f.id} data-active={active ? "true" : "false"}
      role="button" tabIndex={0} onClick={onActivate} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onActivate(); } }}
      className={cn(
        "cursor-pointer rounded-md border border-l-[3px] bg-surface p-3 text-left text-sm transition-[box-shadow,background-color,transform] duration-base",
        active ? "shadow-overlay ring-1 ring-accent/30" : "hover:bg-surface-2/60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs font-semibold text-text">{note.alias}</span>
        <StatusChip conclusion={f.effective_conclusion} severity={f.severity} />
        <span className="inline-flex items-center gap-1 text-xs text-text-3"><CategoryIcon domain={note.domain} className="h-3 w-3" />{categoryOf(note.domain).label}</span>
      </div>
      <p className="mt-1.5 font-medium leading-snug text-text">{f.title}</p>
      {active && <p className="mt-1 text-[13px] leading-snug text-text-2">{firstSentence(f.reasoning_summary)}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {note.laws.map((l) => <span key={l} className="font-law text-[13px] italic text-text-2">{l}</span>)}
        <Link to={paths.risks(productId, version, f.id)} onClick={(e) => e.stopPropagation()} data-testid="note-open-check"
          className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline">
          Open check <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {active && <div className="mt-2" onClick={(e) => e.stopPropagation()}><Slot name="annotation.actions" props={{ findingId: f.id, releaseId, compact: true }} /></div>}
    </div>
  );
});

/**
 * Margin notes y-aligned to their anchors (DESIGN §4.7): each card sits at its first highlight's top,
 * stacked without overlap; a thin leader line joins a displaced card to its anchor.
 * `contentRef` is the element that holds the anchors; the rail must share its vertical origin's scroll.
 */
export function NotesRail({ notes, contentRef, anchorOf, activeId, onActivate, productId, version, releaseId, layoutKey }: {
  notes: Note[]; contentRef: RefObject<HTMLElement | null>; anchorOf: (root: HTMLElement, findingId: string) => HTMLElement | null;
  activeId?: string; onActivate: (findingId: string) => void; productId: string; version: string; releaseId: string; layoutKey?: unknown;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [layout, setLayout] = useState<{ ids: string[]; desired: number[]; tops: number[] }>({ ids: [], desired: [], tops: [] });

  const measure = useCallback(() => {
    const root = contentRef.current, r = rail.current;
    if (!root || !r) return;
    const base = r.getBoundingClientRect().top;
    const placed = notes
      .map((n) => ({ id: n.finding.id, el: anchorOf(root, n.finding.id) }))
      .map((x) => ({ id: x.id, y: x.el ? x.el.getBoundingClientRect().top - base : Number.POSITIVE_INFINITY }))
      .sort((a, b) => a.y - b.y);
    let lastY = 0;
    const desired = placed.map((p) => (Number.isFinite(p.y) ? (lastY = p.y) : lastY));
    const heights = placed.map((p) => cards.current.get(p.id)?.offsetHeight ?? 96);
    setLayout({ ids: placed.map((p) => p.id), desired, tops: stackNotes(desired, heights) });
  }, [notes, contentRef, anchorOf]);

  useLayoutEffect(() => { measure(); }, [measure, activeId, layoutKey]);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const ro = useRef<ResizeObserver | null>(null);
  if (!ro.current && typeof ResizeObserver !== "undefined") ro.current = new ResizeObserver(() => requestAnimationFrame(() => measureRef.current()));
  useEffect(() => {
    const o = ro.current;
    if (o && contentRef.current) o.observe(contentRef.current);
    const t = window.setTimeout(() => measureRef.current(), 120);
    return () => { window.clearTimeout(t); };
  }, [contentRef]);
  useEffect(() => () => ro.current?.disconnect(), []);

  const pos = new Map(layout.ids.map((id, i) => [id, { top: layout.tops[i], desired: layout.desired[i] }]));
  const height = layout.tops.length ? Math.max(...layout.tops.map((t, i) => t + (cards.current.get(layout.ids[i])?.offsetHeight ?? 96))) : 0;

  return (
    <div ref={rail} className="relative" style={{ minHeight: height }} data-testid="notes-rail">
      <svg className="pointer-events-none absolute -left-6 top-0 h-full w-6 overflow-visible" aria-hidden>
        {notes.map((n) => {
          const p = pos.get(n.finding.id);
          if (!p) return null;
          const active = n.finding.id === activeId;
          return (
            <path key={n.finding.id} d={`M0 ${p.desired + 9} C 12 ${p.desired + 9}, 12 ${p.top + 14}, 24 ${p.top + 14}`}
              fill="none" stroke={toneVar(findingStatus(n.finding))} strokeWidth={active ? 1.75 : 1} opacity={active ? 0.9 : 0.4} />
          );
        })}
      </svg>
      {notes.map((n) => (
        <NoteCard
          key={n.finding.id} note={n} active={n.finding.id === activeId} onActivate={() => onActivate(n.finding.id)}
          productId={productId} version={version} releaseId={releaseId}
          ref={(el) => {
            const prev = cards.current.get(n.finding.id);
            if (prev && prev !== el) ro.current?.unobserve(prev);
            if (el) { cards.current.set(n.finding.id, el); ro.current?.observe(el); } else cards.current.delete(n.finding.id);
          }}
          className={cn("absolute inset-x-0", n.finding.id === activeId && "z-10")} style={{ top: pos.get(n.finding.id)?.top ?? 0, transition: "top 200ms cubic-bezier(.2,.7,.2,1)" }}
        />
      ))}
    </div>
  );
}
