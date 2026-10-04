import { Fragment } from "react";
import { FIXTURES, type Release, type RunSummary } from "@/api/client";
import { plural, fmtSeconds } from "@/lib/format";
import { provenance, type ProvenanceOptions } from "@/lib/provenance";
import { cn } from "@/lib/utils";

/**
 * ProvenanceLine: the honest origin of a release ("CI · PR #1 · run ↗ · ref dev @ a1b2c3d · assessed 4 Oct 14:31").
 * Built only from `lib/provenance.provenance()`; links are suppressed in fixtures mode.
 */
export function ProvenanceLine({ release, run, derivedFrom, className }: {
  release: Pick<Release, "source" | "ci_run_url" | "pr_number" | "branch" | "git_sha">;
  run?: Pick<RunSummary, "status" | "ended_at" | "started_at"> | null;
  derivedFrom?: ProvenanceOptions["derivedFrom"];
  className?: string;
}) {
  const p = provenance(release, run, { fixtures: FIXTURES, derivedFrom });
  return (
    <span data-testid="provenance" title={p.text} className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-text-2", className)}>
      {p.parts.map((part, i) => (
        <Fragment key={part.key}>
          {i > 0 && <span aria-hidden className="text-text-3">·</span>}
          {part.href ? (
            <a href={part.href} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-border underline-offset-2 transition-colors duration-fast hover:text-text hover:decoration-text-3">
              {part.text}
            </a>
          ) : (
            <span className={cn(part.mono && "font-mono text-code", part.live && "inline-flex items-center gap-1.5 text-satisfied-fg")}>
              {part.live && <span aria-hidden className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-current" />}
              {part.text}
            </span>
          )}
        </Fragment>
      ))}
    </span>
  );
}

export type ValueLineData = {
  documents: number;
  codeFiles: number;
  provisions: number;
  /** Short act names in display order ("GDPR", "MiFID II", "AI Act", "CMF"). */
  acts: string[];
  /** Run duration; omitted when unknown. */
  seconds?: number | null;
};

/** "Checked 4 documents and 63 code files against 14 provisions from GDPR · MiFID II · AI Act · CMF in 46 s." */
export function valueSentence(d: ValueLineData): string {
  const what = [d.documents && plural(d.documents, "document"), d.codeFiles && plural(d.codeFiles, "code file")].filter(Boolean).join(" and ") || "the release";
  const from = d.acts.length ? ` from ${d.acts.join(" · ")}` : "";
  const time = d.seconds ? ` in ${fmtSeconds(d.seconds)}` : "";
  return `Checked ${what} against ${plural(d.provisions, "provision")}${from}${time}.`;
}

/** ValueLine: the value-up-front sentence (DESIGN comment 7), every number from the API, numbers emphasised. */
export function ValueLine({ data, className }: { data: ValueLineData; className?: string }) {
  const n = (x: number) => <span className="tnum font-medium text-text">{x}</span>;
  return (
    <p data-testid="value-line" aria-label={valueSentence(data)} className={cn("text-base text-text-2", className)}>
      Checked{" "}
      {data.documents > 0 && <>{n(data.documents)} {data.documents === 1 ? "document" : "documents"}</>}
      {data.documents > 0 && data.codeFiles > 0 && " and "}
      {data.codeFiles > 0 && <>{n(data.codeFiles)} {data.codeFiles === 1 ? "code file" : "code files"}</>}
      {!data.documents && !data.codeFiles && "the release"} against {n(data.provisions)} {data.provisions === 1 ? "provision" : "provisions"}
      {data.acts.length > 0 && <> from <span className="text-text">{data.acts.join(" · ")}</span></>}
      {data.seconds ? <> in <span className="tnum font-medium text-text">{fmtSeconds(data.seconds)}</span></> : null}.
    </p>
  );
}
