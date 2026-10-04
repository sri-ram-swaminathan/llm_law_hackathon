import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api, ApiError, describeError, FIXTURES, type ReleaseOut } from "@/api/client";
import { Button } from "@/components/button";
import { Banner } from "@/components/feedback";
import { Sheet } from "@/components/sheet";
import { addToCache, uploadRelease, VERSION_RE } from "@/features/releases/api";
import { versionLabel } from "@/lib/format";
import { invalidateAssessmentData, useReleases } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { buildZip } from "./zipWriter";

export type DocSlot = { key: string; label: string; kind: string; path: string };
/** Slot → configured bundle path (data/products/wealthpilot.yaml `documents`). */
export const DOC_SLOTS: DocSlot[] = [
  { key: "business_plan", label: "Business plan", kind: "business_plan", path: "compliance/business-plan.md" },
  { key: "terms", label: "Terms", kind: "terms", path: "compliance/terms.md" },
  { key: "privacy_policy", label: "Privacy policy", kind: "privacy_policy", path: "compliance/privacy-policy.md" },
  { key: "regulatory_registration", label: "CIF registration", kind: "regulatory_registration", path: "compliance/cif-registration.md" },
  { key: "other", label: "Other", kind: "other", path: "" },
];
export const slotForKind = (kind: string) => DOC_SLOTS.find((s) => s.kind === kind)?.key ?? "other";

const slug = (name: string) => name.toLowerCase().replace(/\.md$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";

/** Next patch ("0.9.1"); "-docs.N" when taken. */
export function suggestVersion(base: string, taken: Set<string>): string {
  const m = base.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return `${base}-docs.1`;
  const next = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
  if (!taken.has(next)) return next;
  for (let n = 1; ; n++) if (!taken.has(`${next}-docs.${n}`)) return `${next}-docs.${n}`;
}

/** Every file of the base release (documents + code), with `file` placed at `path`. */
export function overlayBundle(base: ReleaseOut, path: string, content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of base.artifacts ?? []) {
    if (a.files?.length) for (const f of a.files) out[f.path] = f.content;
    else if (a.path && a.kind !== "code_repo") out[a.path] = a.text;
  }
  out[path] = content;
  return out;
}

/**
 * Add or replace a document (DESIGN §4.7): builds the new bundle in the browser from the base release's
 * documents and code with the file overlaid, uploads it (`POST /api/releases`), starts the assessment,
 * then opens the new version's Summary.
 */
