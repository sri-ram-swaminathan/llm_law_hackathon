import { useContext, useMemo, type ReactNode } from "react";
import { Navigate, UNSAFE_RouteContext, useLocation } from "react-router";
import { useCurrentRelease, useReleases } from "@/lib/queries";
import { legacyToNew } from "@/lib/routes";

/**
 * Transitional bridge: pre-redesign pages read `useParams().release` (a release id). This overlays
 * params on the current route match so those pages work under the new `/p/:productId/v/:version/*`
 * routes until their W2 task replaces the `features/<x>/page.tsx` stub. Delete with the last legacy page.
 */
export function LegacyParams({ params, children }: { params: Record<string, string | undefined>; children: ReactNode }) {
  const ctx = useContext(UNSAFE_RouteContext);
  const value = useMemo(() => {
    const matches = ctx.matches.map((m, i) => (i === ctx.matches.length - 1 ? { ...m, params: { ...m.params, ...params } } : m));
    return { ...ctx, matches };
  }, [ctx, params]);
  return <UNSAFE_RouteContext.Provider value={value}>{children}</UNSAFE_RouteContext.Provider>;
}

/** Renders a legacy page with `release` (= the current release id) and any extra params. Use inside a release route. */
export function LegacyReleasePage({ extra, children }: { extra?: Record<string, string | undefined>; children: ReactNode }) {
  const { releaseId } = useCurrentRelease();
  const params = useMemo(() => ({ release: releaseId, ...extra }), [releaseId, extra]);
  if (!releaseId) return null;
  return <LegacyParams params={params}>{children}</LegacyParams>;
}

/**
 * Every legacy URL redirects here (DESIGN §2 table): `/profile`, `/releases`, `/r/:id/...`.
 * `/r/:id/evidence/:aid` needs the release list to tell a code artifact (→ …/code) from a document.
 */
export function LegacyRedirects() {
  const { pathname, search } = useLocation();
  const needsArtifacts = /^\/r\/[^/]+\/evidence\/[^/]+/.test(pathname);
  const releases = useReleases();
  if (needsArtifacts && releases.isPending) return null;
  const isCode = (aid: string) => !!releases.data?.some((r) => r.artifacts?.some((a) => a.id === aid && a.kind === "code_repo"));
  return <Navigate to={legacyToNew(pathname, search, isCode) ?? "/"} replace />;
}
