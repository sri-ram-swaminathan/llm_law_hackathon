import { LegacyReleasePage } from "@/app/legacy";
import { FindingsListPage } from "@/features/findings";

/** Risks `…/risks` — T27 STUB: the legacy findings list. T29 replaces this file (DESIGN §4.5). */
export default function RisksPage() {
  return <LegacyReleasePage><FindingsListPage /></LegacyReleasePage>;
}
