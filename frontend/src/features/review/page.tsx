import { Gavel } from "lucide-react";
import { EmptyState } from "@/components/feedback";

/**
 * Counsel review queue `…/review[/:findingId]` — T27 STUB. T31 replaces this file (DESIGN §4.10).
 * The route is already counsel-only (founder mode redirects to …/risks; see app/ReleaseLayout `CounselOnly`).
 */
export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-testid="review-page">
      <EmptyState icon={Gavel} title="Review queue">The counsel review queue arrives with the counsel-mode task.</EmptyState>
    </div>
  );
}
