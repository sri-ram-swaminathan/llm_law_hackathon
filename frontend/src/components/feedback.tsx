import { CircleCheck, FlaskConical, Info, OctagonAlert, RotateCw, SearchX, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { describeError } from "@/api/client";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Feedback primitives: Banner, ErrorBanner, EmptyState, NotFound. Shared conventions of DESIGN §4. */

export type BannerTone = "info" | "warning" | "error" | "success" | "counsel" | "sample";
const TONE: Record<BannerTone, { cls: string; icon: LucideIcon }> = {
  info: { cls: "border-evidence-bd bg-evidence-bg text-evidence-fg", icon: Info },
  warning: { cls: "border-medium-bd bg-medium-bg text-medium-fg", icon: TriangleAlert },
  error: { cls: "border-blocker-bd bg-blocker-bg text-blocker-fg", icon: OctagonAlert },
  success: { cls: "border-satisfied-bd bg-satisfied-bg text-satisfied-fg", icon: CircleCheck },
  counsel: { cls: "border-counsel-bd bg-counsel-bg text-counsel-fg", icon: Info },
  sample: { cls: "border-border bg-surface-2 text-text-2", icon: FlaskConical },
};

/** Inline banner. `title` is the plain-words headline; `action` sits on the right (e.g. Retry). */
export function Banner({ tone = "info", title, children, action, icon, className, ...rest }: {
  tone?: BannerTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: LucideIcon; className?: string; "data-testid"?: string;
}) {
  const t = TONE[tone];
  const I = icon ?? t.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} data-tone={tone} className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm", t.cls, className)} {...rest}>
      <I className="mt-[3px] h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title ? "mt-0.5" : "", "text-text-2")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Error banner for a failed query: the reason in plain words + Retry. */
export function ErrorBanner({ error, onRetry, title = "This couldn't be loaded", className }: {
  error: unknown; onRetry?: () => void; title?: string; className?: string;
}) {
  return (
    <Banner tone="error" title={title} className={className}
      action={onRetry && <Button size="sm" variant="secondary" onClick={onRetry}><RotateCw className="h-3.5 w-3.5" /> Retry</Button>}>
      {describeError(error)}
    </Banner>
  );
}

/** Calm empty state: icon, one-line title, optional description and action. */
export function EmptyState({ icon: I = Info, title, children, action, className }: {
  icon?: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-md border border-dashed px-6 py-12 text-center", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-md border bg-surface text-text-2"><I className="h-4 w-4" aria-hidden /></span>
      <h3 className="mt-3 text-base font-medium text-text">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-text-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 404 card. Never an infinite skeleton: every unknown release/finding/route lands here. */
export function NotFound({ title = "This page doesn't exist", children, backTo = "/", backLabel = "Back to Wealthpilot", className }: {
  title?: ReactNode; children?: ReactNode; backTo?: string; backLabel?: string; className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-lg px-4 py-20 sm:px-6", className)} data-testid="not-found">
      <div className="rounded-md border bg-surface p-6">
        <span className="grid h-9 w-9 place-items-center rounded-md border bg-surface-2 text-text-2"><SearchX className="h-4 w-4" aria-hidden /></span>
        <h1 className="mt-4 text-lg text-text">{title}</h1>
        <p className="mt-1 text-sm text-text-2">{children ?? "The link may be out of date, or the item was removed."}</p>
        <Button asChild variant="secondary" className="mt-5"><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    </div>
  );
}
