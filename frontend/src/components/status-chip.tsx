import { AlertOctagon, AlertTriangle, CheckCircle2, CircleSlash, FileSearch, HelpCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type StatusKey } from "@/lib/status";

const ICON: Record<StatusKey, LucideIcon> = {
  blocker: AlertOctagon, high: ShieldAlert, medium: AlertTriangle, low: AlertTriangle,
  evidence: FileSearch, uncertain: HelpCircle, satisfied: CheckCircle2, na: CircleSlash,
};
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

export function StatusChip({ status, label, className, icon = true, dashed }: {
  status: StatusKey; label?: string; className?: string; icon?: boolean; dashed?: boolean;
}) {
  const I = ICON[status];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs leading-none", dashed && "border-dashed", STATUS_CLASS[status], className)}>
      {icon && <I className="h-3 w-3" aria-hidden />}
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export const StatusDot = ({ status, className }: { status: StatusKey; className?: string }) => (
  <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", className)} style={{ background: `var(--${status === "low" ? "medium" : status}-fg)` }} />
);
