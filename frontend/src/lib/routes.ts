import { useParams } from "react-router";

/**
 * Route seam (frozen by T27). Every link in the app is built here, never by string concat in a feature.
 *
 * IA (DESIGN §2):
 *   /                                    workspace home
 *   /p/:productId                        product home (timeline)
 *   /p/:productId/profile                regulatory profile
 *   /p/:productId/v/:version/<tab>       release report; <tab> ∈ RELEASE_TABS
 *
 * URLs carry the readable `version` ("0.9.0"); release ids follow `rel-<version>`.
 * Resolve a version to a release with `useReleaseByVersion` (lib/queries.ts), never by building the id.
 */

/** The single organisation of the V1 workspace (B1 dropped: frontend constant). */
export const ORG = { id: "wealthpilot-sas", name: "Wealthpilot SAS" } as const;
/** The product every legacy URL maps to. */
export const DEFAULT_PRODUCT_ID = "wealthpilot";

export const RELEASE_TABS = ["summary", "risks", "documents", "code", "fix-plan", "activity", "review"] as const;
export type ReleaseTab = (typeof RELEASE_TABS)[number];

type Query = Record<string, string | number | null | undefined>;
const qs = (q?: Query) => {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
const seg = (s: string) => encodeURIComponent(s);
/** Strips a leading "v" so `v0.9.0` and `0.9.0` build the same URL. */
export const bareVersion = (v: string) => v.replace(/^v(?=\d)/, "");

/** Path builders. `version` is the bare semver ("0.9.0"); a leading "v" is tolerated. */
export const paths = {
  home: () => "/",
  product: (productId = DEFAULT_PRODUCT_ID) => `/p/${seg(productId)}`,
  profile: (productId = DEFAULT_PRODUCT_ID) => `/p/${seg(productId)}/profile`,
  /** Release root; redirects to the Summary tab. */
  release: (productId: string, version: string, tab?: ReleaseTab) =>
    `/p/${seg(productId)}/v/${seg(bareVersion(version))}${tab ? `/${tab}` : ""}`,
  summary: (productId: string, version: string) => paths.release(productId, version, "summary"),
  /** Risks list, or the compliance check of one finding. */
  risks: (productId: string, version: string, findingId?: string) =>
    paths.release(productId, version, "risks") + (findingId ? `/${seg(findingId)}` : ""),
  /** Documents; `f` focuses a finding's highlight. */
  documents: (productId: string, version: string, artifactId?: string, q?: { f?: string }) =>
    paths.release(productId, version, "documents") + (artifactId ? `/${seg(artifactId)}` : "") + qs(q),
  /** Code; `path` opens a file, `f` focuses a finding's lines. */
  code: (productId: string, version: string, q?: { path?: string; f?: string }) => paths.release(productId, version, "code") + qs(q),
  fixPlan: (productId: string, version: string) => paths.release(productId, version, "fix-plan"),
  /** Activity; `run` selects a run other than the latest assessment's. */
  activity: (productId: string, version: string, q?: { run?: string }) => paths.release(productId, version, "activity") + qs(q),
  /** Counsel review queue (counsel mode only; founder mode redirects to risks). */
  review: (productId: string, version: string, findingId?: string) =>
    paths.release(productId, version, "review") + (findingId ? `/${seg(findingId)}` : ""),
};

/** `rel-0.9.0` → `0.9.0` (the release-id convention). */
export const versionFromReleaseId = (id: string) => id.replace(/^rel-/, "");
/** `0.9.0` → `rel-0.9.0`. Only for legacy URLs; prefer `useReleaseByVersion`. */
export const releaseIdFromVersion = (v: string) => `rel-${bareVersion(v)}`;

/**
 * Maps a legacy (pre-redesign) URL to the new IA, or null when the path is not legacy.
 * Pure, so the whole table is unit-tested (routes.test.ts).
 *   /profile → /p/wealthpilot/profile · /releases → /p/wealthpilot
 *   /r/:id[/overview] → …/summary · /r/:id/findings[/:fid] → …/risks[/:fid]
 *   /r/:id/evidence[/:aid] → …/documents[/:aid] (`code_repo` → …/code, decided by the caller via `isCodeArtifact`)
 *   /r/:id/fix-plan → …/fix-plan
 */
export function legacyToNew(pathname: string, search = "", isCodeArtifact?: (artifactId: string) => boolean): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  const pid = DEFAULT_PRODUCT_ID;
  if (p === "/profile") return paths.profile(pid);
  if (p === "/releases") return paths.product(pid);
  const m = p.match(/^\/r\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/);
  if (!m) return null;
  const [, rid, section, sub] = m;
  const v = versionFromReleaseId(decodeURIComponent(rid));
  const keep = search && search !== "?" ? search : "";
  switch (section) {
    case undefined:
    case "overview":
      return paths.summary(pid, v) + keep;
    case "findings":
      return paths.risks(pid, v, sub && decodeURIComponent(sub)) + keep;
    case "evidence":
      if (sub && isCodeArtifact?.(decodeURIComponent(sub))) return paths.code(pid, v);
      return paths.documents(pid, v, sub && decodeURIComponent(sub)) + keep;
    case "fix-plan":
      return paths.fixPlan(pid, v) + keep;
    default:
      return paths.summary(pid, v);
  }
}

/** Params of a release route. `version` is bare ("0.9.0"). */
export function useReleaseParams(): { productId: string; version: string; findingId?: string; artifactId?: string } {
  const p = useParams();
  return {
    productId: p.productId ?? DEFAULT_PRODUCT_ID,
    version: bareVersion(p.version ?? ""),
    findingId: p.findingId,
    artifactId: p.artifactId,
  };
}
