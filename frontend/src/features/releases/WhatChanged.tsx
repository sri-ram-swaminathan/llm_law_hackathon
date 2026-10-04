import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Link } from "react-router";
import type { Readiness } from "@/api/client";
import { Card, CardHeader } from "@/components/card";
import { STATUS_CLASS } from "@/components/status-chip";
import { Tip } from "@/components/tooltip";
import { aliasOf, reqIndex, useReleases, useRequirements, versionLabel } from "@/lib/queries";
import type { StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Registered into the `overview.whatChanged` slot: resolved and new requirements since the previous release, as chips. */
export function WhatChanged({ releaseId, readiness }: { releaseId: string; readiness: Readiness }) {
  const reqs = useRequirements();
  const releases = useReleases();
  const idx = reqIndex(reqs.data);
  const ch = readiness.changes_since_previous ?? {};
  const prev = releases.data?.find((r) => r.release.id === readiness.previous_release_id)?.release.version;
  const resolved = ch.resolved ?? [], added = ch.new ?? [], unchanged = ch.unchanged ?? [];
  const first = !readiness.previous_release_id;

  const Group = ({ title, ids, tone, Icon }: { title: string; ids: string[]; tone: StatusKey; Icon: typeof CheckCircle2 }) => (
    <div className="px-4 py-3" data-testid={`changed-${title.toLowerCase()}`}>
      <div className="mb-2 flex items-center gap-2 text-xs text-text-2">
        <Icon className="h-3.5 w-3.5" style={{ color: `var(--${tone}-fg)` }} aria-hidden /> {title}
        <span className="tnum text-text-3">{ids.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ids.length === 0 && <span className="text-sm text-text-3">None</span>}
        {ids.map((id) => (
          <Tip key={id} label={idx.get(id)?.statement ?? id}>
            <Link to={`/r/${releaseId}/findings`} data-testid={`chip-${title.toLowerCase()}-${aliasOf(idx, id)}`}
              className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-code transition-colors duration-fast hover:brightness-95", STATUS_CLASS[tone])}>
              {aliasOf(idx, id)}
            </Link>
          </Tip>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="self-start" data-testid="what-changed">
      <CardHeader title="What changed" right={prev ? <span className="text-xs text-text-3">since {versionLabel(prev)}</span> : undefined} />
      {first ? (
        <p className="px-4 py-6 text-sm text-text-2">First assessment of Wealthpilot. Switch to a later release to see what moved.</p>
      ) : (
        <div className="divide-y">
          <Group title="Resolved" ids={resolved} tone="satisfied" Icon={CheckCircle2} />
          <Group title="New" ids={added} tone="blocker" Icon={CircleAlert} />
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-text-3">
            <span><span className="tnum">{unchanged.length}</span> unchanged</span>
            <Link to={`/r/${releaseId}/findings`} className="inline-flex items-center gap-1 hover:text-text">All findings <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </div>
      )}
    </Card>
  );
}
