import { useQuery } from "@tanstack/react-query";
import { api, type Requirement } from "@/api/client";

export const useReleases = () => useQuery({ queryKey: ["releases"], queryFn: api.releases });
export const useReadiness = (rel: string) => useQuery({ queryKey: ["readiness", rel], queryFn: () => api.readiness(rel) });
export const useFindings = (rel: string) => useQuery({ queryKey: ["findings", rel], queryFn: () => api.findings(rel) });
export const useRequirements = () => useQuery({ queryKey: ["requirements"], queryFn: api.requirements, staleTime: Infinity });

/** requirement id -> requirement. `alias` is the short id shown in the UI (W1..W8, C1, C2). */
export const reqIndex = (reqs: Requirement[] | undefined) => new Map((reqs ?? []).map((r) => [r.id, r]));
export const aliasOf = (m: Map<string, Requirement>, id: string) => m.get(id)?.alias ?? id;
export const versionLabel = (v: string) => (v.startsWith("v") ? v : `v${v}`);
export const sortReleases = <T extends { release: { created_at?: string | null } }>(l: T[]) =>
  [...l].sort((a, b) => (a.release.created_at ?? "").localeCompare(b.release.created_at ?? ""));
