import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-md border bg-surface", className)} {...p} />
);
export const CardHeader = ({ title, right, className }: { title: ReactNode; right?: ReactNode; className?: string }) => (
  <div className={cn("flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2", className)}>
    <h2 className="text-xs uppercase tracking-[0.04em] text-text-2">{title}</h2>
    {right}
  </div>
);
export const Mono = ({ className, ...p }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("font-mono text-code", className)} {...p} />
);
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse2 rounded-md bg-surface-2", className)} />
);
