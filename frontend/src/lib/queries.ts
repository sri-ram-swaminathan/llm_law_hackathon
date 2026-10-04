import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, type Requirement, type ReleaseOut, type ReviewCreate } from "@/api/client";
import { bareVersion, useReleaseParams } from "./routes";
import { bySemverDesc } from "./semver";

/**
 * Data hooks seam (frozen by T27). Query keys are part of the contract (`qk`): invalidate with them.
 *   qk.releases            all releases              qk.release(id)       one release + artifacts
 *   qk.readiness(id)       gate of a release         qk.findings(id)      findings of its latest assessment
 *   qk.finding(fid)        FindingDetail             qk.provision(pid)    one legal provision
 *   qk.runs(id)            runs of a release         qk.run(runId)        one run summary
 *   qk.product · qk.demo · qk.requirements
 */
export const qk = {
  releases: ["releases"] as const,
  release: (id: string) => ["release", id] as const,
  readiness: (id: string) => ["readiness", id] as const,
  findings: (id: string) => ["findings", id] as const,
  finding: (fid: string) => ["finding", fid] as const,
  provision: (pid: string) => ["provision", pid] as const,
  runs: (id: string) => ["runs", id] as const,
  run: (runId: string) => ["run", runId] as const,
  product: ["product"] as const,
  demo: ["demo"] as const,
  requirements: ["requirements"] as const,
};

/** After a run, review or upload: refresh everything that derives from findings. */
export function invalidateAssessmentData(qc: QueryClient) {
  for (const k of ["releases", "release", "readiness", "findings", "finding", "runs", "run"]) qc.invalidateQueries({ queryKey: [k] });
}

export const useProduct = () => useQuery({ queryKey: qk.product, queryFn: api.product });
export const useReleases = () => useQuery({ queryKey: qk.releases, queryFn: api.releases });
export const useRelease = (id: string | undefined) =>
  useQuery({ queryKey: qk.release(id ?? ""), queryFn: () => api.release(id!), enabled: !!id });
export const useReadiness = (rel: string | undefined) =>
  useQuery({ queryKey: qk.readiness(rel ?? ""), queryFn: () => api.readiness(rel!), enabled: !!rel });
/** Readiness for several releases at once (timeline, version popover). Same cache entries as `useReadiness`. */
export const useReadinessMany = (ids: string[]) =>
  useQueries({ queries: ids.map((id) => ({ queryKey: qk.readiness(id), queryFn: () => api.readiness(id) })) });
export const useFindings = (rel: string | undefined) =>
  useQuery({ queryKey: qk.findings(rel ?? ""), queryFn: () => api.findings(rel!), enabled: !!rel });
export const useFinding = (fid: string | undefined) =>
  useQuery({ queryKey: qk.finding(fid ?? ""), queryFn: () => api.finding(fid!), enabled: !!fid });
export const useProvisions = (ids: string[]) =>
  useQueries({ queries: ids.map((id) => ({ queryKey: qk.provision(id), queryFn: () => api.provision(id), staleTime: Infinity })) });
export const useRequirements = () => useQuery({ queryKey: qk.requirements, queryFn: api.requirements, staleTime: Infinity });

/** Releases newest-first by semver (the only order the UI shows). */
export const useReleasesSorted = () => {
  const q = useReleases();
  return { ...q, data: q.data ? bySemverDesc(q.data) : undefined };
};

export type ReleaseByVersion = {
  release: ReleaseOut | undefined;
  releaseId: string | undefined;
  isPending: boolean;
  error: unknown;
  /** The list loaded and has no such version: render <NotFound>. */
  notFound: boolean;
};
/** Resolves a URL version ("0.9.0" or "v0.9.0") through `GET /releases`. */
export function useReleaseByVersion(version: string | undefined): ReleaseByVersion {
  const q = useReleases();
  const v = version ? bareVersion(version) : "";
  const release = q.data?.find((r) => r.release.version === v);
  return { release, releaseId: release?.release.id, isPending: q.isPending, error: q.error, notFound: !!q.data && !release };
}
/** The release of the current `/p/:productId/v/:version/*` route. */
export const useCurrentRelease = () => {
  const { productId, version } = useReleaseParams();
  return { productId, version, ...useReleaseByVersion(version) };
};

/** Runs of a release, newest first. */
export const useRuns = (releaseId: string | undefined) =>
  useQuery({ queryKey: qk.runs(releaseId ?? ""), queryFn: () => api.runs(releaseId!), enabled: !!releaseId });
/** One run summary; polls every `pollMs` while `status === "running"` (default 2 s). */
export const useRunSummary = (runId: string | null | undefined, pollMs = 2000) =>
  useQuery({
    queryKey: qk.run(runId ?? ""),
    queryFn: () => api.run(runId!),
    enabled: !!runId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? pollMs : false),
  });

/** `GET /api/demo`; `data.enabled === false` hides every demo control. */
export const useDemo = () => useQuery({ queryKey: qk.demo, queryFn: api.demo, staleTime: 60_000 });
export function useStartDemo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.demoStart, onSuccess: () => qc.invalidateQueries() });
}
export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.demoReset, onSuccess: () => qc.invalidateQueries() });
}

/** Re-run on one release (the release in the URL, never "the first"). 409 → `ApiError.status === 409`. */
export function useStartAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: string) => api.startAssessment(releaseId),
    onSuccess: (_d, releaseId) => {
      qc.invalidateQueries({ queryKey: qk.runs(releaseId) });
      qc.invalidateQueries({ queryKey: qk.releases });
    },
  });
}

/** Record a counsel decision on a finding; refreshes readiness, findings and the finding detail. */
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, body }: { findingId: string; body: ReviewCreate }) => api.createReview(findingId, body),
    onSuccess: () => invalidateAssessmentData(qc),
  });
}
export function useRevokeReview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (reviewId: string) => api.revokeReview(reviewId), onSuccess: () => invalidateAssessmentData(qc) });
}

/** requirement id → requirement. `alias` is the short id shown in the UI (W1..W8, C1, C2). */
export const reqIndex = (reqs: Requirement[] | undefined) => new Map((reqs ?? []).map((r) => [r.id, r]));
export const aliasOf = (m: Map<string, Requirement>, id: string) => m.get(id)?.alias ?? id;
export { versionLabel } from "./format";
/** @deprecated creation order; the UI orders by semver (`bySemverDesc` / `useReleasesSorted`). */
export const sortReleases = <T extends { release: { created_at?: string | null } }>(l: T[]) =>
  [...l].sort((a, b) => (a.release.created_at ?? "").localeCompare(b.release.created_at ?? ""));
