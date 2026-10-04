import { LegacyReleasePage } from "@/app/legacy";
import { OverviewPage } from "@/features/overview";

/**
 * Summary `…/summary` — T27 STUB: the legacy overview under the new route. T28 replaces this file (DESIGN §4.4).
 * Render `<Slot name="summary.liveOverlay" props={{ releaseId, runId }} />` while a run is in flight.
 */
export default function SummaryPage() {
  return <LegacyReleasePage><OverviewPage /></LegacyReleasePage>;
}
