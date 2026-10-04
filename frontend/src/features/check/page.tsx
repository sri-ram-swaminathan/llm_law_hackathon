import { LegacyReleasePage } from "@/app/legacy";
import { FindingPage } from "@/features/finding";

/**
 * Compliance check `…/risks/:findingId` — T27 STUB: the legacy finding page. T29 replaces this file (DESIGN §4.6).
 * Render `<Slot name="check.actions" props={{ findingId, releaseId }} />` below the verdict (counsel bar, T31).
 */
export default function CheckPage() {
  return <LegacyReleasePage><FindingPage /></LegacyReleasePage>;
}
