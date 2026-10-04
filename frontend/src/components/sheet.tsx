import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sheet: a right-side panel (bottom sheet below `sm`) on Radix Dialog. Controlled.
 * Use for Add document, Start demo, notes on mobile. `footer` sticks to the bottom.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer, side = "right", className, ...rest }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode;
  children?: ReactNode; footer?: ReactNode; side?: "right" | "bottom"; className?: string; "data-testid"?: string;
}) {
  const reduce = useReducedMotion();
  const bottom = side === "bottom";
  const from = reduce ? { opacity: 0 } : bottom ? { y: 24, opacity: 0 } : { x: 24, opacity: 0 };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                {...rest}
                initial={from} animate={{ x: 0, y: 0, opacity: 1 }} exit={from} transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                className={cn(
                  "fixed z-50 flex flex-col border bg-surface shadow-overlay outline-none",
                  bottom
                    ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg"
                    : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:w-[min(30rem,calc(100vw-1rem))] sm:rounded-lg",
                  className,
                )}
              >
                <div className="flex items-start gap-3 border-b px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <D.Title className="text-lg text-text">{title}</D.Title>
                    {description ? <D.Description className="mt-0.5 text-sm text-text-2">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
                  </div>
                  <D.Close className="grid h-7 w-7 place-items-center rounded-sm text-text-2 transition-colors duration-fast hover:bg-surface-2 hover:text-text" aria-label="Close">
                    <X className="h-4 w-4" />
                  </D.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="flex items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
