import { useState } from "react";
import { Link, useMatch } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Play } from "lucide-react";
import { api, FIXTURES } from "@/api/client";
import { Button } from "@/components/button";
import { Menu } from "@/components/popover-menu";
import { Slot } from "@/lib/slots";
import { openActivity } from "@/lib/activityStore";
import { useReleases } from "@/lib/queries";
import { ReleaseSwitcher } from "./ReleaseSwitcher";

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-[-0.01em]" aria-label="CCOmmit home">
      <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-accent text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span>CCO<span className="text-text-2">mmit</span></span>
    </Link>
  );
}

function StagePill() {
  const items = [
    { k: "pre", label: "Pre-launch", soon: false },
    { k: "op", label: "Operating", soon: true },
    { k: "sc", label: "Scaling", soon: true },
  ];
  return (
    <Menu.Root>
      <Menu.Trigger data-testid="stage-pill" className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-surface px-2.5 text-xs text-text-2 transition-colors duration-fast hover:bg-surface-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Pre-launch <ChevronDown className="h-3 w-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className="z-50 min-w-44 rounded-md border bg-surface p-1 shadow-overlay">
          {items.map((i) => (
            <Menu.Item key={i.k} disabled={i.soon} className="flex cursor-default items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:text-text-3 data-[highlighted]:bg-surface-2">
              {i.label}
              {i.soon ? <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-3">soon</span> : <Check className="h-3.5 w-3.5 text-accent" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function RunButton({ release }: { release: string | undefined }) {
  const qc = useQueryClient();
  const { data } = useReleases();
  const [err, setErr] = useState(false);
  const run = useMutation({
    mutationFn: async () => {
      const id = release ?? data?.[0]?.release.id;
      if (!id) return null;
      const created = await api.startAssessment(id);
      return created ?? null;
    },
    onSuccess: (created) => {
      setErr(false);
      const fallback = data?.find((r) => r.release.id === release)?.latest_assessment?.run_id ?? null;
      const runId = (created as { run_id?: string } | null)?.run_id ?? fallback;
      openActivity(runId ?? null); // fixtures mode: replays the recorded run (no-op for the API)
      if (!FIXTURES) qc.invalidateQueries();
    },
    onError: () => setErr(true),
  });
  return (
    <Button variant="primary" onClick={() => run.mutate()} disabled={run.isPending} data-testid="run-assessment" title={err ? "Could not start the assessment" : undefined}>
      {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
      Run assessment
    </Button>
  );
}

export function Header() {
  const m = useMatch("/r/:release/*");
  const release = m?.params.release;
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-surface/85 px-4 backdrop-blur sm:px-6">
      <Wordmark />
      <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
      <div className="hidden min-w-0 sm:block"><ReleaseSwitcher current={release} /></div>
      <div className="hidden md:block"><StagePill /></div>
      <nav className="ml-2 hidden items-center gap-1 text-sm text-text-2 lg:flex" aria-label="Sections">
        {release && [["overview", "Overview"], ["findings", "Findings"], ["evidence", "Evidence"]].map(([p, l]) => (
          <NavLink key={p} to={`/r/${release}/${p}`} label={l} />
        ))}
        <NavLink to="/releases" label="Releases" />
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <Slot name="header.persona" />
        <RunButton release={release} />
      </div>
    </header>
  );
}

import { NavLink as RRLink } from "react-router";
function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <RRLink to={to} className={({ isActive }) => `rounded-sm px-2 py-1 transition-colors duration-fast hover:text-text ${isActive ? "text-text" : ""}`}>
      {label}
    </RRLink>
  );
}
