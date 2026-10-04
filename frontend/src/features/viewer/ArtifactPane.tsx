import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Code2, FileText } from "lucide-react";
import type { Artifact, FindingView } from "@/api/client";
import { cn } from "@/lib/utils";
import { CodeView } from "./CodeView";
import { MarkdownView } from "./MarkdownView";
import { docHighlights, kindLabel, lineHighlights } from "./highlight";

export type ArtifactFocus = { findingId: string; start?: number; line?: number; endLine?: number; token?: number } | null;

/**
 * One artifact, rendered as a document or as code depending on its kind. Switching artifact/file cross-fades,
 * which is the "morph" between document and code in the workspace's middle pane.
 */
export function ArtifactPane({ artifact, findings, activeFindingId, focus, filePath, onFilePath, onSelectFinding, className }: {
  artifact: Artifact;
  findings: FindingView[];
  activeFindingId?: string;
  focus?: ArtifactFocus;
  filePath?: string | null;
  onFilePath?: (path: string) => void;
  onSelectFinding?: (findingId: string) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const isCode = artifact.kind === "code_repo" || (artifact.files?.length ?? 0) > 0;
  const files = artifact.files ?? [];
  const file = isCode ? files.find((f) => f.path === filePath) ?? files[0] : undefined;

  const docHs = useMemo(() => (isCode ? [] : docHighlights(findings, artifact.id)), [findings, artifact.id, isCode]);
  const lineHs = useMemo(() => (file ? lineHighlights(findings, artifact.id, file.path) : []), [findings, artifact.id, file]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of findings) for (const e of f.evidence ?? []) if (e.type === "code" && e.artifact_id === artifact.id) m.set(e.path, (m.get(e.path) ?? 0) + 1);
    return m;
  }, [findings, artifact.id]);

  const Icon = isCode ? Code2 : FileText;
  const key = `${artifact.id}:${file?.path ?? ""}`;
  const codeFocus = useMemo(() => (focus && file && focus.line != null ? { startLine: focus.line, endLine: focus.endLine, token: focus.token } : null), [focus, file]);
  const docFocus = useMemo(() => (focus && !isCode ? { findingId: focus.findingId, start: focus.start } : null), [focus, isCode]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b bg-surface px-4 py-1.5">
        <Icon className="h-4 w-4 shrink-0 text-text-3" aria-hidden />
        <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 text-xs text-text-2">{kindLabel(artifact.kind)}</span>
        {isCode && files.length > 0 ? (
          <select
            aria-label="File" value={file?.path ?? ""} onChange={(e) => onFilePath?.(e.target.value)}
            className="min-w-0 flex-1 truncate rounded-sm border bg-surface px-2 py-1 font-mono text-code text-text transition-colors duration-fast hover:bg-surface-2"
          >
            {files.map((f) => <option key={f.path} value={f.path}>{f.path}{counts.get(f.path) ? `  ●${counts.get(f.path)}` : ""}</option>)}
          </select>
        ) : (
          <span className="min-w-0 flex-1 truncate font-mono text-code text-text" title={artifact.path}>{artifact.path}</span>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key} className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {isCode ? (
              file ? (
                <CodeView path={file.path} content={file.content} highlights={lineHs} activeFindingId={activeFindingId} focus={codeFocus} onSelectFinding={onSelectFinding} />
              ) : <Empty text="This repository snapshot has no files." />
            ) : artifact.text ? (
              <div data-scroll-root className="h-full overflow-auto bg-surface">
                <MarkdownView text={artifact.text} highlights={docHs} activeFindingId={activeFindingId} focus={docFocus} onSelectFinding={onSelectFinding} />
              </div>
            ) : <Empty text="This document is empty." />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const Empty = ({ text, className }: { text: string; className?: string }) => (
  <div className={cn("flex h-full items-center justify-center p-8 text-center text-text-2", className)}>{text}</div>
);
