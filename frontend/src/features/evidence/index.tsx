import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Code2, FileText, FileX2 } from "lucide-react";
import type { Artifact, FindingView } from "@/api/client";
import { Card, Skeleton } from "@/components/card";
import { StatusChip } from "@/components/status-chip";
import { aliasOf, reqIndex, useFindings, useRequirements, versionLabel } from "@/lib/queries";
import { findingStatus, STATUS_LABEL, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ArtifactPane, Empty, EXPECTED_KINDS, kindLabel, statusRank, useRelease } from "@/features/viewer";

export function register(): void {
  // Routes are wired by the shell; nothing to register in slots.
}

const sizeOf = (a: Artifact) =>
  a.files?.length
    ? `${a.files.length} files · ${a.files.reduce((n, f) => n + f.content.split("\n").length, 0).toLocaleString("en")} lines`
    : `${a.text.split(/\s+/).filter(Boolean).length.toLocaleString("en")} words`;

/** Distinct findings that cite an artifact, grouped by their visual status. */
function countsFor(a: Artifact, findings: FindingView[]) {
  const m = new Map<StatusKey, number>();
  for (const f of findings) {
    if ((f.evidence ?? []).some((e) => (e.type === "code" || e.type === "document_span") && e.artifact_id === a.id)) {
      const s = findingStatus(f);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
  }
  return [...m.entries()].sort((x, y) => statusRank(x[0]) - statusRank(y[0]));
}

function ArtifactRow({ a, findings, release, selected, compact }: { a: Artifact; findings: FindingView[]; release: string; selected: boolean; compact: boolean }) {
  const Icon = a.kind === "code_repo" ? Code2 : FileText;
  const counts = countsFor(a, findings);
  return (
    <Link
      to={`/r/${release}/evidence/${a.id}`} data-testid={`artifact-${a.id}`} aria-current={selected ? "page" : undefined}
      className={cn(
        "grid items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-fast hover:bg-surface-2",
        compact ? "grid-cols-[auto_1fr]" : "grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto]",
        selected && "bg-accent-soft hover:bg-accent-soft",
      )}
    >
      <Icon className="h-4 w-4 text-text-3" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-mono text-code text-text">{a.path}</span>
        <span className="block text-xs text-text-3">{kindLabel(a.kind)} · {sizeOf(a)}</span>
      </span>
      <span className={cn("flex flex-wrap gap-1.5", compact ? "col-start-2" : "col-start-2 sm:col-start-auto sm:justify-end")}>
        {counts.length === 0 ? <span className="text-xs text-text-3">No findings cite this</span>
          : counts.map(([s, n]) => <StatusChip key={s} status={s} label={`${STATUS_LABEL[s]} ${n}`} />)}
      </span>
    </Link>
  );
}

function MissingRow({ kind, needers, release, compact }: { kind: string; needers: { id: string; alias: string }[]; release: string; compact: boolean }) {
  return (
    <div data-testid={`missing-${kind}`}
      className={cn("grid items-center gap-x-4 gap-y-1 border-dashed bg-surface-2/50 px-4 py-3", compact ? "grid-cols-[auto_1fr]" : "grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto]")}>
      <FileX2 className="h-4 w-4 text-evidence-fg" aria-hidden />
      <span className="min-w-0">
        <span className="block text-text">{kindLabel(kind)}</span>
        <span className="block text-xs text-text-3">Not in this bundle</span>
      </span>
      <span className={cn("flex flex-wrap gap-1.5", compact ? "col-start-2" : "col-start-2 sm:col-start-auto sm:justify-end")}>
        <StatusChip status="evidence" label="Missing" dashed />
        {needers.map((n) => (
          <Link key={n.id} to={`/r/${release}/findings/${n.id}`} className="inline-flex h-5 items-center rounded-full border px-2 font-mono text-xs text-text-2 transition-colors duration-fast hover:bg-surface hover:text-text">
            needed by {n.alias}
          </Link>
        ))}
      </span>
    </div>
  );
}

export function EvidencePage() {
  const { release = "", artifactId } = useParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const rel = useRelease(release);
  const findings = useFindings(release);
  const reqs = useRequirements();
  const idx = reqIndex(reqs.data);
  const [path, setPath] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => navigate(`/r/${release}/findings/${id}`), [navigate, release]);

  const artifacts = rel.data?.artifacts ?? [];
  const fs = findings.data ?? [];
  const present = new Set(artifacts.map((a) => a.kind));
  const missing = useMemo(
    () =>
      EXPECTED_KINDS.filter((k) => !present.has(k)).map((k) => ({
        kind: k,
        needers: fs.filter((f) => (f.evidence ?? []).some((e) => e.type === "missing" && e.artifact_kind === k)).map((f) => ({ id: f.id, alias: aliasOf(idx, f.requirement_id) })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artifacts.length, fs, reqs.data],
  );
  const selected = artifacts.find((a) => a.id === artifactId);
  const loading = rel.isLoading || findings.isLoading;
  const compact = !!artifactId;

  const list = loading ? <Skeleton className="h-64" /> : (
    <Card className="overflow-hidden">
      <div className="divide-y" data-testid="evidence-list">
        {artifacts.map((a, i) => (
          <motion.div key={a.id} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}>
            <ArtifactRow a={a} findings={fs} release={release} selected={a.id === artifactId} compact={compact} />
          </motion.div>
        ))}
        {missing.map((m) => <MissingRow key={m.kind} kind={m.kind} needers={m.needers} release={release} compact={compact} />)}
        {artifacts.length === 0 && <div className="px-4 py-10 text-center text-text-2">This release has no artifacts yet.</div>}
      </div>
    </Card>
  );

  if (!artifactId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6" data-testid="evidence-room">
        <div className="mb-5">
          <h1 className="text-xl">Evidence room</h1>
          <p className="text-text-2">
            Everything the assessment of {rel.data ? versionLabel(rel.data.release.version) : "this release"} was based on. Open an artifact to see exactly which passages and lines each finding cites.
          </p>
        </div>
        {list}
        {!loading && missing.length > 0 && (
          <p className="mt-3 text-xs text-text-3">Missing artifacts are shown dashed. Findings that depend on them are marked &ldquo;needs evidence&rdquo;.</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-3 lg:h-[calc(100dvh-3rem)] lg:grid-cols-[24rem_minmax(0,1fr)]" data-testid="evidence-room">
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <Link to={`/r/${release}/evidence`} className="inline-flex w-fit items-center gap-1.5 text-sm text-text-2 transition-colors duration-fast hover:text-text">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Evidence room
        </Link>
        {list}
      </aside>
      <section aria-label="Artifact" className="flex h-[70vh] min-h-0 flex-col overflow-hidden rounded-md border bg-surface lg:h-auto" data-testid="artifact-pane">
        {loading ? <Skeleton className="h-full" /> : selected
          ? <ArtifactPane artifact={selected} findings={fs} filePath={path} onFilePath={setPath} onSelectFinding={onSelect} />
          : <Empty text="This artifact is not part of the release bundle." />}
      </section>
    </div>
  );
}
