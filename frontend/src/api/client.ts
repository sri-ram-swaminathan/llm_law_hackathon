import type { components } from "./types";
import type { DemoManifest, DemoResetOut, DemoStartOut, DemoState, ProductOut, RunSummary } from "./extra";
import packFixture from "@fixtures/requirements.json";
import provisionFixture from "@fixtures/provisions.json";

/**
 * API client seam (frozen by T27). Every endpoint the UI calls lives in `api` below, with a fixture
 * fallback when `VITE_FIXTURES=1`. Features call `api.*` (or the hooks in lib/queries.ts), never `fetch`.
 * Fixture state is in memory: reviews and profile edits survive until reload; `api.demoReset()` restores it.
 */

type S = components["schemas"];
export type ReleaseOut = S["ReleaseOut"];
export type Release = S["Release"];
export type Readiness = S["Readiness"];
export type FindingView = S["FindingView"];
export type FindingDetail = S["FindingDetail"];
export type Requirement = S["Requirement"];
export type AgentEvent = S["AgentEvent"];
export type Review = S["Review"];
export type ReviewCreate = S["ReviewCreate"];
export type LegalProvision = S["LegalProvision"];
export type Artifact = S["Artifact"];
export type Assessment = S["Assessment"];
export type AssessmentCreated = S["AssessmentCreated"];
export type Profile = S["RegulatoryProfile"];
export type { DemoManifest, DemoResetOut, DemoStartOut, DemoState, ProductOut, RunSummary } from "./extra";
export type { Organization, ManifestRelease, DemoProvenance } from "./extra";

export const FIXTURES = import.meta.env.VITE_FIXTURES === "1";
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:20000";

/* ---------------- auth (deploy token) ---------------- */

const TOKEN_KEY = "cco.deployToken";
const authListeners = new Set<() => void>();
let authVersion = 0;
const emitAuth = () => { authVersion++; authListeners.forEach((l) => l()); };

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
  emitAuth();
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  emitAuth();
};
/** The deploy-token prompt is needed only against a real backend and when no token is stored yet (or a 401 cleared it). */
export const needsToken = () => !FIXTURES && !getToken();
/** For `useSyncExternalStore`: re-render when the token is set or cleared. */
export const authStore = {
  subscribe: (l: () => void) => (authListeners.add(l), () => { authListeners.delete(l); }),
  version: () => authVersion,
};

/* ---------------- http ---------------- */

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: string) { super(message); }
}

