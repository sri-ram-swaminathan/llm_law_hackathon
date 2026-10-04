import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { FileArchive, FileUp, GitBranch, GitPullRequest, Loader2, PackagePlus, Rocket, Sprout, UploadCloud, User, Wrench, X } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { type ReleaseOut } from "@/api/client";
import { Button } from "@/components/button";
import { Card, Mono, Skeleton } from "@/components/card";
import { Dialog } from "@/components/popover-menu";
import { Notice } from "@/features/fixplan";
import { sortReleases, useReleases, versionLabel } from "@/lib/queries";
import { registerSlot } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { addToCache, importCiRun, readCiResult, uploadRelease, VERSION_RE } from "./api";
import { WhatChanged } from "./WhatChanged";

type Source = ReleaseOut["release"]["source"];
const SOURCE: Record<Source, { label: string; Icon: typeof Sprout; cls: string }> = {
  seed: { label: "seed", Icon: Sprout, cls: "bg-na-bg text-na-fg border-na-bd" },
  ui: { label: "ui", Icon: User, cls: "bg-accent-soft text-accent border-transparent" },
  ci: { label: "ci", Icon: Rocket, cls: "bg-satisfied-bg text-satisfied-fg border-satisfied-bd" },
};

export function SourceBadge({ source }: { source: Source }) {
  const s = SOURCE[source];
  return (
    <span data-testid={`source-${source}`} className={cn("inline-flex h-5 items-center gap-1 rounded-full border px-2 font-mono text-xs leading-none", s.cls)}>
      <s.Icon className="h-3 w-3" aria-hidden /> {s.label}
    </span>
  );
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(+d) ? null : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

/* ---------------- page ---------------- */

export function ReleasesPage() {
  const { data, isLoading, isError, refetch } = useReleases();
  const [dialog, setDialog] = useState<"new" | "import" | null>(null);
  const list = [...sortReleases(data ?? [])].reverse();
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6" data-testid="releases-page">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl">Releases</h1>
          <p className="mt-1 text-sm text-text-2">Every version of Wealthpilot the CCO has seen, whether seeded, uploaded here or imported from CI.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="md" onClick={() => setDialog("import")} data-testid="import-ci"><FileUp className="h-4 w-4" /> Import CI run</Button>
          <Button size="md" variant="primary" onClick={() => setDialog("new")} data-testid="new-release"><PackagePlus className="h-4 w-4" /> New release</Button>
        </div>
      </div>

      {isLoading && <div className="space-y-3" aria-busy="true"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
      {isError && <Notice title="Releases could not be loaded" body="Check that the backend is running, then try again." action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {data && list.length === 0 && (
        <Notice tone="neutral" title="No releases yet" body="Upload a bundle of your product's documents and code to create the first release." action={<Button variant="primary" size="md" onClick={() => setDialog("new")}>New release</Button>} />
      )}

      <ul className="space-y-3">
        {list.map((r, i) => (
          <motion.li key={r.release.id} data-testid={`release-row-${r.release.version}`}
            initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.03 }}>
            <ReleaseRow r={r} />
          </motion.li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-text-3">
        Assessing a new release against a different regulatory profile? <Link to="/profile" className="text-accent hover:underline">Review the profile</Link>.
      </p>

      <NewReleaseDialog open={dialog === "new"} onClose={() => setDialog(null)} releases={data ?? []} />
      <ImportDialog open={dialog === "import"} onClose={() => setDialog(null)} />
    </div>
  );
}

function ReleaseRow({ r }: { r: ReleaseOut }) {
  const rel = r.release;
  const date = fmtDate(rel.created_at);
  const assessed = !!r.latest_assessment;
  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors duration-fast hover:bg-surface-2/50">
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/r/${rel.id}/overview`} className="font-mono text-base font-medium hover:text-accent">{versionLabel(rel.version)}</Link>
          <SourceBadge source={rel.source} />
          {rel.pr_number != null && (
            rel.ci_run_url
              ? <a href={rel.ci_run_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline" data-testid="pr-link"><GitPullRequest className="h-3.5 w-3.5" /> PR #{rel.pr_number}</a>
              : <span className="inline-flex items-center gap-1 text-sm text-text-2"><GitPullRequest className="h-3.5 w-3.5" /> PR #{rel.pr_number}</span>
          )}
          {rel.pr_number == null && rel.ci_run_url && (
            <a href={rel.ci_run_url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">CI run</a>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
          {rel.branch && <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{rel.branch}</span>}
          {rel.git_sha && <Mono className="text-text-3">{rel.git_sha.slice(0, 7)}</Mono>}
          {date && <span>{date}</span>}
          <span>{r.artifacts?.length ? `${r.artifacts.length} artifacts` : "no artifacts attached"}</span>
          {!assessed && <span className="rounded-full border border-dashed px-1.5 text-text-3">not assessed yet</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild><Link to={`/r/${rel.id}/overview`}>Open</Link></Button>
        {assessed && <Button asChild variant="ghost"><Link to={`/r/${rel.id}/fix-plan`}><Wrench className="h-3.5 w-3.5" /> Fix plan</Link></Button>}
      </div>
    </Card>
  );
}

/* ---------------- dialogs ---------------- */

function Modal({ open, onClose, title, description, children, testid }: {
  open: boolean; onClose: () => void; title: string; description: string; children: ReactNode; testid: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content data-testid={testid}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-md border bg-surface shadow-overlay">
          <header className="flex items-start justify-between gap-3 border-b px-5 py-3">
            <div>
              <Dialog.Title className="text-lg">{title}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-text-2">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X className="h-4 w-4" /></Button></Dialog.Close>
          </header>
          <div className="space-y-4 px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DropZone({ files, onFiles, accept, multiple, hint, icon: Icon, disabled }: {
  files: File[]; onFiles: (f: File[]) => void; accept?: string; multiple?: boolean; hint: string; icon: typeof UploadCloud; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) onFiles(multiple ? dropped : dropped.slice(0, 1));
  };
  return (
    <div
      role="button" tabIndex={0} aria-label={hint} data-testid="dropzone" aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
      className={cn("flex cursor-pointer flex-col items-center gap-1.5 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors duration-fast",
        over ? "border-accent bg-accent-soft" : "hover:bg-surface-2", disabled && "pointer-events-none opacity-60")}
    >
      <Icon className={cn("h-6 w-6", over ? "text-accent" : "text-text-3")} aria-hidden />
      {files.length === 0 ? (
        <>
          <p className="text-sm font-medium">Drop files here or <span className="text-accent">browse</span></p>
          <p className="text-xs text-text-3">{hint}</p>
        </>
      ) : (
        <ul className="max-h-28 w-full space-y-0.5 overflow-y-auto text-sm" data-testid="dropped-files">
          {files.map((f) => <li key={f.name + f.size} className="truncate font-mono text-code">{f.name} <span className="text-text-3">{(f.size / 1024).toFixed(f.size > 10240 ? 0 : 1)} KB</span></li>)}
        </ul>
      )}
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} data-testid="file-input"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) onFiles(f); e.target.value = ""; }} />
    </div>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md border border-blocker-bd bg-blocker-bg px-3 py-2 text-sm text-blocker-fg">{children}</p>;
}

function NewReleaseDialog({ open, onClose, releases }: { open: boolean; onClose: () => void; releases: ReleaseOut[] }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [version, setVersion] = useState("");
  const [pct, setPct] = useState(0);
  const latest = [...sortReleases(releases)].pop();

  const reset = () => { setFiles([]); setVersion(""); setPct(0); up.reset(); };
  const up = useMutation({
    mutationFn: () => uploadRelease(files, version.trim().replace(/^v/, ""), latest, setPct),
    onSuccess: (out) => { addToCache(qc, out); reset(); onClose(); nav(`/r/${out.release.id}/overview`); },
  });

  const v = version.trim().replace(/^v/, "");
  const dup = releases.some((r) => r.release.version === v);
  const vErr = v && !VERSION_RE.test(v) ? "Use a version like 1.0.0 or 1.0.0-rc.2." : dup ? `Version ${v} already exists.` : null;
  const ready = files.length > 0 && v && !vErr && !up.isPending;

  return (
    <Modal open={open} onClose={() => !up.isPending && (reset(), onClose())} testid="new-release-dialog" title="New release"
      description="Upload the documents and code zip for this version. The CCO assesses it against your confirmed profile.">
      <DropZone files={files} onFiles={setFiles} multiple icon={UploadCloud} disabled={up.isPending}
        hint="Business plan, product spec, privacy policy, terms, or a code .zip" />
      <label className="block text-sm">
        <span className="mb-1 block text-text-2">Version</span>
        <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" disabled={up.isPending} data-testid="version-input"
          aria-invalid={!!vErr} className="h-9 w-full rounded-md border bg-surface px-3 font-mono text-code outline-none focus:border-accent aria-[invalid=true]:border-blocker-bd" />
        {vErr && <span className="mt-1 block text-xs text-blocker-fg">{vErr}</span>}
      </label>
      {up.isPending && (
        <div data-testid="upload-progress">
          <div className="mb-1 flex justify-between text-xs text-text-2"><span>Uploading</span><span className="tnum">{pct}%</span></div>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {up.isError && <ErrorLine>{up.error instanceof Error ? up.error.message : "The upload failed."}</ErrorLine>}
      <div className="flex justify-end gap-2 pt-1">
        <Button size="md" variant="ghost" disabled={up.isPending} onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button size="md" variant="primary" disabled={!ready} onClick={() => up.mutate()} data-testid="upload-submit">
          {up.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading</> : "Create release"}
        </Button>
      </div>
    </Modal>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const imp = useMutation({
    mutationFn: async () => importCiRun(await readCiResult(files[0])),
    onSuccess: (out) => { addToCache(qc, out); setFiles([]); imp.reset(); onClose(); nav(`/r/${out.release.id}/overview`); },
  });
  const close = () => { if (imp.isPending) return; setFiles([]); imp.reset(); onClose(); };

  return (
    <Modal open={open} onClose={close} testid="import-dialog" title="Import CI run"
      description="Load the result of a CCOmmit CI check as a release. Use the result.json or the artifact ZIP from gh run download.">
      <DropZone files={files} onFiles={(f) => { imp.reset(); setFiles(f); }} accept=".json,.zip,application/json,application/zip" icon={FileArchive} disabled={imp.isPending}
        hint="result.json or artifact .zip" />
      {imp.isError && <ErrorLine>{imp.error instanceof Error ? imp.error.message : "The import failed."}</ErrorLine>}
      <div className="flex justify-end gap-2 pt-1">
        <Button size="md" variant="ghost" disabled={imp.isPending} onClick={close}>Cancel</Button>
        <Button size="md" variant="primary" disabled={!files.length || imp.isPending} onClick={() => imp.mutate()} data-testid="import-submit">
          {imp.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing</> : "Import"}
        </Button>
      </div>
    </Modal>
  );
}

export function register(): void {
  registerSlot("overview.whatChanged", WhatChanged, { id: "releases.whatChanged" });
}
