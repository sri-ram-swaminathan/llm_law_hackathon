import { ChevronRight, Code2, ExternalLink, FileCode2 } from "lucide-react";
import { useSourceRef } from "@/features/demo/source";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Skeleton } from "@/components/card";
import { EmptyState } from "@/components/feedback";
import { StatusDot } from "@/components/status-chip";
import { CodeView, lineHighlights, moreSevere, NotesRail, pulse, shortAct, useRelease, type Note } from "@/features/viewer";
import { aliasOf, reqIndex, useCurrentRelease, useFindings, useProvisions, useRequirements } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { findingStatus, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Code `…/code` (DESIGN §4.8): files with findings first, line bands and the same margin notes as Documents. */
export default function CodePage() {
  const { productId, version, releaseId, release } = useCurrentRelease();
  const [sp] = useSearchParams();
  const full = useRelease(releaseId ?? "");
  const findingsQ = useFindings(releaseId);
  const reqs = useRequirements();
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const findings = useMemo(() => findingsQ.data ?? [], [findingsQ.data]);
  const repo = (full.data?.artifacts ?? release?.artifacts ?? []).find((a) => a.kind === "code_repo" || (a.files?.length ?? 0) > 0);
  const files = useMemo(() => repo?.files ?? [], [repo]);
  const src = useSourceRef(version, release?.release);

  const byFile = useMemo(() => {
    const m = new Map<string, { ids: Set<string>; worst: StatusKey | null }>();
    for (const f of findings) for (const e of f.evidence ?? []) {
      if (e.type !== "code" || e.artifact_id !== repo?.id) continue;
      const cur = m.get(e.path) ?? { ids: new Set<string>(), worst: null };
      cur.ids.add(f.id);
      cur.worst = cur.worst ? moreSevere(cur.worst, findingStatus(f)) : findingStatus(f);
      m.set(e.path, cur);
    }
    return m;
  }, [findings, repo?.id]);
  const withFindings = files.filter((f) => byFile.has(f.path)).sort((a, b) => a.path.localeCompare(b.path));
  const fParam = sp.get("f");
  const focusF = findings.find((x) => x.id === fParam || aliasOf(idx, x.requirement_id) === fParam);
  const ce = focusF?.evidence?.find((e) => e.type === "code");
  const focusPath = ce && ce.type === "code" ? ce.path : undefined;
  const path = sp.get("path") ?? focusPath ?? withFindings[0]?.path ?? files[0]?.path;
  const file = files.find((f) => f.path === path);
  const [allOpen, setAllOpen] = useState(withFindings.length === 0);
  const [active, setActive] = useState<string | undefined>(focusF?.id);
  useEffect(() => setActive(focusF?.id), [focusF?.id, path]);

  const highlights = useMemo(() => (file && repo ? lineHighlights(findings, repo.id, file.path) : []), [findings, repo, file]);
  const cited = useMemo(() => findings.filter((f) => highlights.some((h) => h.findingId === f.id)), [findings, highlights]);
  const provIds = useMemo(() => [...new Set(cited.flatMap((f) => f.citations ?? []))], [cited]);
  const provs = useProvisions(provIds);
  const notes = useMemo<Note[]>(() => cited.map((f) => ({
    finding: f, alias: aliasOf(idx, f.requirement_id), domain: idx.get(f.requirement_id)?.domain,
    laws: [...new Set((f.citations ?? []).map((c) => { const p = provs[provIds.indexOf(c)]?.data; return p ? shortAct(p.act_title) : null; }).filter(Boolean) as string[])],
    spans: highlights.filter((h) => h.findingId === f.id).length,
  })), [cited, idx, provs, provIds, highlights]);

  const content = useRef<HTMLDivElement>(null);
  const anchorOf = useCallback((root: HTMLElement, id: string) => {
    const h = highlights.find((x) => x.findingId === id);
    return h ? root.querySelector<HTMLElement>(`[data-line="${h.startLine}"]`) : null;
  }, [highlights]);
  const onSelect = useCallback((id: string) => {
    setActive(id);
    const card = document.querySelector(`[data-testid="note-${CSS.escape(id)}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    pulse(card);
  }, []);
  const onNote = useCallback((id: string) => {
    setActive(id);
    const el = content.current && anchorOf(content.current, id);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    pulse(el);
  }, [anchorOf]);
  useEffect(() => {
    if (!focusF || !content.current) return;
    const t = window.setTimeout(() => { const el = content.current && anchorOf(content.current, focusF.id); el?.scrollIntoView({ block: "center" }); pulse(el); }, 200);
    return () => window.clearTimeout(t);
  }, [focusF, anchorOf]);

  const loading = !releaseId || (full.isPending && !release) || findingsQ.isPending;
  if (loading) return <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6"><Skeleton className="h-[60vh]" /></div>;
  if (!repo || files.length === 0) {
    return <div className="mx-auto max-w-3xl px-4 py-10" data-testid="code-page"><EmptyState icon={Code2} title="No code in this release">This release bundle carries documents only.</EmptyState></div>;
  }

  const FileLink = ({ p }: { p: string }) => {
    const info = byFile.get(p);
    return (
      <Link to={paths.code(productId, version, { path: p })} data-testid="code-file" data-path={p} aria-current={p === path ? "page" : undefined}
        className={cn("flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[12px] transition-colors duration-fast hover:bg-surface-2",
          p === path ? "bg-surface-2 text-text" : "text-text-2")}>
        {info?.worst ? <StatusDot status={info.worst} /> : <FileCode2 className="h-3 w-3 shrink-0 text-text-3" />}
        <span className="min-w-0 flex-1 truncate" title={p}>{p}</span>
        {info && <span className="tnum text-text-3">{info.ids.size}</span>}
      </Link>
    );
  };

  return (
    <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)]" data-testid="code-page">
      <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:self-start lg:overflow-y-auto" aria-label="Files">
        <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-text-3" data-testid="files-with-findings">Files with findings ({withFindings.length})</div>
        {withFindings.length === 0 ? (
          <p className="mb-2 rounded-md border border-dashed px-2.5 py-2 text-xs text-text-2" data-testid="code-empty-cited">
            No code lines are cited in this release's findings. The agent could read these {files.length} files.
          </p>
        ) : <div className="grid gap-0.5">{withFindings.map((f) => <FileLink key={f.path} p={f.path} />)}</div>}
        <button type="button" onClick={() => setAllOpen((o) => !o)} aria-expanded={allOpen}
          className="mt-4 flex w-full items-center gap-1 text-xs font-medium uppercase tracking-[0.06em] text-text-3 hover:text-text">
          <ChevronRight className={cn("h-3 w-3 transition-transform duration-fast", allOpen && "rotate-90")} /> All files read by the agent ({files.length})
        </button>
        {src && (
          <a href={src.treeUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1 text-xs text-text-3 hover:text-text">
            Source: <span className="font-mono">{src.repo}@{src.short}</span> <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {allOpen && <div className="mt-1 grid gap-0.5">{files.map((f) => <FileLink key={f.path} p={f.path} />)}</div>}
      </aside>

      <main className="min-w-0">
        {file ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <article className="min-w-0 overflow-hidden rounded-md border bg-surface">
              <header className="flex items-center gap-2 border-b px-4 py-2.5">
                <FileCode2 className="h-4 w-4 text-text-3" aria-hidden />
                <span className="font-mono text-code text-text">{file.path}</span>
                {src && (
                  <a href={src.fileUrl(file.path)} target="_blank" rel="noreferrer" data-testid="code-github"
                    className="inline-flex items-center gap-1 text-xs text-text-2 hover:text-text hover:underline">
                    {src.name}@<span className="font-mono">{src.short}</span> <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="ml-auto text-xs text-text-2">{notes.length ? `${notes.length} ${notes.length === 1 ? "finding" : "findings"}` : "No findings cite this file"}</span>
              </header>
              <div ref={content}>
                <CodeView path={file.path} content={file.content} highlights={highlights} activeFindingId={active} onSelectFinding={onSelect} className="h-auto overflow-x-auto overflow-y-hidden" />
              </div>
            </article>
            <aside aria-label="Margin notes" className="relative hidden pt-[46px] xl:block">
              <NotesRail notes={notes} contentRef={content} anchorOf={anchorOf} activeId={active} onActivate={onNote}
                productId={productId} version={version} releaseId={releaseId!} layoutKey={file.path} />
            </aside>
          </div>
        ) : <EmptyState icon={Code2} title="Pick a file">Choose a file on the left.</EmptyState>}
      </main>
    </div>
  );
}
