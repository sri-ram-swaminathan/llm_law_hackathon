import { Scale, X } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import type { FindingView } from "@/api/client";
import { Kbd } from "@/components/tags";
import { versionLabel } from "@/lib/format";
import { setMode, useMode } from "@/lib/mode";
import { useFindings, useReadiness } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { registerSlot, type SlotProps } from "@/lib/slots";
import { DecisionBar } from "./DecisionBar";

export { DecisionBar } from "./DecisionBar";
export { computeGate, previewDecision } from "./gatePreview";

/** Findings that need a counsel judgement first: the AI was unsure or evidence is missing. */
export const needsCounsel = (f: FindingView) =>
  !f.applicable_review && (f.conclusion === "uncertain" || f.conclusion === "insufficient_evidence");

/** Esc leaves counsel mode, unless focus is in a field or a dialog is open. */
function useEscExits(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[role=dialog]") || document.querySelector("[role=dialog]")) return;
      setMode("founder");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active]);
}

/** Teal counsel frame banner under the release header (DESIGN §4.10). */
export function CounselBanner({ releaseId, version, productId }: SlotProps["release.banner"]) {
  const mode = useMode();
  const readiness = useReadiness(releaseId);
  const findings = useFindings(releaseId);
  useEscExits(mode === "counsel");
  if (mode !== "counsel") return null;
  const total = readiness.data?.counsel_reviewed.total ?? findings.data?.length ?? 0;
  const reviewed = findings.data ? findings.data.filter((f) => f.applicable_review).length : readiness.data?.counsel_reviewed.reviewed ?? 0;
  const needYou = (findings.data ?? []).filter(needsCounsel).length;
  return (
    <div className="border-b border-counsel-bd bg-counsel-bg" data-testid="counsel-banner">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <Scale className="h-4 w-4 text-counsel-fg" aria-hidden />
        <span className="font-medium text-counsel-fg">Counsel review</span>
        <span className="text-text-2">· {versionLabel(version)}</span>
        <span className="tnum text-text" data-testid="counsel-progress">· Reviewed {reviewed}/{total}</span>
        <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface sm:block" aria-hidden>
          <span className="block h-full rounded-full bg-counsel-fg transition-[width] duration-slow" style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }} />
        </span>
        {needYou > 0 && <span className="text-text-2">· {needYou} need you</span>}
        <Link to={paths.review(productId, version)} className="ml-auto font-medium text-counsel-fg underline-offset-2 hover:underline" data-testid="open-queue">Open queue →</Link>
        <button type="button" onClick={() => setMode("founder")} data-testid="exit-counsel"
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-text-2 transition-colors duration-fast hover:bg-surface hover:text-text">
          <X className="h-3.5 w-3.5" aria-hidden /> Exit <Kbd>Esc</Kbd>
        </button>
      </div>
    </div>
  );
}

const CheckActions = (p: SlotProps["check.actions"]) => <div className="mt-3"><DecisionBar findingId={p.findingId} releaseId={p.releaseId} /></div>;
const AnnotationActions = (p: SlotProps["annotation.actions"]) => <DecisionBar findingId={p.findingId} releaseId={p.releaseId} compact />;

export function register(): void {
  registerSlot("release.banner", CounselBanner, { id: "counsel-banner", order: 0 });
  registerSlot("check.actions", CheckActions, { id: "counsel-check" });
  registerSlot("annotation.actions", AnnotationActions, { id: "counsel-annotation" });
}
