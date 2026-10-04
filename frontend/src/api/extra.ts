import type { components } from "./types";

/**
 * Hand-declared API types that `types.ts` (generated) does not carry yet (DESIGN §6).
 * Shapes follow DESIGN §6 exactly. When T26's regenerated `types.ts` lands, replace each declaration
 * with a re-export (`export type DemoState = components["schemas"]["DemoState"]`) — callers import from
 * here or from `api/client.ts`, never from `types.ts`, so nothing else changes.
 */

type S = components["schemas"];

export type Organization = { id: string; name: string };

/** `GET /api/product` (+ B1's optional `organization`; dropped server-side, filled from `lib/routes.ORG`). */
export type ProductOut = S["ProductOut"] & { organization?: Organization | null };

/** `GET /api/runs/{id}` and items of `GET /api/runs?release_id=` (backend/cco/api/runs.py `_summary`). */
export type RunSummary = {
  run_id: string;
  run_kind: "assessment" | "mcp" | null;
  /** `running` is the only state that may be labelled "Live". */
  status: "running" | "ok" | "failed";
  started_at: string | null;
  ended_at: string | null;
  totals: { events: number; tokens: number; tool_calls: number; retries: number; findings: number; errors: number; latency_ms: number };
};

/** One release of the recorded demo snapshot (`demo/snapshot/manifest.json`). */
export type ManifestRelease = {
  version: string;
  file: string;
  /** e.g. "RomanGrebnev/FinTechProto" */
  repo: string;
  /** git ref the bundle was built from, e.g. "v0.9.0" or "demo/v1" */
  ref: string;
  /** full commit sha */
  commit: string;
  gate: S["Readiness"]["gate"];
  seconds: number;
  eval: string;
};

export type DemoManifest = {
  captured_at: string;
  model: string;
  pack_version: string;
  ccommit_commit: string;
  /** The version Start demo ingests and runs live ("0.9.0"). */
  live_target: string;
  releases: ManifestRelease[];
};

/** `GET /api/demo`. `enabled:false` → no Start demo button. */
export type DemoState = { enabled: boolean; snapshot?: DemoManifest | null };

export type DemoProvenance = { repo: string; ref: string; commit: string };

/** `POST /api/demo/start` → 202. Navigate to the release Summary; the run is live until `run_end`. */
export type DemoStartOut = { release: S["Release"]; assessment_id: string; run_id: string; provenance: DemoProvenance };

/** `POST /api/demo/reset` → 200. */
export type DemoResetOut = { releases: string[]; captured_at: string };
