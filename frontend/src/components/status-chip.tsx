import { CircleCheck, CircleHelp, CircleSlash, FileSearch, OctagonAlert, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { chipLabel, statusTone, STATUS_LABEL, type Conclusion, type Severity, type StatusKey } from "@/lib/status";

const ICON: Record<StatusKey, LucideIcon> = {
  blocker: OctagonAlert, high: ShieldAlert, medium: TriangleAlert, low: TriangleAlert,
  evidence: FileSearch, uncertain: CircleHelp, satisfied: CircleCheck, na: CircleSlash,
};
/** Tone → tailwind classes (bg/fg/border). */
export const STATUS_CLASS: Record<StatusKey, string> = {
  blocker: "bg-blocker-bg text-blocker-fg border-blocker-bd",
  high: "bg-high-bg text-high-fg border-high-bd",
  medium: "bg-medium-bg text-medium-fg border-medium-bd",
  low: "bg-medium-bg text-medium-fg border-medium-bd",
  evidence: "bg-evidence-bg text-evidence-fg border-evidence-bd",
  uncertain: "bg-uncertain-bg text-uncertain-fg border-uncertain-bd",
  satisfied: "bg-satisfied-bg text-satisfied-fg border-satisfied-bd",
  na: "bg-na-bg text-na-fg border-na-bd",
};
/** CSS colour of a tone (`var(--blocker-fg)`); for SVG strokes, highlights, dots. */
export const toneVar = (s: StatusKey, part: "fg" | "bg" | "bd" = "fg") => `var(--${s === "low" ? "medium" : s}-${part})`;

type ChipProps = { className?: string; icon?: boolean; dashed?: boolean; label?: string; size?: "sm" | "md" };

/**
 * StatusChip v2. Preferred: `<StatusChip conclusion={f.effective_conclusion} severity={f.severity} />`
 * → "Violation · Blocker" in the severity tone. Legacy: `<StatusChip status="blocker" />` (a tone key).
 */
export function StatusChip(p: ChipProps & ({ conclusion: Conclusion; severity: Severity; status?: never } | { status: StatusKey; conclusion?: never; severity?: never })) {
  const tone = p.conclusion ? statusTone(p.conclusion, p.severity!) : p.status!;
  const label = p.label ?? (p.conclusion ? chipLabel(p.conclusion, p.severity!) : STATUS_LABEL[tone]);
  const I = ICON[tone];
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border font-medium leading-none",
        p.size === "md" ? "h-6 px-2 text-sm" : "h-5 px-1.5 text-xs",
        p.dashed && "border-dashed",
        STATUS_CLASS[tone],
        p.className,
      )}
    >
      {p.icon !== false && <I className={p.size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden strokeWidth={2.25} />}
      {label}
    </span>
  );
}

export const StatusDot = ({ status, className, pulse }: { status: StatusKey; className?: string; pulse?: boolean }) => (
  <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", pulse && "animate-pulse2", className)} style={{ background: toneVar(status) }} />
);
