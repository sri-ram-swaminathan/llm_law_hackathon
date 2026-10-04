import { Loader2, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { describeError, FIXTURES } from "@/api/client";
import { Button } from "@/components/button";
import { Banner } from "@/components/feedback";
import { useLatestRun } from "@/features/activity";
import { fmtDateTime } from "@/lib/format";
import { useDemo, useResetDemo, useStartDemo } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { registerSlot, type SlotProps } from "@/lib/slots";

/**
 * Start demo (DESIGN §4.12) on the workspace/product home: checks out the flawed v0.9.0 and runs the
 * analyzer live, then opens its Summary with the live run strip. Shown only when `GET /api/demo → enabled`.
 */
export function DemoStart({ productId }: SlotProps["home.demo"]) {
  const demo = useDemo();
  const start = useStartDemo();
  const navigate = useNavigate();
  if (!demo.data?.enabled) return null;
  const snap = demo.data.snapshot;
  const liveV = snap?.live_target ?? "0.9.0";
  const target = snap?.releases.find((r) => r.version === liveV);
  const repo = target?.repo ?? "RomanGrebnev/FinTechProto";
  const ref = target?.ref ?? `v${liveV}`;
  const short = target?.commit?.slice(0, 7);
  const go = () =>
    start.mutate(undefined, {
      onSuccess: (out) => {
        const v = out.release.version;
        navigate(FIXTURES ? `${paths.activity(productId, v, { run: out.run_id })}&replay=1` : paths.summary(productId, v));
      },
    });
  return (
    <div className="rounded-md border bg-surface p-4" data-testid="demo-start">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-text">Live analysis of Wealthpilot v{liveV}</div>
          <p className="mt-0.5 text-sm text-text-2" data-testid="demo-provenance">
            Real code from{" "}
            <a href={`https://github.com/${repo}/tree/${ref}`} target="_blank" rel="noreferrer" className="font-mono text-code text-accent hover:underline">
              {repo.split("/").pop()} tag {ref}{short ? ` @ ${short}` : ""}
            </a>
            {" "}· the AI compliance officer reads its documents and code against EU and French law.
          </p>
          {snap && (
            <p className="mt-1 text-xs text-text-3">
              Recorded snapshot {fmtDateTime(snap.captured_at)} · model {snap.model}{FIXTURES ? " · Simulated (sample data)" : ""}
            </p>
          )}
        </div>
        <Button variant="primary" size="md" onClick={go} disabled={start.isPending} data-testid="start-demo">
          {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start demo
        </Button>
      </div>
      {start.isError && <p role="alert" className="mt-2 text-sm text-blocker-fg">{describeError(start.error)}</p>}
      <ResetDemo productId={productId} />
    </div>
  );
}

export function ResetDemo({ productId, then }: { productId: string; then?: "product" | "summary" }) {
  const reset = useResetDemo();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const run = () => reset.mutate(undefined, {
    onSuccess: () => { setConfirm(false); navigate(then === "summary" ? paths.summary(productId, "0.9.0") : paths.product(productId)); },
  });
  return (
    <div className="mt-2 text-xs">
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-text-2 underline-offset-2 hover:text-text hover:underline" data-testid="reset-demo">
          <RotateCcw className="h-3 w-3" /> Reset demo to recorded snapshot
        </button>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2 text-text-2" data-testid="reset-confirm">
          This replaces all Wealthpilot releases and reviews with the snapshot.
          <button type="button" onClick={run} disabled={reset.isPending} data-testid="reset-confirm-go" className="inline-flex items-center gap-1 font-medium text-blocker-fg hover:underline">{reset.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Yes, reset</button>
          <button type="button" onClick={() => setConfirm(false)} className="hover:text-text">Cancel</button>
          {reset.isError && <span role="alert" className="text-blocker-fg">{describeError(reset.error)}</span>}
        </span>
      )}
    </div>
  );
}

/** Fallback (DESIGN §4.12): a failed live run offers the recorded one instead. */
export function RunFailedBanner({ releaseId, productId }: SlotProps["release.banner"]) {
  const run = useLatestRun(releaseId);
  const demo = useDemo();
  const reset = useResetDemo();
  const navigate = useNavigate();
  if (run.data?.status !== "failed") return null;
  return (
    <div className="mx-auto max-w-[1360px] px-4 pt-3 sm:px-6">
      <Banner tone="error" title="Run failed" data-testid="run-failed"
        action={demo.data?.enabled ? (
          <Button size="sm" onClick={() => reset.mutate(undefined, { onSuccess: () => navigate(paths.summary(productId, "0.9.0")) })} disabled={reset.isPending} data-testid="show-recorded">
            {reset.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Show the recorded run
          </Button>
        ) : undefined}>
        The live assessment stopped before it finished (model or network error).{demo.data?.enabled ? " You can show the recorded run of the same release instead." : " Re-run the assessment to try again."}
      </Banner>
    </div>
  );
}

export function register(): void {
  registerSlot("home.demo", DemoStart, { id: "demo-start" });
  registerSlot("release.banner", RunFailedBanner, { id: "run-failed", order: 1 });
}
