import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Dialog } from "@/components/popover-menu";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { useProvisions } from "@/features/viewer/data";
import { AiInterpretation, ProvenanceLine, ProvisionHeader, ProvisionTitle, RelatedProvisions, VerbatimText } from "./ProvisionCard";

export { KindBadge, VerbatimText, AiInterpretation, ProvenanceLine, ProvisionHeader, ProvisionTitle, RelatedProvisions } from "./ProvisionCard";

/**
 * Legal-basis drawer. Shows each provision verbatim (law or guidance, with the official source and when it was retrieved)
 * and, when `interpretation` is given, the AI's reading of it as a visibly separate block.
 */
export function LegalDrawer({ open, provisionIds, onClose, interpretation }: {
  open: boolean; provisionIds: string[]; onClose: () => void; interpretation?: string;
}) {
  const reduce = useReducedMotion();
  const qs = useProvisions(open ? provisionIds : []);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-40 bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby="legal-drawer-desc" data-testid="legal-drawer">
              <motion.aside
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[30rem] flex-col border-l bg-surface shadow-overlay"
                initial={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <header className="flex min-h-12 items-center justify-between gap-3 border-b px-5 py-2">
                  <div>
                    <Dialog.Title className="text-lg">Legal basis</Dialog.Title>
                    <Dialog.Description id="legal-drawer-desc" className="text-xs text-text-2">
                      What the law says, separate from what the AI concluded. AI pre-assessment, not legal advice.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close legal basis"><X className="h-4 w-4" /></Button></Dialog.Close>
                </header>
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                  {provisionIds.length === 0 && <p className="text-text-2">No legal provisions are cited for this item.</p>}
                  {qs.map((q, i) => {
                    const id = provisionIds[i];
                    if (q.isLoading) return <Skeleton key={id} className="h-32" />;
                    const p = q.data;
                    if (!p) return <div key={id} className="rounded-md border border-dashed p-3 text-sm text-text-2">Provision <code className="font-mono">{id}</code> could not be loaded.</div>;
                    return (
                      <section key={id} className="space-y-3" data-testid={`provision-${id}`}>
                        <ProvisionHeader p={p} />
                        <ProvisionTitle p={p} />
                        <div>
                          <div className="mb-1 text-xs uppercase tracking-[0.04em] text-text-2">{p.kind === "law" ? "What the law says" : "What the regulator's guidance says"}</div>
                          <VerbatimText p={p} />
                        </div>
                        <ProvenanceLine p={p} />
                        {p.kind === "guidance" && <p className="text-xs text-text-3">Guidance explains how regulators read the law. It is not itself binding law.</p>}
                        <RelatedProvisions id={p.id} />
                      </section>
                    );
                  })}
                  {interpretation && <AiInterpretation text={interpretation} />}
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function register(): void {
  // The drawer is mounted by the pages that open it (finding workspace, overview); nothing to register in slots.
}
