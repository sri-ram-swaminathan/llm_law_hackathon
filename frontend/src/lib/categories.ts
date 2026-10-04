import { BadgeCheck, Scale, ShieldHalf, Sparkles, UserRoundCheck, type LucideIcon } from "lucide-react";
import type { components } from "@/api/types";
import { compareFindings } from "./status";

type FindingView = components["schemas"]["FindingView"];
type Requirement = components["schemas"]["Requirement"];

/**
 * Risk categories seam (DESIGN §5, frozen by T27). A category is `requirement.domain`.
 * **No hue**: status owns colour; a category is an icon + a neutral label + an order.
 */
export type CategoryKey = "licensing" | "suitability" | "data_protection" | "ai_transparency" | "other";
export type Category = { key: CategoryKey; label: string; icon: LucideIcon; order: number };

export const CATEGORIES: Category[] = [
  { key: "licensing", label: "Licensing", icon: BadgeCheck, order: 0 },
  { key: "suitability", label: "Suitability", icon: UserRoundCheck, order: 1 },
  { key: "data_protection", label: "Data protection", icon: ShieldHalf, order: 2 },
  { key: "ai_transparency", label: "AI transparency", icon: Sparkles, order: 3 },
  { key: "other", label: "Other", icon: Scale, order: 4 },
];
const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));
/** Pack domains that are spelled differently but mean the same category. */
const ALIAS: Record<string, CategoryKey> = { privacy: "data_protection", gdpr: "data_protection", ai: "ai_transparency" };

/** Category of a requirement domain; unknown domains fall into "other". */
export function categoryOf(domain: string | null | undefined): Category {
  const d = (domain ?? "").toLowerCase();
  return BY_KEY.get((ALIAS[d] ?? d) as CategoryKey) ?? BY_KEY.get("other")!;
}

export type CategoryGroup<F> = { category: Category; findings: F[] };

/**
 * Groups findings by their requirement's category, in category order; rows sorted by status then severity.
 * Empty categories are dropped unless `keepEmpty` (Summary shows the four main ones always).
 */
export function groupByCategory<F extends Pick<FindingView, "requirement_id" | "severity" | "effective_conclusion">>(
  findings: F[],
  reqs: Map<string, Pick<Requirement, "domain">>,
  opts: { keepEmpty?: boolean } = {},
): CategoryGroup<F>[] {
  const groups = new Map<CategoryKey, F[]>();
  for (const f of findings) {
    const k = categoryOf(reqs.get(f.requirement_id)?.domain).key;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  return CATEGORIES.filter((c) => groups.has(c.key) || (opts.keepEmpty && c.key !== "other")).map((category) => ({
    category,
    findings: [...(groups.get(category.key) ?? [])].sort(compareFindings),
  }));
}

/** Free-text domain label (legacy callers). */
export const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
export const domainLabel = (d: string) => {
  const c = categoryOf(d);
  return c.key !== "other" ? c.label : d.replace(/[_-]/g, " ").replace(/^./, (x) => x.toUpperCase());
};
