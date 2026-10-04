import { memo, useEffect, useMemo, useRef, type ComponentPropsWithoutRef, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { markStyle, moreSevere, type DocHighlight } from "./highlight";

/* ---------- rehype plugin: wrap source ranges in <mark> using the finding's own offsets (never re-searching text) ---------- */

type HNode = {
  type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

/** Source offset of every char of a text node. Exact when the node value is a verbatim slice of the source; otherwise aligned greedily (escapes, entities). */
function offsetsOf(value: string, source: string, from: number, to: number): number[] {
  const slice = source.slice(from, to);
  if (slice === value) return Array.from({ length: value.length }, (_, i) => from + i);
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < value.length; i++) {
    while (j < slice.length && slice[j] !== value[i]) j++;
    out.push(from + Math.min(j, Math.max(slice.length - 1, 0)));
    if (j < slice.length) j++;
  }
  return out;
}

function splitText(node: HNode, source: string, hs: DocHighlight[], activeId?: string): HNode[] | null {
  const from = node.position?.start.offset, to = node.position?.end.offset;
  if (from == null || to == null || !node.value) return null;
  if (!hs.some((h) => h.start < to && h.end > from)) return null;
  const value = node.value;
  const offs = offsetsOf(value, source, from, to);
  const winnerAt = (o: number): { win: DocHighlight; all: DocHighlight[] } | null => {
    const all = hs.filter((h) => h.start <= o && o < h.end);
    if (!all.length) return null;
    const win = all.reduce((a, b) => (b.findingId === activeId ? b : a.findingId === activeId ? a : moreSevere(a.status, b.status) === a.status ? a : b));
    return { win, all };
  };
  const out: HNode[] = [];
  let i = 0;
  while (i < value.length) {
    const cur = winnerAt(offs[i]);
    const key = cur ? cur.all.map((h) => h.findingId).sort().join("|") + cur.win.findingId + cur.win.start : "";
    let k = i + 1;
    while (k < value.length) {
      const nx = winnerAt(offs[k]);
      const nk = nx ? nx.all.map((h) => h.findingId).sort().join("|") + nx.win.findingId + nx.win.start : "";
      if (nk !== key) break;
      k++;
    }
    const text: HNode = { type: "text", value: value.slice(i, k) };
    if (!cur) out.push(text);
    else {
      const titles = [...new Map(cur.all.map((h) => [h.findingId, h.title])).values()];
      out.push({
        type: "element", tagName: "mark", children: [text],
        properties: {
          dataFindingId: cur.win.findingId, dataStatus: cur.win.status, dataActive: cur.win.findingId === activeId ? "true" : "false",
          dataStart: cur.win.start, dataEnd: cur.win.end, dataTitles: titles.join("‖"),
        },
      });
    }
    i = k;
  }
  return out;
}

function walk(node: HNode, source: string, hs: DocHighlight[], activeId?: string) {
  if (!node.children) return;
  const next: HNode[] = [];
  for (const c of node.children) {
    if (c.type === "text") next.push(...(splitText(c, source, hs, activeId) ?? [c]));
    else { walk(c, source, hs, activeId); next.push(c); }
  }
  node.children = next;
}

const rehypeMarks = (source: string, hs: DocHighlight[], activeId?: string) => () => (tree: HNode) => walk(tree, source, hs, activeId);

/* ---------- mark element ---------- */

function Mark({ onSelect, ...p }: ComponentPropsWithoutRef<"mark"> & Record<string, unknown> & { onSelect?: (id: string) => void }) {
  const id = p["data-finding-id"] as string | undefined;
  const status = p["data-status"] as Parameters<typeof markStyle>[0];
  const active = p["data-active"] === "true";
  const titles = String(p["data-titles"] ?? "").split("‖").filter(Boolean);
  if (!id) return <>{p.children}</>;
  const go = () => onSelect?.(id);
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
  return (
    <Tip label={
      <span className="block max-w-xs">
        {titles.map((t) => <span key={t} className="block font-medium">{t}</span>)}
        <span className="block text-text-3">Open finding</span>
      </span>
    }>
      <mark
        data-finding-id={id} data-status={status} data-active={active} data-start={p["data-start"] as number} data-end={p["data-end"] as number}
        role="link" tabIndex={0} aria-label={`Finding: ${titles.join("; ")}`}
        onClick={go} onKeyDown={onKey}
        style={markStyle(status, active)}
        className="cursor-pointer rounded-[3px] px-[1px] text-inherit transition-[background-color,box-shadow] duration-base hover:brightness-95"
      >{p.children}</mark>
    </Tip>
  );
}

/* ---------- typography ---------- */

const mk = (Tag: string, cls: string) =>
  function El({ node: _n, className, ...p }: any) { const C = Tag as any; return <C {...p} className={cn(cls, className)} />; };

const components = {
  h1: mk("h1", "mb-3 mt-8 text-2xl first:mt-0"),
  h2: mk("h2", "mb-2 mt-7 border-b pb-1 text-xl"),
  h3: mk("h3", "mb-1.5 mt-5 text-lg"),
  h4: mk("h4", "mb-1 mt-4 text-base font-semibold"),
  p: mk("p", "my-2.5 text-[14.5px] leading-[24px] text-text"),
  ul: mk("ul", "my-2.5 list-disc space-y-1 pl-5 marker:text-text-3"),
  ol: mk("ol", "my-2.5 list-decimal space-y-1 pl-5 marker:text-text-3"),
  li: mk("li", "text-[14.5px] leading-[24px]"),
  blockquote: mk("blockquote", "my-3 border-l-2 border-accent/40 pl-4 text-text-2"),
  hr: mk("hr", "my-6"),
  a: mk("a", "text-accent underline underline-offset-2"),
  strong: mk("strong", "font-semibold"),
  table: ({ node: _n, ...p }: any) => <div className="my-3 overflow-x-auto rounded-md border"><table {...p} className="w-full border-collapse text-sm" /></div>,
  th: mk("th", "border-b bg-surface-2 px-3 py-1.5 text-left text-xs font-medium text-text-2"),
  td: mk("td", "border-b px-3 py-1.5 align-top last:border-0"),
  pre: mk("pre", "my-3 overflow-x-auto rounded-md border bg-surface-2 p-3 font-mono text-code"),
  code: ({ node: _n, className, ...p }: any) => <code {...p} className={cn("rounded-sm bg-surface-2 px-1 font-mono text-[12.5px]", className)} />,
};

/* ---------- view ---------- */

export type MarkdownViewProps = {
  text: string;
  highlights?: DocHighlight[];
  activeFindingId?: string;
  /** Scroll target: the highlight of `findingId` containing source offset `start` (or its first one). */
  focus?: { findingId: string; start?: number } | null;
  onSelectFinding?: (findingId: string) => void;
  className?: string;
};

function MarkdownViewImpl({ text, highlights = [], activeFindingId, focus, onSelectFinding, className }: MarkdownViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const plugins = useMemo(() => [rehypeMarks(text, highlights, activeFindingId)], [text, highlights, activeFindingId]);
  const comps = useMemo(() => ({ ...components, mark: (p: any) => <Mark {...p} onSelect={onSelectFinding} /> }), [onSelectFinding]);

  useEffect(() => {
    const root = ref.current;
    if (!root || !focus) return;
    const marks = [...root.querySelectorAll<HTMLElement>(`mark[data-finding-id="${CSS.escape(focus.findingId)}"]`)];
    const target = marks.find((m) => focus.start != null && Number(m.dataset.start) <= focus.start && focus.start < Number(m.dataset.end)) ?? marks[0];
    const scroller = root.closest<HTMLElement>("[data-scroll-root]") ?? root;
    if (!target) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delta = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 3;
    scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: reduce ? "auto" : "smooth" });
  }, [focus, text, highlights.length]);

  return (
    <div ref={ref} className={cn("mx-auto max-w-[46rem] px-6 py-6", className)} data-testid="markdown-view">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={plugins as never} components={comps as never}>{text}</ReactMarkdown>
    </div>
  );
}
export const MarkdownView = memo(MarkdownViewImpl);