export function AddDocumentSheet({ open, onOpenChange, base, productId, presetSlot }: {
  open: boolean; onOpenChange: (o: boolean) => void; base: ReleaseOut; productId: string; presetSlot?: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const releases = useReleases();
  const taken = useMemo(() => new Set((releases.data ?? []).map((r) => r.release.version)), [releases.data]);
  const [slotKey, setSlotKey] = useState(presetSlot ?? "privacy_policy");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setSlotKey(presetSlot ?? "privacy_policy"); setError(null); setBusy(null); } }, [open, presetSlot]);
  useEffect(() => { if (open) setVersion(suggestVersion(base.release.version, taken)); }, [open, base.release.version, taken]);

  const slot = DOC_SLOTS.find((s) => s.key === slotKey) ?? DOC_SLOTS[0];
  const path = slot.path || `compliance/${slug(file?.name ?? "document")}.md`;
  const current = (base.artifacts ?? []).find((a) => a.path === path);
  const heading = file?.text.match(/^#\s+(.+)$/m)?.[1];
  const versionOk = VERSION_RE.test(version) && !taken.has(version);
  const baseV = versionLabel(base.release.version);

  const pick = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.(md|markdown|txt)$/i.test(f.name)) return setError("Pick a Markdown (.md) file.");
    if (f.size > 1024 * 1024) return setError("The file is larger than 1 MB.");
    setFile({ name: f.name, text: await f.text() });
  };

  const submit = async () => {
    if (!file || !versionOk) return;
    setError(null);
    try {
      setBusy("Building the bundle");
      const full = FIXTURES ? base : await api.release(base.release.id);
      const zip = buildZip(overlayBundle(full, path, file.text));
      setBusy("Uploading");
      const out = await uploadRelease([new File([zip as BlobPart], `wealthpilot-${version}.zip`, { type: "application/zip" })], version, base, () => undefined);
      addToCache(qc, out);
      setBusy("Starting the assessment");
      try {
        await api.startAssessment(out.release.id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setBusy(null);
          setError(`A run is in progress on Wealthpilot; your release ${versionLabel(version)} was created, start the run when it finishes.`);
          return;
        }
        if (!FIXTURES) throw e;
      }
      invalidateAssessmentData(qc);
      onOpenChange(false);
      navigate(paths.summary(productId, out.release.version));
    } catch (e) {
      setBusy(null);
      if (e instanceof ApiError && e.status === 409) setError(`${versionLabel(version)} already exists, pick another version.`);
      else setError(describeError(e));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add or replace a document" data-testid="add-document-sheet"
      description={`Creates a new version from ${baseV} and runs a new assessment.`}
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={!file || !versionOk || !!busy} data-testid="add-document-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ? `${busy}…` : `Create ${versionLabel(version || "…")} and assess`}
        </Button>
      </>}>
      <div className="grid gap-5">
        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-text-2">1 · Document</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
            {DOC_SLOTS.map((s) => {
              const replaces = s.path && (base.artifacts ?? []).some((a) => a.path === s.path);
              return (
                <button key={s.key} type="button" role="radio" aria-checked={slotKey === s.key} onClick={() => setSlotKey(s.key)} data-testid={`slot-${s.key}`}
                  className={cn("rounded-md border px-3 py-2 text-left text-sm transition-colors duration-fast",
                    slotKey === s.key ? "border-accent bg-accent-soft text-text" : "text-text-2 hover:bg-surface-2")}>
                  <span className="block font-medium">{s.label}</span>
                  <span className="block truncate font-mono text-[11px] text-text-3">{s.path || "compliance/<name>.md"}</span>
                  {replaces && <span className="block text-[11px] text-medium-fg">Replaces the current file</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-text-2">2 · File</legend>
          <label
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center text-sm text-text-2 transition-colors duration-fast hover:bg-surface-2">
            <FilePlus2 className="h-5 w-5 text-text-3" aria-hidden />
            {file ? <><span className="font-mono text-code text-text">{file.name}</span>{heading && <span className="text-xs">“{heading}”</span>}</>
              : <span>Drop a <span className="font-mono">.md</span> file or click to choose (≤ 1 MB)</span>}
            <input type="file" accept=".md,.markdown,.txt,text/markdown" className="sr-only" data-testid="add-document-file" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-text-2">3 · New version</legend>
          <input value={version} onChange={(e) => setVersion(e.target.value.trim())} aria-label="New version" data-testid="add-document-version"
            className={cn("h-9 w-40 rounded-md border bg-surface px-2 font-mono text-sm text-text", version && !versionOk && "border-blocker-bd")} />
          {version && !VERSION_RE.test(version) && <p className="mt-1 text-xs text-blocker-fg">Use a version like 0.9.1 or 1.0.0-rc.2.</p>}
          {taken.has(version) && <p className="mt-1 text-xs text-blocker-fg">{versionLabel(version)} already exists, pick another version.</p>}
        </fieldset>

        <p className="text-sm text-text-2" data-testid="add-document-copy">
          Creates <span className="font-mono text-text">{versionLabel(version || "…")}</span> from {baseV}'s documents and code, with your file
          {current ? <> in place of the {slot.label.toLowerCase()}</> : <> added as <span className="font-mono">{path}</span></>}. Then runs a new assessment.
        </p>
        {error && <Banner tone="error" data-testid="add-document-error">{error}</Banner>}
      </div>
    </Sheet>
  );
}

export function register(): void {
  // Opened from the Documents tab and the fix plan; contributes nothing to slots.
}
