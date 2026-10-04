import { FilePlus2, FileText, FileX2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FindingView } from "@/api/client";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { EmptyState, ErrorBanner } from "@/components/feedback";
import { Sheet } from "@/components/sheet";
import { StatusDot } from "@/components/status-chip";
import { AddDocumentSheet, slotForKind } from "@/features/add-document";
import { docHighlights, MarkdownView, moreSevere, NoteCard, NotesRail, pulse, shortAct, useRelease, type Note } from "@/features/viewer";
import { aliasOf, reqIndex, useCurrentRelease, useFindings, useProvisions, useRequirements } from "@/lib/queries";
import { paths, useReleaseParams } from "@/lib/routes";
import type { StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { DOC_KIND_TITLE, docTitle, documentArtifacts, missingDocuments, resolveFinding } from "./model";

const anchorOf = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`mark[data-finding-id="${CSS.escape(id)}"]`);

/** Documents `…/documents[/:artifactId]` (DESIGN §4.7): every compliance document with all findings inline and aligned margin notes. */
export default function DocumentsPage() {
  const { productId, version, releaseId, release } = useCurrentRelease();
  const { artifactId } = useReleaseParams();
  const [sp, setSp] = useSearchParams();
  const full = useRelease(releaseId ?? "");
  const findingsQ = useFindings(releaseId);
  const reqs = useRequirements();
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const findings = useMemo(() => findingsQ.data ?? [], [findingsQ.data]);
  const artifacts = full.data?.artifacts ?? release?.artifacts ?? [];
  const docs = useMemo(() => documentArtifacts(artifacts), [artifacts]);
  const missing = useMemo(() => missingDocuments(artifacts, findings, idx), [artifacts, findings, idx]);

  const focus = resolveFinding(sp.get("f"), findings, idx);
  const citesDoc = (f: FindingView | undefined, aid: string) => !!f && (f.evidence ?? []).some((e) => e.type === "document_span" && e.artifact_id === aid);
  const selected = docs.find((d) => d.id === artifactId) ?? (focus && docs.find((d) => citesDoc(focus, d.id))) ?? docs[0];

  const [active, setActive] = useState<string | undefined>(focus?.id);
  const [sheetNote, setSheetNote] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState<{ slot?: string } | null>(null);
  useEffect(() => { setActive(focus?.id); }, [focus?.id, selected?.id]);

  const highlights = useMemo(() => (selected ? docHighlights(findings, selected.id) : []), [findings, selected]);
  const cited = useMemo(() => {
    const ids = new Set(highlights.map((h) => h.findingId));
    return findings.filter((f) => ids.has(f.id));
  }, [findings, highlights]);
  const provIds = useMemo(() => [...new Set(cited.flatMap((f) => f.citations ?? []))], [cited]);
  const provs = useProvisions(provIds);
  const lawOf = useMemo(() => {
    const m = new Map<string, string>();
    provIds.forEach((id, i) => { const p = provs[i]?.data; if (p) m.set(id, p.kind === "guidance" ? p.issuer ?? shortAct(p.act_title) : shortAct(p.act_title)); });
    return m;
  }, [provIds, provs]);
  const notes = useMemo<Note[]>(() => cited.map((f) => ({
    finding: f, alias: aliasOf(idx, f.requirement_id), domain: idx.get(f.requirement_id)?.domain,
    laws: [...new Set((f.citations ?? []).map((c) => lawOf.get(c)).filter(Boolean) as string[])],
    spans: highlights.filter((h) => h.findingId === f.id).length,
  })), [cited, idx, lawOf, highlights]);

  const content = useRef<HTMLDivElement>(null);
  const wide = useMedia("(min-width: 1280px)");

  // ?f= focuses on load: scroll the first highlight into view and pulse it.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || !selected || scrolledFor.current === `${focus.id}:${selected.id}`) return;
    const t = window.setTimeout(() => {
      const el = content.current && anchorOf(content.current, focus.id);
      if (!el) return;
      scrolledFor.current = `${focus.id}:${selected.id}`;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      pulse(el);
    }, 150);
    return () => window.clearTimeout(t);
  }, [focus, selected, highlights.length]);

  const setF = (id: string) => setSp((p) => { const n = new URLSearchParams(p); n.set("f", aliasOf(idx, findings.find((f) => f.id === id)?.requirement_id ?? id)); return n; }, { replace: true });
  const onMark = useCallback((id: string) => {
    setActive(id);
    if (!wide) { setSheetNote(id); return; }
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-testid="note-${CSS.escape(id)}"]`);
      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      pulse(card);
    });
  }, [wide]);
  const onNote = useCallback((id: string) => {
    setActive(id);
    const el = content.current && anchorOf(content.current, id);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    pulse(el);
  }, []);

  if (full.isError) return <div className="mx-auto max-w-3xl px-4 py-8"><ErrorBanner error={full.error} onRetry={() => full.refetch()} /></div>;
  const loading = !releaseId || (full.isPending && !release) || findingsQ.isPending;

  const counts = (aid: string) => {
    const hs = docHighlights(findings, aid);
    const worst = hs.reduce<StatusKey | null>((w, h) => (w ? moreSevere(w, h.status) : h.status), null);
    return { n: new Set(hs.map((h) => h.findingId)).size, worst };
  };

  return (
    <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]" data-testid="documents-page">
      <aside className="lg:sticky lg:top-16 lg:self-start" aria-label="Documents">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-3">Documents</div>
        {loading ? <Skeleton className="h-40" /> : (
          <nav className="grid gap-0.5" data-testid="doc-list">
            {docs.map((d) => {
              const c = counts(d.id);
              return (
                <Link key={d.id} to={paths.documents(productId, version, d.id)} data-testid={`doc-item-${d.id}`} aria-current={d.id === selected?.id ? "page" : undefined}
                  className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-fast hover:bg-surface-2",
                    d.id === selected?.id ? "bg-surface-2 font-medium text-text" : "text-text-2")}>
                  {c.worst ? <StatusDot status={c.worst} /> : <span className="h-2 w-2 rounded-full border" />}
                  <span className="min-w-0 flex-1 truncate">{docTitle(d)}</span>
                  {c.n > 0 && <span className="tnum text-xs text-text-3">{c.n}</span>}
                </Link>
              );
            })}
            {missing.length > 0 && <div className="mb-1 mt-4 text-xs font-medium uppercase tracking-[0.06em] text-text-3">Missing</div>}
            {missing.map((m) => (
              <div key={m.kind} data-testid={`missing-${m.kind}`} className="group flex items-start gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm">
                <FileX2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-evidence-fg" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-text">{DOC_KIND_TITLE[m.kind] ?? m.kind}</span>
                  {m.citedBy.length > 0 && (
                    <span className="block text-xs text-text-3">cited by {m.citedBy.map((c, i) => (
                      <span key={c.id}>{i > 0 && ", "}<Link to={paths.risks(productId, version, c.id)} className="font-mono hover:text-text hover:underline">{c.alias}</Link></span>
                    ))}</span>
                  )}
                </span>
                <button type="button" onClick={() => setAddOpen({ slot: slotForKind(m.kind) })} data-testid={`add-${m.kind}`}
                  className="shrink-0 rounded-sm px-1.5 text-xs font-medium text-accent hover:bg-accent-soft">Add</button>
              </div>
            ))}
            <Button className="mt-4 justify-start" onClick={() => setAddOpen({})} data-testid="add-document">
              <FilePlus2 className="h-4 w-4" /> Add or replace a document
            </Button>
          </nav>
        )}
      </aside>

      <main className="min-w-0">
        {loading ? <Skeleton className="h-[60vh]" /> : !selected ? (
          <EmptyState icon={FileText} title="This release has no documents" action={<Button variant="primary" onClick={() => setAddOpen({ slot: "business_plan" })}>Add the business plan</Button>}>
            Add the business plan to start.
          </EmptyState>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <article className="min-w-0 rounded-md border bg-surface" data-testid="document-body" data-artifact-id={selected.id}>
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-3">
                <FileText className="h-4 w-4 text-text-3" aria-hidden />
                <h2 className="text-base font-medium text-text">{docTitle(selected)}</h2>
                <span className="font-mono text-code text-text-3">{selected.path}</span>
                <span className="ml-auto text-xs text-text-2" data-testid="doc-summary">
                  {notes.length ? `${notes.length} ${notes.length === 1 ? "finding" : "findings"} · ${highlights.length} highlighted passages` : "No findings cite this document"}
                </span>
              </header>
              <div ref={content}>
                <MarkdownView text={selected.text} highlights={highlights} activeFindingId={active} onSelectFinding={onMark} className="max-w-none px-6 lg:px-10" />
              </div>
            </article>
            {wide && (
              <aside aria-label="Margin notes" className="relative pt-[52px]">
                <NotesRail notes={notes} contentRef={content} anchorOf={anchorOf} activeId={active}
                  onActivate={(id) => { onNote(id); setF(id); }} productId={productId} version={version} releaseId={releaseId!} layoutKey={`${selected.id}:${highlights.length}`} />
              </aside>
            )}
          </div>
        )}
      </main>

      {!wide && (
        <Sheet open={!!sheetNote} onOpenChange={(o) => !o && setSheetNote(null)} side="bottom" title="Finding">
          {sheetNote && notes.find((n) => n.finding.id === sheetNote) && (
            <NoteCard note={notes.find((n) => n.finding.id === sheetNote)!} active onActivate={() => undefined} productId={productId} version={version} releaseId={releaseId!} />
          )}
        </Sheet>
      )}
      {release && addOpen && (
        <AddDocumentSheet open onOpenChange={(o) => !o && setAddOpen(null)} base={full.data ?? release} productId={productId} presetSlot={addOpen.slot} />
      )}
    </div>
  );
}

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return !!m;
}
