import type { RunSummary } from "@/api/client";
import { fmtDateTime, fmtSeconds, secondsBetween } from "@/lib/format";

/**
 * The run badge (DESIGN §4.11, critique 4): "Live" only while the backend says `running`;
 * a finished run is "Recorded run · <time> · <s>"; playing it back is "Replay of recorded run".
 */
export function runLabel(run: Pick<RunSummary, "status" | "started_at" | "ended_at"> | null | undefined, replaying = false): { tone: "live" | "recorded" | "replay" | "failed"; text: string } {
  if (!run) return { tone: "recorded", text: "No run recorded" };
  if (run.status === "running") return { tone: "live", text: "Live" };
  const when = fmtDateTime(run.started_at);
  if (replaying) return { tone: "replay", text: `Replay of recorded run · ${when}` };
  if (run.status === "failed") return { tone: "failed", text: `Run failed · ${when}` };
  const s = secondsBetween(run.started_at, run.ended_at);
  return { tone: "recorded", text: `Recorded run · ${when}${s != null ? ` · ${fmtSeconds(s)}` : ""}` };
}
