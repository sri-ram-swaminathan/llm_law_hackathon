import { useQueries, useQuery } from "@tanstack/react-query";
import { FIXTURES, api, http, type LegalProvision } from "@/api/client";
import provisionFixture from "@fixtures/provisions.json";

/** Release with its artifacts (bundle). */
export const useRelease = (id: string) => useQuery({ queryKey: ["release", id], queryFn: () => api.release(id), enabled: !!id });

const fxProvisions = (provisionFixture as unknown as { provisions: LegalProvision[] }).provisions;

async function fetchProvision(id: string): Promise<LegalProvision | null> {
  if (FIXTURES) return fxProvisions.find((p) => p.id === id) ?? null;
  try { return await http<LegalProvision>(`/api/provisions/${encodeURIComponent(id)}`); } catch { return null; }
}

async function fetchRelated(id: string): Promise<LegalProvision[]> {
  if (FIXTURES) {
    const me = fxProvisions.find((p) => p.id === id);
    return me ? fxProvisions.filter((p) => p.id !== id && p.act_title === me.act_title).slice(0, 4) : [];
  }
  try { return await http<LegalProvision[]>(`/api/provisions/${encodeURIComponent(id)}/related`); } catch { return []; }
}

export const useProvisions = (ids: string[]) =>
  useQueries({
    queries: ids.map((id) => ({ queryKey: ["provision", id], queryFn: () => fetchProvision(id), staleTime: Infinity })),
  });

export const useRelatedProvisions = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: ["provision-related", id], queryFn: () => fetchRelated(id!), enabled: !!id && enabled, staleTime: Infinity });

/** "Directive 2014/65/EU (MiFID II) · Art. 4(1(4))"-style label; guidance keeps its own article wording. */
export const provisionLabel = (p: Pick<LegalProvision, "act_title" | "article" | "paragraph" | "kind">) =>
  p.kind === "guidance"
    ? p.article
    : `${shortAct(p.act_title)} · Art. ${p.article}${p.paragraph ? ` (${p.paragraph})` : ""}`;

/** Prefer the parenthesised short name, e.g. "Directive 2014/65/EU (MiFID II)" -> "MiFID II". */
export const shortAct = (t: string) => t.match(/\(([^)]+)\)\s*$/)?.[1] ?? t;
