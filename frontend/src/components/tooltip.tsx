import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;
export function Tip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-50 rounded-sm border bg-surface px-2 py-1 text-xs text-text shadow-overlay">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
