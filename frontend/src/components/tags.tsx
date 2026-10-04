import type { ReactNode } from "react";
import type { LegalProvision } from "@/api/client";
import { categoryOf } from "@/lib/categories";
import { GATE_STYLE, GATE_WORD, SEVERITY_TAG, type Gate, type Severity } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatusDot, STATUS_CLASS } from "./status-chip";

/**
 * Small typographic primitives: GateChip, SeverityTag, CategoryIcon/CategoryLabel, LawBadge, Kbd.
 * All colour comes from status tones; categories and law badges stay neutral.
 */

/** Gate chip: dot + `readiness.gate_label` verbatim. `aiOnly` (no counsel review yet) draws the dashed border. */
export function GateChip({ gate, label, aiOnly, size = "sm", className }: {
  gate: Gate; label?: string | null; aiOnly?: boolean; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const tone = GATE_STYLE[gate];
  return (
    <span
      data-testid="gate-chip"
      data-gate={gate}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none",
        size === "lg" ? "h-7 px-3 text-sm" : size === "md" ? "h-6 px-2.5 text-sm" : "h-5 px-2 text-xs",
        aiOnly && "border-dashed",
        STATUS_CLASS[tone],
        className,
      )}
    >
      <StatusDot status={tone} className={size === "sm" ? "h-1.5 w-1.5" : undefined} />
      {label || GATE_WORD[gate]}
    </span>
  );
}

/** Severity as a quiet outlined tag ("Blocker", "High"…), separate from the status word. */
export function SeverityTag({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-sm border bg-surface px-1.5 text-xs text-text-2", className)}>
      <span aria-hidden className="mr-1 inline-flex gap-px">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-2 w-[3px] rounded-[1px]", i < { blocker: 3, high: 2, medium: 1, low: 0 }[severity] ? "bg-text-2" : "bg-border")} />
        ))}
      </span>
      {SEVERITY_TAG[severity]}
    </span>
  );
}

/** Category icon (no hue: neutral text-2). */
export function CategoryIcon({ domain, className }: { domain: string | null | undefined; className?: string }) {
  const { icon: I, label } = categoryOf(domain);
  return <I aria-label={label} role="img" className={cn("h-3.5 w-3.5 shrink-0 text-text-2", className)} strokeWidth={1.75} />;
}
export function CategoryLabel({ domain, className, count }: { domain: string | null | undefined; className?: string; count?: number }) {
  const c = categoryOf(domain);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-text-2", className)}>
      <CategoryIcon domain={domain} />
      {c.label}
      {count !== undefined && <span className="tnum text-text-3">{count}</span>}
    </span>
  );
}

const GUIDANCE_ISSUERS = ["ESMA", "EBA", "AMF", "ACPR", "CNIL", "EDPB"];
/** "LAW · EU" | "LAW · FR" | "GUIDANCE · ESMA". */
export function lawBadgeText(p: Pick<LegalProvision, "kind" | "jurisdiction" | "issuer" | "act_title">) {
  if (p.kind === "guidance") {
    const issuer = p.issuer || GUIDANCE_ISSUERS.find((i) => p.act_title.toUpperCase().includes(i)) || p.jurisdiction;
    return `GUIDANCE · ${issuer}`;
  }
  return `LAW · ${p.jurisdiction}`;
}
export function LawBadge({ provision, className }: { provision: Pick<LegalProvision, "kind" | "jurisdiction" | "issuer" | "act_title">; className?: string }) {
  const guidance = provision.kind === "guidance";
  return (
    <span
      data-kind={provision.kind}
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[10.5px] font-medium tracking-[0.04em]",
        guidance ? "border-dashed text-text-2" : "bg-surface-2 text-text",
        className,
      )}
    >
      {lawBadgeText(provision)}
    </span>
  );
}

/** Keyboard key cap. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-b-2 bg-surface px-1 font-mono text-[11px] leading-none text-text-2", className)}>
      {children}
    </kbd>
  );
}
