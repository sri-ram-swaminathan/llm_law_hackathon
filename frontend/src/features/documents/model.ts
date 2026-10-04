import type { Artifact, FindingView } from "@/api/client";
import { aliasOf } from "@/lib/queries";
import type { Requirement } from "@/api/client";

/** Document order in the list (DESIGN §4.7). */
const ORDER = ["business_plan", "terms", "privacy_policy", "regulatory_registration", "product_spec", "other"];
/** Compliance documents a launch-ready bundle is expected to carry (the code repo lives on the Code tab). */
export const EXPECTED_DOCS = ["business_plan", "terms", "privacy_policy", "regulatory_registration"] as const;

export const DOC_KIND_TITLE: Record<string, string> = {
  business_plan: "Business plan", terms: "Terms of service", privacy_policy: "Privacy policy",
  regulatory_registration: "CIF registration", product_spec: "Product spec", other: "Document",
};

const humanize = (path: string) => {
  const base = path.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? path;
  const s = base.replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "Business plan" for the canonical kinds; the file name for product docs ("Product guide"). */
export const docTitle = (a: Pick<Artifact, "kind" | "path">) =>
  a.kind === "product_spec" || a.kind === "other" ? humanize(a.path) : DOC_KIND_TITLE[a.kind] ?? humanize(a.path);

export const documentArtifacts = (artifacts: Artifact[]) =>
  artifacts
    .filter((a) => a.kind !== "code_repo" && !(a.files?.length))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.path.localeCompare(b.path));

/** Missing documents: expected kinds not present ∪ kinds cited by `missing` evidence, each with the aliases that cite it. */
export function missingDocuments(artifacts: Artifact[], findings: FindingView[], idx: Map<string, Requirement>) {
  const present = new Set(artifacts.map((a) => a.kind));
  const kinds = new Set<string>(EXPECTED_DOCS.filter((k) => !present.has(k)));
  for (const f of findings) for (const e of f.evidence ?? []) if (e.type === "missing" && !present.has(e.artifact_kind)) kinds.add(e.artifact_kind);
  return [...kinds]
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map((kind) => ({
      kind,
      citedBy: findings
        .filter((f) => (f.evidence ?? []).some((e) => e.type === "missing" && e.artifact_kind === kind))
        .map((f) => ({ id: f.id, alias: aliasOf(idx, f.requirement_id) })),
    }));
}

/** Resolve `?f=` given as a finding id or as an alias ("W1"). */
export function resolveFinding(f: string | null, findings: FindingView[], idx: Map<string, Requirement>) {
  if (!f) return undefined;
  return findings.find((x) => x.id === f) ?? findings.find((x) => aliasOf(idx, x.requirement_id).toLowerCase() === f.toLowerCase());
}
