import type { components } from "./types";
import packFixture from "@fixtures/requirements.json";

type S = components["schemas"];
export type ReleaseOut = S["ReleaseOut"];
export type Readiness = S["Readiness"];
export type FindingView = S["FindingView"];
export type Requirement = S["Requirement"];
export type AgentEvent = S["AgentEvent"];
export type Review = S["Review"];
export type LegalProvision = S["LegalProvision"];
export type Artifact = S["Artifact"];

export const FIXTURES = import.meta.env.VITE_FIXTURES === "1";
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:20000";
const TOKEN_KEY = "cco.deployToken";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
};
/** The deploy-token prompt is needed only against a real backend and when no token is stored yet. */
export const needsToken = () => !FIXTURES && !getToken();

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, "X-Deploy-Token": token } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("json") ? res.json() : res.text()) as Promise<T>;
}

/* ---------------- fixtures mode ---------------- */

type FixtureBundle = {
  release: S["Release"]; artifacts: Artifact[]; assessment: S["Assessment"];
  findings: FindingView[]; reviews: Review[]; readiness: Readiness;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let bundles: Promise<FixtureBundle[]> | null = null;
const loadBundles = () =>
  (bundles ??= Promise.all([
    import("@fixtures/release-0.9.0.json"),
    import("@fixtures/release-1.0.0-rc.json"),
    import("@fixtures/release-1.0.0.json"),
  ]).then((m) => m.map((x) => (x.default ?? x) as unknown as FixtureBundle)));

const fx = async <T>(pick: (b: FixtureBundle[]) => T): Promise<T> => {
  const b = await loadBundles();
  await sleep(60); // let loading states render once
  return pick(b);
};
const byRelease = (b: FixtureBundle[], id: string) => {
  const r = b.find((x) => x.release.id === id);
  if (!r) throw new ApiError(404, `release ${id} not found`);
  return r;
};

/* ---------------- public API ---------------- */

export const api = {
  releases: (): Promise<ReleaseOut[]> =>
    FIXTURES
      ? fx((b) => b.map((x) => ({ release: x.release, artifacts: x.artifacts, latest_assessment: x.assessment })))
      : http("/api/releases"),
  release: (id: string): Promise<ReleaseOut> =>
    FIXTURES
      ? fx((b) => { const x = byRelease(b, id); return { release: x.release, artifacts: x.artifacts, latest_assessment: x.assessment }; })
      : http(`/api/releases/${id}`),
  readiness: (releaseId: string): Promise<Readiness> =>
    FIXTURES ? fx((b) => byRelease(b, releaseId).readiness) : http(`/api/releases/${releaseId}/readiness`),
  /** Findings of a release's latest assessment (fixtures resolve the assessment from the release). */
  findings: (releaseId: string): Promise<FindingView[]> =>
    FIXTURES
      ? fx((b) => byRelease(b, releaseId).findings)
      : http<ReleaseOut>(`/api/releases/${releaseId}`).then((r) =>
          r.latest_assessment ? http<FindingView[]>(`/api/assessments/${r.latest_assessment.id}/findings`) : []),
  /** The pack has no list endpoint in the contract yet; the committed pack fixture supplies aliases/domains in both modes. */
  requirements: (): Promise<Requirement[]> => Promise.resolve(packFixture.requirements as unknown as Requirement[]),
  startAssessment: (releaseId: string): Promise<S["AssessmentCreated"] | null> =>
    FIXTURES ? Promise.resolve(null) : http(`/api/releases/${releaseId}/assessments`, { method: "POST" }),
};
