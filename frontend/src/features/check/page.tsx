import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, CircleSlash, Code2, ExternalLink, FileText, Wrench } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { API_URL, api, FIXTURES, getToken, type AgentEvent, type Artifact, type FindingDetail, type FindingView, type LegalProvision, type ReleaseOut } from "@/api/client";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { ErrorBanner, NotFound } from "@/components/feedback";
import { StatusChip, toneVar } from "@/components/status-chip";
import { CategoryLabel, Kbd, LawBadge, SeverityTag } from "@/components/tags";
import { Alias, AiLabel } from "@/features/summary/parts";
import { shortAct } from "@/features/summary/model";
import { fmtDate, fmtDateTime, versionLabel } from "@/lib/format";
import { useCurrentRelease, useFinding, useFindings, useRelease, reqIndex, useRequirements } from "@/lib/queries";
import { paths, useReleaseParams } from "@/lib/routes";
import { Slot } from "@/lib/slots";
import { compareFindings, DECISION_WORD, findingStatus, statusWord, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";
import { articleLabel, artifactLabel, carriedLabel, clause, confidenceWord, missingLabel, sourceLabel } from "./model";

type Ev = NonNullable<FindingView["evidence"]>[number];

/** Compliance check `…/risks/:findingId` (DESIGN §4.6): your company's text ↔ the verdict ↔ the law. */
export default function CheckPage() {
  const { productId, version, releaseId, release } = useCurrentRelease();
  const { findingId } = useReleaseParams();
  const detail = useFinding(findingId);
  const full = useRelease(releaseId);
  const belongs = detail.data && release?.latest_assessment && detail.data.finding.assessment_id === release.latest_assessment.id;

  if (!release || !releaseId) return null;
  if (detail.isError || (detail.data && !belongs)) {
    const nf = detail.isError && (detail.error as { status?: number })?.status !== 404 && !(detail.data && !belongs);
    if (nf) return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><ErrorBanner error={detail.error} onRetry={() => detail.refetch()} /></div>;
    return (
      <NotFound title={`This risk isn't part of ${versionLabel(version)}`} backTo={paths.risks(productId, version)} backLabel="All risks">
        It may belong to another release, or the link is out of date.
      </NotFound>
    );
  }
  if (!detail.data) return <CheckSkeleton />;
  return <Check d={detail.data} release={full.data ?? release} productId={productId} version={version} releaseId={releaseId} />;
}

function CheckSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6" data-testid="check-skeleton">
      <Skeleton className="h-8 w-2/3" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

function Check({ d, release, productId, version, releaseId }: { d: FindingDetail; release: ReleaseOut; productId: string; version: string; releaseId: string }) {
  const f = d.finding;
  const req = d.requirement;
  const evidence = f.evidence ?? [];
  const provisions = d.provisions ?? [];
  const tone = findingStatus(f);
  const nav = useNavigate();
  const all = useFindings(releaseId);
  const reqs = useRequirements();
  const idx = useMemo(() => reqIndex(reqs.data), [reqs.data]);
  const ordered = useMemo(() => [...(all.data ?? [])].sort(compareFindings), [all.data]);
  const pos = ordered.findIndex((x) => x.id === f.id);
  const prev = pos > 0 ? ordered[pos - 1] : undefined;
  const next = pos >= 0 && pos < ordered.length - 1 ? ordered[pos + 1] : undefined;
  const firstDoc = evidence.find((e) => e.type === "document_span") as Extract<Ev, { type: "document_span" }> | undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,textarea,select,[contenteditable=true]")) return;
      if (e.key === "[" && prev) nav(paths.risks(productId, version, prev.id));
      else if (e.key === "]" && next) nav(paths.risks(productId, version, next.id));
      else if (e.key.toLowerCase() === "d" && firstDoc) nav(paths.documents(productId, version, firstDoc.artifact_id, { f: f.id }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, firstDoc, nav, productId, version, f.id]);

  const grid = useRef<HTMLDivElement>(null);
  const verdict = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6" data-testid="check-page">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to={paths.risks(productId, version)} className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-text"><ArrowLeft className="h-3.5 w-3.5" /> Risks</Link>
        <span className="text-text-3">/</span>
        <Alias req={req} id={req.id} />
        <h1 className="min-w-0 flex-1 text-xl text-text" data-testid="check-title">{req.title || f.title}</h1>
        <div className="flex items-center gap-1">
          <NavBtn to={prev && paths.risks(productId, version, prev.id)} label={prev ? `Previous: ${idx.get(prev.requirement_id)?.alias ?? ""}` : "No previous risk"} k="["><ChevronLeft className="h-4 w-4" /></NavBtn>
          <NavBtn to={next && paths.risks(productId, version, next.id)} label={next ? `Next: ${idx.get(next.requirement_id)?.alias ?? ""}` : "No next risk"} k="]"><ChevronRight className="h-4 w-4" /></NavBtn>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusChip conclusion={f.effective_conclusion} severity={f.severity} size="md" />
        <CategoryLabel domain={req.domain} />
        <AiLabel className="ml-auto" />
      </div>

      <div ref={grid} className="relative mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,300px)_minmax(0,1fr)] lg:gap-14" data-testid="check-grid">
        <Connectors grid={grid} verdict={verdict} hover={hover} tone={tone} deps={[evidence.length, provisions.length, release.artifacts?.length]} />

        {/* YOUR COMPANY */}
        <section aria-labelledby="col-company" className="relative z-[1] min-w-0">
          <ColHead id="col-company">Your company</ColHead>
          <div className="space-y-3">
            {evidence.length === 0 && (
              <div className="rounded-md border border-dashed px-4 py-6 text-sm text-text-2" data-testid="no-evidence">No evidence was cited.</div>
            )}
            {evidence.map((e, i) => (
              <EvidenceCard key={i} k={`ev-${i}`} e={e} artifacts={release.artifacts ?? []} productId={productId} version={version} findingId={f.id} tone={tone} setHover={setHover} hover={hover} />
            ))}
          </div>
        </section>

        <Between />

        {/* VERDICT */}
        <section aria-labelledby="col-verdict" className="relative z-[1] min-w-0 lg:pt-6">
          <ColHead id="col-verdict" className="lg:hidden">Verdict</ColHead>
          <div ref={verdict} data-testid="verdict" className="rounded-lg border-2 bg-surface p-4 shadow-sm" style={{ borderColor: toneVar(tone, "bd") }}>
            <Verdict d={d} version={version} productId={productId} tone={tone} />
          </div>
          <div className="mt-3" data-testid="check-actions"><Slot name="check.actions" props={{ findingId: f.id, releaseId }} /></div>
        </section>

        <Between />

        {/* THE LAW */}
        <section aria-labelledby="col-law" className="relative z-[1] min-w-0">
          <ColHead id="col-law">The law</ColHead>
          <div className="space-y-3">
            {(f.citations ?? []).map((cid, i) => {
              const p = provisions.find((x) => x.id === cid);
              return p ? <LawCard key={cid} k={`law-${i}`} p={p} setHover={setHover} hover={hover} />
                : <div key={cid} data-law-card data-key={`law-${i}`} className="rounded-md border border-dashed px-4 py-3 text-sm text-text-2">Citation <code className="font-mono">{cid}</code> could not be loaded</div>;
            })}
            {!f.citations?.length && <div className="rounded-md border border-dashed px-4 py-6 text-sm text-text-2">No provisions cited.</div>}
          </div>
        </section>
      </div>

      <div className="mt-8 rounded-md border bg-surface px-4 py-3 text-sm" data-testid="rule">
        <span className="text-text-2">What the rule requires</span>{" "}
        <span className="text-text-3">(CCOmmit rule {req.alias ?? req.id}, curated from {provisions.map((p) => `${shortAct(p)} ${articleLabel(p).replace(/^Art\. /, "")}`).join(", ")})</span>
        <p className="mt-1 text-text">{req.statement}</p>
      </div>

      <HowProduced f={f} release={release} productId={productId} version={version} />
    </div>
  );
}

