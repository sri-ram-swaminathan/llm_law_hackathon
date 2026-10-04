import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { EmptyState, ErrorBanner } from "@/components/feedback";
import { GateChip } from "@/components/tags";
import { fmtDateTime, plural, versionLabel } from "@/lib/format";
import { useProduct, useReadiness, useReleasesSorted } from "@/lib/queries";
import { ORG, paths } from "@/lib/routes";
import { Slot } from "@/lib/slots";
import { AI_LABEL } from "@/lib/status";

/**
 * Workspace home `/` — T27 STUB (minimal, for the shell). T28 replaces this file (DESIGN §4.1).
 * Contract kept for the e2e: `[data-testid=org-name]`, `[data-testid=product-card]`, `[data-testid=open-product]`.
 */
export default function WorkspacePage() {
  const product = useProduct();
  const releases = useReleasesSorted();
  const latest = releases.data?.[0];
  const readiness = useReadiness(latest?.release.id);
  const p = product.data?.product;
  const orgName = product.data?.organization?.name ?? ORG.name;
  const pid = p?.id ?? "wealthpilot";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md border bg-surface text-text-2"><Building2 className="h-4 w-4" /></span>
        <h1 className="text-xl text-text" data-testid="org-name">{orgName}</h1>
        <span className="ml-auto text-xs text-text-3">Organization</span>
      </div>

      {product.isError && <ErrorBanner className="mt-6" error={product.error} onRetry={() => product.refetch()} />}

      <section className="mt-6 rounded-md border bg-surface p-5" data-testid="product-card">
        {!p ? (
          <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg text-text">{p.name}</h2>
              <span className="text-sm text-text-2">
                {product.data?.profile.stage.replace(/^./, (c) => c.toUpperCase())} · {product.data?.profile.jurisdictions.join(", ")}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-2">{p.description}</p>
          </>
        )}
        {releases.data && !latest && (
          <EmptyState className="mt-4" title="No releases yet">Upload your first bundle on the product page.</EmptyState>
        )}
        {latest && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-3">Latest release</span>
            <span className="font-mono text-code text-text">{versionLabel(latest.release.version)}</span>
            {readiness.data && <GateChip gate={readiness.data.gate} label={readiness.data.gate_label} />}
            {readiness.data && readiness.data.blockers?.length ? <span className="text-text-2">{readiness.data.blockers.length} blocking</span> : null}
            <span className="text-text-3">· {fmtDateTime(latest.release.created_at)} · {plural(releases.data!.length, "release")}</span>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Slot name="home.demo" props={{ productId: pid }} />
          <Button asChild variant="primary" data-testid="open-product">
            <Link to={paths.product(pid)}>Open product <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </section>
      <p className="mt-3 text-xs text-text-3">{AI_LABEL}</p>
    </div>
  );
}
