import type { Release, RunSummary } from "@/api/client";
import { fmtDateTime } from "./format";

/**
 * Provenance seam (DESIGN §4.2, frozen by T27). One pure function decides how a release's origin reads.
 * Only real provenance is shown: a CI link only when the release carries a `ci_run_url`; the sha is 7
 * characters and never a link; fixtures mode suppresses every link.
 *
 *   source=ci + ci_run_url  → "CI · PR #n · run ↗"
 *   source=ci               → "Recorded audit (CLI)"
 *   source=ui               → "Upload" (· "derived from v0.9.0" when `derivedFrom` is passed)
 *   source=seed             → "Recorded run" (snapshot of a real run, or fixtures)
 *   then "ref <branch> @ <sha7>", then the run ("assessed 4 Oct 15:20" | "Live run")
 */
export type ProvenancePart = {
  key: "source" | "pr" | "ci-run" | "derived" | "ref" | "run";
  text: string;
  /** Present only for a real, external link (never in fixtures mode). */
  href?: string;
  /** Render in mono (refs and shas). */
  mono?: boolean;
  /** The run is in flight: render the pulsing dot. */
  live?: boolean;
};
export type Provenance = {
  sourceLabel: string;
  parts: ProvenancePart[];
  /** The parts joined with " · " (for titles, tests and plain-text contexts). */
  text: string;
  sha7: string | null;
  ref: string | null;
};
export type ProvenanceOptions = {
  /** Suppress every link (fixtures mode). */
  fixtures?: boolean;
  /** Version the release was derived from (Add/replace document flow). */
  derivedFrom?: string | null;
};

export const sha7 = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : null);

export function provenance(
  release: Pick<Release, "source" | "ci_run_url" | "pr_number" | "branch" | "git_sha">,
  run?: Pick<RunSummary, "status" | "ended_at" | "started_at"> | null,
  opts: ProvenanceOptions = {},
): Provenance {
  const parts: ProvenancePart[] = [];
  const link = (u: string | null | undefined) => (!opts.fixtures && u && /^https:\/\//.test(u) ? u : undefined);

  let sourceLabel: string;
  if (release.source === "ci") {
    const href = link(release.ci_run_url);
    if (href) {
      sourceLabel = "CI";
      parts.push({ key: "source", text: "CI" });
      if (release.pr_number) parts.push({ key: "pr", text: `PR #${release.pr_number}` });
      parts.push({ key: "ci-run", text: "run ↗", href });
    } else {
      sourceLabel = "Recorded audit (CLI)";
      parts.push({ key: "source", text: sourceLabel });
    }
  } else if (release.source === "ui") {
    sourceLabel = "Upload";
    parts.push({ key: "source", text: sourceLabel });
    if (opts.derivedFrom) parts.push({ key: "derived", text: `derived from v${opts.derivedFrom.replace(/^v/, "")}` });
  } else {
    sourceLabel = "Recorded run";
    parts.push({ key: "source", text: sourceLabel });
  }

  const s = sha7(release.git_sha);
  const ref = release.branch ?? null;
  if (ref || s) parts.push({ key: "ref", text: [ref && `ref ${ref}`, s && `@ ${s}`].filter(Boolean).join(" "), mono: true });

  if (run) {
    if (run.status === "running") parts.push({ key: "run", text: "Live run", live: true });
    else if (run.status === "failed") parts.push({ key: "run", text: "Last run failed" });
    else {
      const at = fmtDateTime(run.ended_at ?? run.started_at);
      if (at) parts.push({ key: "run", text: `assessed ${at}` });
    }
  }

  return { sourceLabel, parts, text: parts.map((p) => p.text).join(" · "), sha7: s, ref };
}
