import { Code2, FileText, FileX2 } from "lucide-react";
import type { Artifact, FindingView } from "@/api/client";
import { cn } from "@/lib/utils";
import { kindLabel } from "@/features/viewer/highlight";

export type EvidenceItem = NonNullable<FindingView["evidence"]>[number];

export function EvidenceList({ items, artifacts, selected, onSelect }: {
  items: EvidenceItem[]; artifacts: Artifact[]; selected: number; onSelect: (i: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="p-4 text-sm text-text-2" data-testid="evidence-empty">
        No evidence was cited for this finding. That is expected when a requirement does not apply to the product.
      </p>
    );
  }
  const pathOf = (id: string) => artifacts.find((a) => a.id === id)?.path ?? id;
  return (
    <ul className="space-y-1.5 p-2" role="listbox" aria-label="Evidence">
      {items.map((e, i) => {
        const active = i === selected;
        const Icon = e.type === "code" ? Code2 : e.type === "missing" ? FileX2 : FileText;
        const title = e.type === "code" ? e.path : e.type === "missing" ? `${kindLabel(e.artifact_kind)} not provided` : pathOf(e.artifact_id);
        const sub = e.type === "code" ? (e.start_line === e.end_line ? `line ${e.start_line}` : `lines ${e.start_line}–${e.end_line}`) : e.type === "missing" ? "missing" : "document";
        return (
          <li key={i} role="option" aria-selected={active}>
            <button
              type="button" onClick={() => onSelect(i)} data-testid={`evidence-item-${i}`} data-type={e.type}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
                  ev.preventDefault();
                  const n = Math.max(0, Math.min(items.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)));
                  onSelect(n);
                  (ev.currentTarget.closest("ul")?.querySelectorAll("button")[n] as HTMLElement | undefined)?.focus();
                }
              }}
              className={cn(
                "w-full rounded-md border p-2.5 text-left transition-[background-color,border-color,box-shadow] duration-fast",
                e.type === "missing" && "border-dashed",
                active ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]" : "bg-surface hover:bg-surface-2",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs text-text-2">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", e.type === "missing" ? "text-evidence-fg" : "text-text-3")} aria-hidden />
                <span className="min-w-0 truncate font-mono text-code text-text">{title}</span>
              </span>
              <span className="mt-0.5 block text-xs text-text-3">{sub}</span>
              {e.type !== "missing" && e.quote && (
                <span className="mt-1.5 line-clamp-3 block border-l-2 pl-2 text-[13px] leading-[19px] text-text-2" style={{ borderColor: active ? "var(--accent)" : undefined }}>{e.quote}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
