import { LegacyReleasePage } from "@/app/legacy";
import { EvidencePage } from "@/features/evidence";

/**
 * Documents `…/documents[/:artifactId]` (`?f=` focuses) — T27 STUB: the legacy evidence room. T30 replaces this file (DESIGN §4.7).
 * Margin notes render `<Slot name="annotation.actions" props={{ findingId, releaseId, compact: true }} />`.
 */
export default function DocumentsPage() {
  return <LegacyReleasePage><EvidencePage /></LegacyReleasePage>;
}
