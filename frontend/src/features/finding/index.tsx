import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, FileX2 } from "lucide-react";
import type { FindingView, Requirement } from "@/api/client";
import { Button } from "@/components/button";
import { Mono, Skeleton } from "@/components/card";
import { StatusChip } from "@/components/status-chip";
import { aliasOf, reqIndex, useFindings, useRequirements } from "@/lib/queries";
import { findingStatus } from "@/lib/status";
import { LegalDrawer } from "@/features/legal";
import { ArtifactPane, Empty, kindLabel, useRelease, type ArtifactFocus } from "@/features/viewer";
import { EvidenceList, type EvidenceItem } from "./EvidenceList";
import { FindingPanel } from "./FindingPanel";

export function register(): void {
  // The workspace renders <Slot name="finding.tab.produced"/> and <Slot name="finding.panel.review"/>; T09 registers into them.
}

const pane = "flex min-h-0 flex-col overflow-hidden rounded-md border bg-surface";

function MissingState({ kind, release }: { kind: string; release: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center" data-testid="missing-state">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-evidence-bd bg-evidence-bg text-evidence-fg"><FileX2 className="h-5 w-5" aria-hidden /></span>
      <h2 className="text-lg">{kindLabel(kind)} not provided</h2>
      <p className="max-w-sm text-text-2">
        The assessment looked for a {kindLabel(kind).toLowerCase()} in this release&rsquo;s bundle and found none, so this requirement cannot be confirmed. Add the document and re-assess.
      </p>
      <Button asChild variant="secondary"><Link to={`/r/${release}/evidence`}>View evidence room</Link></Button>
    </div>
  );
}

function Workspace({ f, req, release, alias, artifacts, findings }: {
  f: FindingView; req?: Requirement; release: string; alias: string; artifacts: import("@/api/client").Artifact[]; findings: FindingView[];
}) {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "finding";
  const setTab = (t: string) => setSp(t === "finding" ? {} : { tab: t }, { replace: true });
  const [legal, setLegal] = useState(false);

  const items = (f.evidence ?? []) as EvidenceItem[];
  const [sel, setSel] = useState(0);
  const [token, setToken] = useState(0);
  const [filePath, setFilePath] = useState<string | null>(() => { const e = items[0]; return e?.type === "code" ? e.path : null; });
  const item = items[sel];

  const choose = useCallback((i: number) => {
    setSel(i); setToken((t) => t + 1);
    const e = items[i];
    if (e?.type === "code") setFilePath(e.path);
  }, [items]);

  const artifact = item && item.type !== "missing" ? artifacts.find((a) => a.id === item.artifact_id) : undefined;
  const focus = useMemo<ArtifactFocus>(() => {
    if (!item || item.type === "missing") return null;
    return item.type === "code"
      ? { findingId: f.id, line: item.start_line, endLine: item.end_line, token }
      : { findingId: f.id, start: item.start ?? undefined, token };
  }, [item, f.id, token]);
  const onSelectFinding = useCallback((id: string) => id !== f.id && navigate(`/r/${release}/findings/${id}`), [navigate, release, f.id]);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3rem)]" data-testid="finding-workspace">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-surface px-4 py-2.5 sm:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Back to findings"><Link to={`/r/${release}/findings`}><ArrowLeft className="h-4 w-4" /></Link></Button>
        <Mono className="rounded-sm bg-surface-2 px-1.5 text-text-2" data-testid="finding-alias">{alias}</Mono>
        <h1 className="min-w-0 flex-1 basis-64 truncate text-lg">{f.title}</h1>
        <StatusChip status={findingStatus(f)} />
      </div>
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[17rem_minmax(0,1fr)_25rem]">
        <section aria-label="Evidence" className={`${pane} max-h-64 lg:max-h-none`}>
          <div className="flex min-h-11 shrink-0 items-center justify-between border-b px-4 py-2">
            <h2 className="text-xs uppercase tracking-[0.04em] text-text-2">Evidence</h2>
            <span className="tnum text-xs text-text-3">{items.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto"><EvidenceList items={items} artifacts={artifacts} selected={sel} onSelect={choose} /></div>
        </section>
        <section aria-label="Artifact" className={`${pane} h-[60vh] lg:h-auto`} data-testid="artifact-pane">
          {item?.type === "missing" ? <MissingState kind={item.artifact_kind} release={release} />
            : artifact ? <ArtifactPane artifact={artifact} findings={findings} activeFindingId={f.id} focus={focus} filePath={filePath} onFilePath={setFilePath} onSelectFinding={onSelectFinding} />
            : <Empty text={items.length ? "The cited artifact is not in this release bundle." : "Nothing to show: no evidence is cited for this finding."} />}
        </section>
        <section aria-label="Finding" className={`${pane} min-h-[28rem] lg:min-h-0`}>
          <FindingPanel f={f} req={req} release={release} tab={tab} onTab={setTab} onOpenLegal={() => setLegal(true)} />
        </section>
      </div>
      <LegalDrawer open={legal} provisionIds={f.citations ?? []} onClose={() => setLegal(false)} interpretation={f.reasoning_summary} />
    </div>
  );
}

export function FindingPage() {
  const { release = "", findingId = "" } = useParams();
  const findings = useFindings(release);
  const rel = useRelease(release);
  const reqs = useRequirements();
  const idx = reqIndex(reqs.data);

  if (findings.isLoading || rel.isLoading) {
    return (
      <div className="grid gap-3 p-3 lg:grid-cols-[17rem_minmax(0,1fr)_25rem]" aria-busy="true">
        <Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" />
      </div>
    );
  }
  const f = findings.data?.find((x) => x.id === findingId);
  if (!f) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center" data-testid="finding-not-found">
        <h1 className="text-xl">Finding not found</h1>
        <p className="mt-1 text-text-2">This finding does not exist in release {release}.</p>
        <Button asChild className="mt-4"><Link to={`/r/${release}/findings`}>Back to findings</Link></Button>
      </div>
    );
  }
  return (
    <Workspace key={f.id} f={f} req={idx.get(f.requirement_id)} release={release} alias={aliasOf(idx, f.requirement_id)}
      artifacts={rel.data?.artifacts ?? []} findings={findings.data ?? []} />
  );
}