const ColHead = ({ id, children, className }: { id: string; children: ReactNode; className?: string }) => (
  <h2 id={id} className={cn("mb-2.5 text-xs uppercase tracking-[0.08em] text-text-3", className)}>{children}</h2>
);
const Between = () => (
  <div aria-hidden className="flex items-center gap-3 text-xs uppercase tracking-[0.08em] text-text-3 lg:hidden">
    <span className="h-px flex-1 bg-border" /> checked against <span className="h-px flex-1 bg-border" />
  </div>
);

function NavBtn({ to, label, k, children }: { to?: string; label: string; k: string; children: ReactNode }) {
  if (!to) return <Button size="icon" variant="ghost" disabled aria-label={label}>{children}</Button>;
  return <Button asChild size="icon" variant="ghost" title={`${label}  [${k}]`}><Link to={to} aria-label={label}>{children}</Link></Button>;
}

/* ---------------- evidence ---------------- */

function EvidenceCard({ e, k, artifacts, productId, version, findingId, tone, hover, setHover }: {
  e: Ev; k: string; artifacts: Artifact[]; productId: string; version: string; findingId: string; tone: StatusKey;
  hover: string | null; setHover: (k: string | null) => void;
}) {
  const on = hover === k;
  const common = {
    "data-ev-card": "", "data-key": k, tabIndex: 0,
    onMouseEnter: () => setHover(k), onMouseLeave: () => setHover(null), onFocus: () => setHover(k), onBlur: () => setHover(null),
  };
  const mark = (s: string) => (
    <mark className="rounded-[2px] px-0.5 text-text transition-colors duration-fast"
      style={{ background: `color-mix(in srgb, ${toneVar(tone)} ${on ? 30 : 14}%, transparent)`, boxShadow: `inset 0 -2px 0 ${toneVar(tone)}` }}>{s}</mark>
  );

  if (e.type === "missing") {
    return (
      <div {...common} data-testid="evidence-missing" className="rounded-md border-2 border-dashed bg-surface/60 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <div className="flex items-center gap-2 text-sm font-medium text-text"><CircleSlash className="h-4 w-4 text-text-3" /> Missing: {missingLabel(e.artifact_kind)}</div>
        <p className="mt-1 text-sm text-text-2">Not in this release.</p>
        <Button asChild size="sm" className="mt-2.5"><Link to={paths.documents(productId, version, undefined, { f: findingId })} data-testid="add-document">Add document</Link></Button>
      </div>
    );
  }
  if (e.type === "document_span") {
    const a = artifacts.find((x) => x.id === e.artifact_id);
    const c = a ? clause(a.text, e.quote, e.start, e.end) : { heading: null, before: "", quote: e.quote, after: "" };
    return (
      <div {...common} data-testid="evidence-document" className={cn("rounded-md border bg-surface px-4 py-3 outline-none transition-shadow duration-fast focus-visible:ring-2 focus-visible:ring-accent", on && "shadow-sm")}>
        <div className="flex items-center gap-2 text-xs text-text-2">
          <FileText className="h-3.5 w-3.5" /> <span className="font-medium text-text">{artifactLabel(a)}</span>
          {c.heading && <span className="truncate text-text-3">· {c.heading}</span>}
        </div>
        <p className="mt-2 text-[14px] leading-[22px] text-text-2">“{c.before}{mark(c.quote)}{c.after}”</p>
        <Link to={paths.documents(productId, version, e.artifact_id, { f: findingId })} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          Open in document <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }
  const repo = artifacts.find((x) => x.id === e.artifact_id) ?? artifacts.find((x) => x.kind === "code_repo");
  const file = repo?.files?.find((x) => x.path === e.path);
  const lines = file?.content.split("\n") ?? [];
  const from = Math.max(1, e.start_line - 2), to = Math.min(lines.length, e.end_line + 2);
  return (
    <div {...common} data-testid="evidence-code" className={cn("overflow-hidden rounded-md border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent", on && "shadow-sm")}>
      <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-text-2">
        <Code2 className="h-3.5 w-3.5" /> <span className="truncate font-mono text-text">{e.path}</span>
        <span className="ml-auto shrink-0 text-text-3">lines {e.start_line}–{e.end_line}</span>
      </div>
      {lines.length ? (
        <pre className="max-h-48 overflow-auto py-1.5 font-mono text-[12px] leading-[19px]">
          {lines.slice(from - 1, to).map((l, i) => {
            const n = from + i, hit = n >= e.start_line && n <= e.end_line;
            return (
              <div key={n} className="flex pr-3" style={hit ? { background: `color-mix(in srgb, ${toneVar(tone)} ${on ? 16 : 9}%, transparent)`, boxShadow: `inset 2px 0 0 ${toneVar(tone)}` } : undefined}>
                <span className="w-10 shrink-0 select-none pr-3 text-right text-text-3">{n}</span>
                <span className={hit ? "text-text" : "text-text-2"}>{l || " "}</span>
              </div>
            );
          })}
        </pre>
      ) : <p className="px-4 py-2 font-mono text-code text-text-2">“{e.quote}”</p>}
      <div className="border-t px-4 py-1.5">
        <Link to={paths.code(productId, version, { path: e.path, f: findingId })} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Open in code <ArrowRight className="h-3 w-3" /></Link>
      </div>
    </div>
  );
}

/* ---------------- verdict ---------------- */

function Verdict({ d, version, productId, tone }: { d: FindingDetail; version: string; productId: string; tone: StatusKey }) {
  const f = d.finding;
  const noEvidence = f.effective_conclusion === "uncertain" && !(f.evidence ?? []).length;
  const parts = d.requirement.remediation?.parts ?? [];
  const review = f.applicable_review ?? (d.reviews ?? []).find((r) => !r.revoked_at);
  const carried = carriedLabel(f, version);
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneVar(tone) }} />
        <span className="text-lg" style={{ color: toneVar(tone) }} data-testid="verdict-word">{statusWord(f.effective_conclusion)}</span>
        <SeverityTag severity={f.severity} className="ml-auto" />
      </div>
      <p className="mt-3 text-sm leading-[21px] text-text" data-testid="verdict-reasoning">
        {noEvidence ? "Needs counsel: the AI couldn't produce a verifiable answer for this requirement." : f.reasoning_summary}
      </p>
      <p className="mt-3 text-xs text-text-2">Confidence: <span className="text-text">{confidenceWord(f.confidence.finding)}</span></p>
      {review && (
        <div className="mt-3 rounded-md border border-counsel-bd bg-counsel-bg px-2.5 py-2 text-xs text-text" data-testid="review-line">
          Reviewed by {review.reviewer_name} · {DECISION_WORD[review.decision]} · ‘{review.comment}’ · {fmtDateTime(review.created_at)}
          {carried && <div className="mt-0.5 text-counsel-fg" data-testid="carried">{carried} · evidence unchanged</div>}
        </div>
      )}
      {parts.length > 0 && f.effective_conclusion !== "satisfied" && f.effective_conclusion !== "not_applicable" && (
        <Link to={paths.fixPlan(productId, version)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <Wrench className="h-3.5 w-3.5" /> Fix: {parts.map((p) => p.id).join(", ")} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </>
  );
}
/* ---------------- law ---------------- */

function LawCard({ p, k, hover, setHover }: { p: LegalProvision; k: string; hover: string | null; setHover: (k: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const guidance = p.kind === "guidance";
  const on = hover === k;
  return (
    <article
      data-law-card data-key={k} data-testid="law-card" tabIndex={0}
      onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(k)} onBlur={() => setHover(null)}
      className={cn("rounded-md border bg-surface px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent", guidance && "border-dashed", on && "shadow-sm")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <LawBadge provision={p} />
        <span className="text-sm font-medium text-text">{shortAct(p)}</span>
        <span className="text-sm text-text-2">· {articleLabel(p)}</span>
      </div>
      <blockquote className={cn("mt-2.5 font-law text-[15px] leading-[24px] text-text", !open && "line-clamp-[8]")}>{p.text}</blockquote>
      {p.text.length > 520 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-xs text-accent hover:underline">{open ? "Show less" : "Show full text"}</button>
      )}
      {guidance && <p className="mt-2 text-xs italic text-text-3">Guidance interprets the law; it is not binding.</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-3">
        <a href={p.source_url} target="_blank" rel="noreferrer" data-testid="source-link" className="inline-flex items-center gap-1 text-accent hover:underline">
          Official source <ExternalLink className="h-3 w-3" />
        </a>
        <span>· {sourceLabel(p)} · retrieved {fmtDate(p.retrieved_at)}</span>
      </div>
    </article>
  );
}

/* ---------------- connectors ---------------- */

type Path = { key: string; d: string };
function Connectors({ grid, verdict, hover, tone, deps }: {
  grid: React.RefObject<HTMLDivElement | null>; verdict: React.RefObject<HTMLDivElement | null>; hover: string | null; tone: StatusKey; deps: unknown[];
}) {
  const reduce = useReducedMotion();
  const [list, setList] = useState<Path[]>([]);
  const calc = useCallback(() => {
    const g = grid.current, v = verdict.current;
    if (!g || !v || window.innerWidth < 1024) return setList([]);
    const box = g.getBoundingClientRect(), vb = v.getBoundingClientRect();
    const vy = vb.top - box.top + Math.min(56, vb.height / 2);
    const out: Path[] = [];
    g.querySelectorAll<HTMLElement>("[data-ev-card],[data-law-card]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const ev = el.hasAttribute("data-ev-card");
      const y = r.top - box.top + Math.min(28, r.height / 2);
      const x1 = ev ? r.right - box.left : r.left - box.left;
      const x2 = ev ? vb.left - box.left : vb.right - box.left;
      const dx = (x2 - x1) * 0.5;
      out.push({ key: el.dataset.key ?? "", d: `M${x1},${y} C${x1 + dx},${y} ${x2 - dx},${vy} ${x2},${vy}` });
    });
    setList(out);
  }, [grid, verdict]);
  useLayoutEffect(() => {
    // the grid and verdict refs attach after this child's layout effect: measure on the next frame
    const ro = new ResizeObserver(calc);
    const raf = requestAnimationFrame(() => { calc(); if (grid.current) ro.observe(grid.current); });
    window.addEventListener("resize", calc);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", calc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc, ...deps]);
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible lg:block" data-testid="connectors">
      {list.map((p, i) => {
        const on = hover === p.key;
        return (
          <motion.path
            key={p.key} d={p.d} data-connector fill="none" stroke={toneVar(tone)} strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1, strokeWidth: on ? 2.25 : 1.25, opacity: hover && !on ? 0.25 : on ? 1 : 0.55 }}
            transition={{ pathLength: { duration: 0.32, delay: i * 0.04, ease: [0.2, 0.7, 0.2, 1] }, strokeWidth: { duration: 0.12 }, opacity: { duration: 0.12 } }}
          />
        );
      })}
    </svg>
  );
}

/* ---------------- how this was produced ---------------- */

async function requirementEvents(runId: string, reqId: string): Promise<AgentEvent[]> {
  if (FIXTURES) return (await api.fixtureEvents()).filter((e) => e.run_id === runId && e.requirement_id === reqId);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  const out: AgentEvent[] = [];
  try {
    const res = await fetch(`${API_URL}/api/runs/${encodeURIComponent(runId)}/events?requirement_id=${encodeURIComponent(reqId)}`, {
      headers: { Authorization: `Bearer ${getToken()}`, "X-Deploy-Token": getToken() ?? "" }, signal: ctl.signal,
    });
    const reader = res.body?.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split(/\r?\n\r?\n/);
      buf = frames.pop() ?? "";
      for (const fr of frames) {
        const data = fr.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
        if (!data) continue;
        try { const j = JSON.parse(data); out.push((j && !j.type && j.data ? j.data : j) as AgentEvent); } catch { /* skip */ }
      }
      if (out.some((e) => e.type === "finding" || e.type === "run_end")) break;
    }
  } catch { /* aborted: return what arrived */ } finally { clearTimeout(timer); ctl.abort(); }
  return out;
}