/** Plain-words reason for a failed call (Banner copy). */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "The CCOmmit server can't be reached.";
    if (e.status === 401) return "Your deploy token was rejected.";
    if (e.status === 404) return e.detail ?? "Not found.";
    if (e.status === 409) return e.detail ?? "A run is already in progress.";
    if (e.status >= 500) return "The server hit an error. Try again in a moment.";
    return e.detail ?? e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  // Nothing fetches before the token exists: avoids the first-load 401 in the console.
  if (!FIXTURES && !token) throw new ApiError(401, "401 no token");
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token}`,
        "X-Deploy-Token": token ?? "",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "network error");
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch { /* not json */ }
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, `${res.status} ${res.statusText}`, detail);
  }
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("json") ? res.json() : res.text()) as Promise<T>;
}

/* ---------------- fixtures mode ---------------- */

type FixtureBundle = {
  release: Release; artifacts: Artifact[]; assessment: Assessment;
  findings: FindingView[]; reviews: Review[]; readiness: Readiness;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

let bundles: Promise<FixtureBundle[]> | null = null;
const loadBundles = () =>
  (bundles ??= Promise.all([
    import("@fixtures/release-0.9.0.json"),
    import("@fixtures/release-1.0.0-rc.json"),
    import("@fixtures/release-1.0.0.json"),
  ]).then((m) => m.map((x) => clone((x.default ?? x) as unknown as FixtureBundle))));

const fx = async <T,>(pick: (b: FixtureBundle[]) => T): Promise<T> => {
  const b = await loadBundles();
  await sleep(60); // let loading states render once
  return pick(b);
};
const byRelease = (b: FixtureBundle[], id: string) => {
  const r = b.find((x) => x.release.id === id);
  if (!r) throw new ApiError(404, `release ${id} not found`, "This release doesn't exist.");
  return r;
};
const toOut = (x: FixtureBundle): ReleaseOut => ({ release: x.release, artifacts: x.artifacts, latest_assessment: x.assessment });
const fxProvisions = (provisionFixture as unknown as { provisions: LegalProvision[] }).provisions;
const fxRequirements = packFixture.requirements as unknown as Requirement[];

const FIXTURE_PRODUCT: ProductOut = {
  organization: { id: "wealthpilot-sas", name: "Wealthpilot SAS" },
  product: {
    id: "wealthpilot", organization_id: "wealthpilot-sas", name: "Wealthpilot",
    description: "AI-generated, personalised portfolio recommendations for French retail investors. No trade execution.",
  },
  profile: {
    jurisdictions: ["EU", "FR"],
    industry: "Fintech: investment advice",
    activities: ["Personalised investment recommendations", "Portfolio tracking", "Onboarding with risk profiling"],
    customer_types: ["Retail investors (consumers)"],
    data_categories: ["Identity and contact data", "Financial situation and goals", "Portfolio holdings", "Account credentials"],
    ai_uses: ["LLM-generated investment recommendations", "AI-generated market summaries"],
    stage: "pre-launch",
    confirmed_at: null,
  },
};
let fixtureProduct = clone(FIXTURE_PRODUCT);

let fixtureEvents: Promise<AgentEvent[]> | null = null;
const loadEvents = () =>
  (fixtureEvents ??= import("@fixtures/events-0.9.0.json").then((m) => (m.default ?? m) as unknown as AgentEvent[]));

async function fixtureRun(b: FixtureBundle[], runId: string): Promise<RunSummary> {
  const x = b.find((r) => r.assessment.run_id === runId);
  if (!x) throw new ApiError(404, "run not found", "This run doesn't exist.");
  const evs = (await loadEvents()).filter((e) => e.run_id === runId);
  const n = (t: AgentEvent["type"]) => evs.filter((e) => e.type === t).length;
  return {
    run_id: runId,
    run_kind: "assessment",
    status: "ok", // fixtures never claim a live run
    started_at: evs[0]?.ts ?? x.assessment.started_at ?? null,
    ended_at: evs.at(-1)?.ts ?? x.assessment.finished_at ?? null,
    totals: {
      events: evs.length, tokens: evs.reduce((s, e) => s + (e.tokens ?? 0), 0), tool_calls: n("tool_call"),
      retries: n("retry"), findings: evs.length ? n("finding") : x.findings.length, errors: evs.filter((e) => e.error).length,
      latency_ms: evs.reduce((s, e) => s + (e.latency_ms ?? 0), 0),
    },
  };
}

const fixtureManifest = (b: FixtureBundle[]): DemoManifest => ({
  captured_at: b.at(-1)?.assessment.finished_at ?? "2026-10-04T16:46:15Z",
  model: b[0]?.assessment.model ?? "codestral-latest",
  pack_version: b[0]?.assessment.pack_version ?? "",
  ccommit_commit: "fixtures",
  live_target: "0.9.0",
  releases: b.map((x) => ({
    version: x.release.version, file: `${x.release.version}.result.json`, repo: "RomanGrebnev/FinTechProto",
    ref: x.release.branch ?? "", commit: x.release.git_sha ?? "", gate: x.readiness.gate,
    seconds: Math.round((Date.parse(x.assessment.finished_at ?? "") - Date.parse(x.assessment.started_at ?? "")) / 1000) || 0,
    eval: "match",
  })),
});

/** Applies a review to a fixture finding and refreshes the counsel-reviewed count (the gate itself is not recomputed). */
function applyFixtureReview(b: FixtureBundle[], findingId: string, review: Review | null) {
  for (const x of b) {
    const f = x.findings.find((y) => y.id === findingId);
    if (!f) continue;
    f.applicable_review = review;
    f.effective_conclusion = review
      ? review.decision === "confirm" ? f.conclusion
        : review.decision === "override" ? review.override_conclusion ?? f.conclusion
        : review.decision === "not_applicable" ? "not_applicable" : "insufficient_evidence"
      : f.conclusion;
    if (review) x.reviews.push(review);
    x.readiness.counsel_reviewed = { ...x.readiness.counsel_reviewed, reviewed: x.findings.filter((y) => y.applicable_review).length };
    return f;
  }
  throw new ApiError(404, "finding not found", "This risk doesn't exist.");
}

/* ---------------- public API ---------------- */

export const api = {
  /** `GET /api/product`. `organization` may be absent on the live API: use `lib/routes.ORG` as the fallback. */
  product: (): Promise<ProductOut> => (FIXTURES ? fx(() => clone(fixtureProduct)) : http("/api/product")),
  /** `PUT /api/product/profile`. */
  updateProfile: async (p: Profile): Promise<ProductOut> => {
    if (FIXTURES) {
      await sleep(300);
      fixtureProduct = { ...fixtureProduct, profile: { ...p, confirmed_at: new Date().toISOString() } };
      return clone(fixtureProduct);
    }
    const res = await http<ProductOut | Profile>("/api/product/profile", { method: "PUT", body: JSON.stringify(p) });
    return "profile" in res ? res : { ...(await http<ProductOut>("/api/product")), profile: res };
  },

  /** `GET /api/releases` (all releases with artifacts and latest assessment). Order is not guaranteed: sort with `bySemverDesc`. */
  releases: (): Promise<ReleaseOut[]> => (FIXTURES ? fx((b) => b.map(toOut)) : http("/api/releases")),
  release: (id: string): Promise<ReleaseOut> => (FIXTURES ? fx((b) => toOut(byRelease(b, id))) : http(`/api/releases/${id}`)),
  readiness: (releaseId: string): Promise<Readiness> =>
    FIXTURES ? fx((b) => clone(byRelease(b, releaseId).readiness)) : http(`/api/releases/${releaseId}/readiness`),
  /** Findings of a release's latest assessment ([] when never assessed). */
  findings: (releaseId: string): Promise<FindingView[]> =>
    FIXTURES
      ? fx((b) => clone(byRelease(b, releaseId).findings))
      : http<ReleaseOut>(`/api/releases/${releaseId}`).then((r) =>
          r.latest_assessment ? http<FindingView[]>(`/api/assessments/${r.latest_assessment.id}/findings`) : []),
  /** `GET /api/findings/{id}`: finding + requirement + provisions (citation order) + reviews. */
  finding: (findingId: string): Promise<FindingDetail> =>
    FIXTURES
      ? fx((b) => {
          for (const x of b) {
            const f = x.findings.find((y) => y.id === findingId);
            if (!f) continue;
            const requirement = fxRequirements.find((r) => r.id === f.requirement_id)!;
            const provisions = (f.citations ?? []).map((c) => fxProvisions.find((p) => p.id === c)).filter((p): p is LegalProvision => !!p);
            return clone({ finding: f, requirement, provisions, reviews: x.reviews.filter((r) => r.finding_id === f.id) });
          }
          throw new ApiError(404, "finding not found", "This risk doesn't exist.");
        })
      : http(`/api/findings/${encodeURIComponent(findingId)}`),
  /** The pack has no list endpoint; the committed pack fixture supplies aliases/domains in both modes (same file seeds the DB). */
  requirements: (): Promise<Requirement[]> => Promise.resolve(fxRequirements),
  /** `GET /api/provisions/{id}`; resolves null when it can't be loaded (the card says so). */
  provision: async (id: string): Promise<LegalProvision | null> => {
    if (FIXTURES) return fxProvisions.find((p) => p.id === id) ?? null;
    try { return await http<LegalProvision>(`/api/provisions/${encodeURIComponent(id)}`); } catch { return null; }
  },

  /** `POST /api/releases/{id}/assessments`. 409 = a run is in flight. Fixtures return the recorded run (replayed, never "Live"). */
  startAssessment: (releaseId: string): Promise<AssessmentCreated> =>
    FIXTURES
      ? fx((b) => { const x = byRelease(b, releaseId); return { assessment_id: x.assessment.id, run_id: x.assessment.run_id, status: "replay" }; })
      : http(`/api/releases/${releaseId}/assessments`, { method: "POST" }),

  /** `GET /api/runs?release_id=` newest first. */
  runs: (releaseId: string): Promise<RunSummary[]> =>
    FIXTURES
      ? fx((b) => byRelease(b, releaseId)).then(async (x) => [await fixtureRun(await loadBundles(), x.assessment.run_id)])
      : http(`/api/runs?release_id=${encodeURIComponent(releaseId)}`),
  /** `GET /api/runs/{id}`: status running|ok|failed, timings, totals. */
  run: (runId: string): Promise<RunSummary> =>
    FIXTURES ? loadBundles().then((b) => fixtureRun(b, runId)) : http(`/api/runs/${encodeURIComponent(runId)}`),
  /** Recorded events of the fixture run (fixtures only; the live stream is `features/activity/stream.ts`). */
  fixtureEvents: loadEvents,

  /** `POST /api/findings/{id}/reviews`. Invalidate readiness, findings and finding afterwards. */
  createReview: async (findingId: string, body: ReviewCreate): Promise<Review> => {
    if (FIXTURES) {
      await sleep(250);
      const b = await loadBundles();
      const f = b.flatMap((x) => x.findings).find((y) => y.id === findingId);
      if (!f) throw new ApiError(404, "finding not found");
      const review: Review = {
        id: `rv-local-${Date.now()}`, finding_id: findingId, product_id: "wealthpilot", requirement_id: f.requirement_id,
        evidence_fingerprint: f.evidence_fingerprint, created_at: new Date().toISOString(), revoked_at: null,
        override_conclusion: body.override_conclusion ?? null, ...body,
      };
      applyFixtureReview(b, findingId, review);
      return review;
    }
    return http(`/api/findings/${encodeURIComponent(findingId)}/reviews`, { method: "POST", body: JSON.stringify(body) });
  },
  /** `POST /api/reviews/{id}/revoke`. */
  revokeReview: async (reviewId: string): Promise<void> => {
    if (FIXTURES) {
      await sleep(200);
      const b = await loadBundles();
      const f = b.flatMap((x) => x.findings).find((y) => y.applicable_review?.id === reviewId);
      if (f) applyFixtureReview(b, f.id, null);
      return;
    }
    await http(`/api/reviews/${encodeURIComponent(reviewId)}/revoke`, { method: "POST" });
  },

  /** `GET /api/demo` (B5). Fixtures: enabled, with a manifest built from the sample releases. */
  demo: (): Promise<DemoState> =>
    FIXTURES
      ? fx((b) => ({ enabled: true, snapshot: fixtureManifest(b) }))
      : http<DemoState>("/api/demo").catch((e) => {
          if (e instanceof ApiError && e.status === 404) return { enabled: false };
          throw e;
        }),
  /** `POST /api/demo/start` → 202. Fixtures return the recorded v0.9.0 run, labelled "Simulated (sample data)" by the UI. */
  demoStart: (): Promise<DemoStartOut> =>
    FIXTURES
      ? fx((b) => {
          const x = b.find((r) => r.release.version === "0.9.0") ?? b[0];
          return {
            release: x.release, assessment_id: x.assessment.id, run_id: x.assessment.run_id,
            provenance: { repo: "RomanGrebnev/FinTechProto", ref: `v${x.release.version}`, commit: x.release.git_sha ?? "" },
          };
        })
      : http("/api/demo/start", { method: "POST" }),
  /** `POST /api/demo/reset`. Fixtures drop every in-memory change (reviews, profile). */
  demoReset: async (): Promise<DemoResetOut> => {
    if (FIXTURES) {
      bundles = null;
      fixtureProduct = clone(FIXTURE_PRODUCT);
      const b = await fx((x) => x);
      return { releases: b.map((x) => x.release.version), captured_at: fixtureManifest(b).captured_at };
    }
    return http("/api/demo/reset", { method: "POST" });
  },
};
