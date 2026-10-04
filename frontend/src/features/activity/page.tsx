import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ActivityPanel } from "@/features/activity";
import { openActivity } from "@/lib/activityStore";
import { useCurrentRelease } from "@/lib/queries";

/**
 * Activity `…/activity[?run=]` — T27 STUB: opens the legacy slide-over on the release's run. T32 replaces this file (DESIGN §4.11)
 * and contributes the run strip via the `release.runStrip` slot.
 */
export default function ActivityPage() {
  const { release } = useCurrentRelease();
  const [sp] = useSearchParams();
  const runId = sp.get("run") ?? release?.latest_assessment?.run_id ?? null;
  useEffect(() => { openActivity(runId); }, [runId]);
  return <ActivityPanel />;
}