const EVENT_WORD: Partial<Record<AgentEvent["type"], string>> = {
  scope: "Scope", tool_call: "Tool", tool_result: "Result", model_request: "Model", model_response: "Answer", retry: "Retry", finding: "Finding", step: "Step", gate: "Gate",
};

function HowProduced({ f, release, productId, version }: { f: FindingView; release: ReleaseOut; productId: string; version: string }) {
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(false);
  const runId = release.latest_assessment?.run_id;
  const ev = useQuery({
    queryKey: ["req-events", runId, f.requirement_id],
    queryFn: () => requirementEvents(runId!, f.requirement_id),
    enabled: open && !!runId,
    staleTime: 60_000,
  });
  const t0 = ev.data?.[0] ? Date.parse(ev.data[0].ts) : 0;
  return (
    <section className="mt-4 rounded-md border bg-surface" data-testid="how-produced">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-text">
        <ChevronDown className={cn("h-4 w-4 text-text-2 transition-transform duration-base", !open && "-rotate-90")} /> How this was produced
        <span className="ml-auto text-xs text-text-3">{release.latest_assessment?.model} · {f.attempts} {f.attempts === 1 ? "attempt" : "attempts"}</span>
      </button>
      {open && (
        <div className="border-t px-4 py-3 text-sm">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">
            <span>Applicability <span className="tnum text-text">{Math.round(f.confidence.applicability * 100)}%</span></span>
            <span>Evidence <span className="tnum text-text">{Math.round(f.confidence.evidence * 100)}%</span></span>
            <span>Finding <span className="tnum text-text">{Math.round(f.confidence.finding * 100)}%</span></span>
            {runId && <Link to={paths.activity(productId, version, { run: runId })} className="ml-auto text-accent hover:underline">Open the full run →</Link>}
          </div>
          {ev.isPending && <Skeleton className="mt-3 h-16" />}
          {ev.data && ev.data.length === 0 && <p className="mt-3 text-xs text-text-3">No recorded steps for this requirement.</p>}
          {ev.data && ev.data.length > 0 && (
            <ol className="mt-3 space-y-1 border-l pl-3" data-testid="produced-events">
              {ev.data.filter((e) => e.type !== "retry").map((e) => (
                <li key={e.seq} className="flex gap-2 text-xs">
                  <span className="tnum w-12 shrink-0 text-text-3">+{Math.max(0, Math.round((Date.parse(e.ts) - t0) / 100) / 10)}s</span>
                  <span className="w-14 shrink-0 text-text-2">{EVENT_WORD[e.type] ?? e.type}</span>
                  <span className="min-w-0 text-text">{e.tool ? <code className="mr-1 font-mono">{e.tool}</code> : null}{e.summary}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 border-t pt-2">
            <button type="button" aria-expanded={tech} onClick={() => setTech((v) => !v)} className="inline-flex items-center gap-1 text-xs text-text-2 hover:text-text" data-testid="technical-toggle">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-base", !tech && "-rotate-90")} /> Technical details
            </button>
            {tech && (
              <div className="mt-2 space-y-1 font-mono text-[11.5px] text-text-2" data-testid="technical-details">
                <div>requirement {f.requirement_id} · finding {f.id} · fingerprint {f.evidence_fingerprint.slice(0, 12)}</div>
                {(f.validation_notes ?? []).length ? f.validation_notes!.map((n, i) => <div key={i}>{n}</div>) : <div>No validation notes.</div>}
                {ev.data?.filter((e) => e.type === "retry" || e.error).map((e) => <div key={`r${e.seq}`}>{e.summary}{e.error ? ` · ${e.error}` : ""}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
