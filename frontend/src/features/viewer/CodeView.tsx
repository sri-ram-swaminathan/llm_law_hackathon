import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Tip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { bandStyle, moreSevere, type LineHighlight } from "./highlight";
import { tokenize, type TokenLine } from "./shiki";

export type CodeViewProps = {
  path: string;
  content: string;
  highlights?: LineHighlight[];
  activeFindingId?: string;
  /** Scroll target (1-based, inclusive). Replays a short flash on the range. */
  focus?: { startLine: number; endLine?: number; token?: number } | null;
  onSelectFinding?: (findingId: string) => void;
  className?: string;
};

function CodeViewImpl({ path, content, highlights = [], activeFindingId, focus, onSelectFinding, className }: CodeViewProps) {
  const lines = useMemo(() => content.replace(/\n$/, "").split("\n"), [content]);
  const [tokens, setTokens] = useState<TokenLine[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setTokens(null);
    tokenize(content.replace(/\n$/, ""), path).then((t) => live && setTokens(t)).catch(() => undefined);
    return () => { live = false; };
  }, [content, path]);

  /** line -> winning highlight (active finding first, then most severe) and whether the line starts a range. */
  const perLine = useMemo(() => {
    const m = new Map<number, { h: LineHighlight; first: boolean; titles: string[] }>();
    for (const h of highlights) {
      for (let n = h.startLine; n <= Math.min(h.endLine, lines.length); n++) {
        const cur = m.get(n);
        const better = !cur || (h.findingId === activeFindingId && cur.h.findingId !== activeFindingId) ||
          (cur.h.findingId !== activeFindingId && moreSevere(h.status, cur.h.status) === h.status && h.status !== cur.h.status);
        const titles = [...new Set([...(cur?.titles ?? []), h.title])];
        if (better) m.set(n, { h, first: n === h.startLine, titles });
        else if (cur) cur.titles = titles;
      }
    }
    return m;
  }, [highlights, activeFindingId, lines.length]);

  useEffect(() => {
    if (!focus) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-line="${focus.startLine}"]`);
    const scroller = ref.current;
    if (!el || !scroller) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delta = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 3;
    scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: reduce ? "auto" : "smooth" });
  }, [focus, path, content]);

  const width = String(lines.length).length;
  return (
    <div ref={ref} data-scroll-root data-testid="code-view" data-path={path} className={cn("h-full overflow-auto bg-surface font-mono text-code", className)}>
      <div className="min-w-max py-3">
        {lines.map((text, i) => {
          const n = i + 1;
          const info = perLine.get(n);
          const inFocus = focus && n >= focus.startLine && n <= (focus.endLine ?? focus.startLine);
          const active = !!info && info.h.findingId === activeFindingId;
          const toks = tokens?.[i];
          return (
            <div
              key={`${n}-${inFocus ? focus?.token ?? 0 : ""}`}
              data-line={n}
              data-highlighted={info ? "true" : undefined}
              data-finding-id={info?.h.findingId}
              style={info ? bandStyle(info.h.status, active) : undefined}
              onClick={info ? () => onSelectFinding?.(info.h.findingId) : undefined}
              className={cn("flex transition-[background-color] duration-base", info && "cursor-pointer", inFocus && "animate-flash")}
            >
              <span className="flex shrink-0 select-none items-start justify-end gap-1 pl-3 pr-3 text-right text-text-3" style={{ minWidth: `${width + 4}ch` }}>
                {info?.first ? (
                  <Tip label={<span className="block max-w-xs">{info.titles.map((t) => <span key={t} className="block font-medium">{t}</span>)}<span className="block text-text-3">Open finding</span></span>}>
                    <button type="button" aria-label={`Finding: ${info.titles.join("; ")}`} onClick={(e) => { e.stopPropagation(); onSelectFinding?.(info.h.findingId); }}
                      className="mt-[5px] h-2.5 w-2.5 rounded-full" style={{ background: `var(--${info.h.status === "low" ? "medium" : info.h.status}-fg)` }} />
                  </Tip>
                ) : <span className="w-2.5" />}
                <span className="tnum">{n}</span>
              </span>
              <span className="whitespace-pre pr-6">
                {toks?.length
                  ? toks.map((t, k) => (
                      <span key={k} style={t.htmlStyle as React.CSSProperties} className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]">{t.content}</span>
                    ))
                  : text || " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export const CodeView = memo(CodeViewImpl);
