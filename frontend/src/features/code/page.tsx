import { useMemo } from "react";
import { LegacyReleasePage } from "@/app/legacy";
import { EvidencePage } from "@/features/evidence";
import { useCurrentRelease } from "@/lib/queries";

/** Code `…/code` (`?path=`, `?f=`) — T27 STUB: the legacy evidence room on the code artifact. T30 replaces this file (DESIGN §4.8). */
export default function CodePage() {
  const { release } = useCurrentRelease();
  const artifactId = release?.artifacts?.find((a) => a.kind === "code_repo")?.id;
  const extra = useMemo(() => ({ artifactId }), [artifactId]);
  return <LegacyReleasePage extra={extra}><EvidencePage /></LegacyReleasePage>;
}
