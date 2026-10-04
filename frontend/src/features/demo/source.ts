import type { ReleaseOut } from "@/api/client";
import { useDemo } from "@/lib/queries";

/** Fallback when the demo manifest is unavailable: the product's real source repo. */
const DEFAULT_REPO = "RomanGrebnev/FinTechProto";

export type SourceRef = { repo: string; ref: string; commit: string; short: string; name: string; treeUrl: string; fileUrl: (path: string) => string };

/**
 * Real-code provenance of a release (founder feedback: show it prominently): repo + commit from the demo
 * snapshot manifest, else `release.git_sha`. Null when neither knows a commit.
 */
export function useSourceRef(version: string | undefined, release?: ReleaseOut["release"] | null): SourceRef | null {
  const demo = useDemo();
  const m = demo.data?.snapshot?.releases.find((r) => r.version === version);
  const repo = m?.repo || DEFAULT_REPO;
  const commit = m?.commit || release?.git_sha || "";
  if (!commit) return null;
  const ref = m?.ref || commit;
  return {
    repo, ref, commit, short: commit.slice(0, 7), name: repo.split("/").pop() ?? repo,
    treeUrl: `https://github.com/${repo}/tree/${ref}`,
    fileUrl: (path) => `https://github.com/${repo}/blob/${commit}/${path}`,
  };
}

/** "52 code files + 5 documents". */
export function bundleCounts(artifacts: ReleaseOut["artifacts"] | undefined) {
  const a = artifacts ?? [];
  const code = a.reduce((n, x) => n + (x.files?.length ?? 0), 0);
  const docs = a.filter((x) => x.kind !== "code_repo" && !(x.files?.length)).length;
  return { code, docs };
}
