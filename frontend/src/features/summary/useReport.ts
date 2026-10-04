import { useMemo } from "react";
import type { LegalProvision, ReleaseOut } from "@/api/client";
import { reqIndex, useFindings, useProvisions, useReadiness, useRequirements, useRunSummary } from "@/lib/queries";
import { checked } from "./model";

/** Everything a release report needs, fetched once and shared by the product hero and the Summary. */
export function useReport(release: ReleaseOut | undefined) {
  const releaseId = release?.release.id;
  const readiness = useReadiness(release?.latest_assessment ? releaseId : undefined);
  const findings = useFindings(release?.latest_assessment ? releaseId : undefined);
  const reqs = useRequirements();
  const run = useRunSummary(release?.latest_assessment?.run_id);
  const ids = useMemo(() => {
    const s = new Set<string>();
    for (const f of findings.data ?? []) for (const c of f.citations ?? []) s.add(c);
    return [...s];
  }, [findings.data]);
  const provQ = useProvisions(ids);
  const provKey = provQ.map((q) => q.dataUpdatedAt).join();
  const provisions = useMemo(
    () => new Map<string, LegalProvision | null | undefined>(ids.map((id, i) => [id, provQ[i]?.data])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, provKey],
  );
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const value = useMemo(
    () => checked(release, findings.data, provisions, readiness.data, run.data),
    [release, findings.data, provisions, readiness.data, run.data],
  );
  return {
    releaseId,
    readiness,
    findings,
    reqs: idx,
    run,
    live: run.data?.status === "running",
    checked: value,
    assessed: !!release?.latest_assessment,
  };
}
