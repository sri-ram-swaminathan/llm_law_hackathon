import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useFindings } from "@/lib/queries";
import { Skeleton } from "@/components/card";
import { ArtifactPane, Empty, type ArtifactFocus } from "./ArtifactPane";
import { useRelease } from "./data";

export { ArtifactPane, Empty, type ArtifactFocus } from "./ArtifactPane";
export { MarkdownView } from "./MarkdownView";
export { CodeView } from "./CodeView";
export * from "./MarginNotes";
export * from "./highlight";
export * from "./data";

/**
 * Self-contained artifact viewer (document or code) with every finding's evidence highlighted.
 * Clicking a highlight opens the finding workspace for that release.
 */
export function DocumentViewer({ artifactId, releaseId, highlightFindingId }: { artifactId: string; releaseId: string; highlightFindingId?: string }) {
  const rel = useRelease(releaseId);
  const findings = useFindings(releaseId);
  const navigate = useNavigate();
  const [path, setPath] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => navigate(`/r/${releaseId}/findings/${id}`), [navigate, releaseId]);
  const artifact = rel.data?.artifacts?.find((a) => a.id === artifactId);
  const focus = useMemo<ArtifactFocus>(() => null, []);

  if (rel.isLoading || findings.isLoading) return <Skeleton className="h-full min-h-64" />;
  if (!artifact) return <Empty text="This artifact is not part of the release bundle." />;
  return (
    <ArtifactPane
      artifact={artifact} findings={findings.data ?? []} activeFindingId={highlightFindingId}
      focus={focus} filePath={path} onFilePath={setPath} onSelectFinding={onSelect}
    />
  );
}

export function register(): void {
  // Viewer components are consumed directly by the finding and evidence pages; nothing to register in slots.
}
