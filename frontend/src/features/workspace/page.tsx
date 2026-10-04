import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/card";
import { EmptyState, ErrorBanner } from "@/components/feedback";
import { GateChip } from "@/components/tags";
import { useReport } from "@/features/summary/useReport";
import { fmtDateTime, plural, versionLabel } from "@/lib/format";
import { useProduct, useReleasesSorted } from "@/lib/queries";
import { DEFAULT_PRODUCT_ID, ORG, paths } from "@/lib/routes";
import { Slot } from "@/lib/slots";
import { AI_LABEL } from "@/lib/status";

const stageLabel = (s?: string) => (s ? s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : "");

/** Workspace home `/` (DESIGN §4.1): the organisation and its products, the explicit entry point. */
export default function WorkspacePage() {
  const product = useProduct();
  const releases = useReleasesSorted();
  const latest = releases.data?.[0];
  const rep = useReport(latest);
  const r = rep.readiness.data;
  const p = product.data?.product;
  const orgName = product.data?.organization?.name ?? ORG.name;
  const pid = p?.id ?? DEFAULT_PRODUCT_ID;
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border bg-surface text-text-2"><Building2 className="h-4 w-4" /></span>
        <div>
          <div className="text-xs uppercase tracking-[0.06em] text-text-3">Organization</div>
          <h1 className="text-2xl text-text" data-testid="org-name">{orgName}</h1>
        </div>
      </div>

      {product.isError && <ErrorBanner className="mt-6" error={product.error} onRetry={() => product.refetch()} />}

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="mt-8 overflow-hidden rounded-lg border bg-surface" data-testid="product-card"
      >
        <div className="p-5 sm:p-6">
          {!p ? (
            <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /></div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-xl text-text">{p.name}</h2>
                <span className="rounded-sm border px-1.5 py-0.5 text-xs text-text-2" data-testid="product-stage">
                  {stageLabel(product.data?.profile.stage)} · {product.data?.profile.jurisdictions.join(", ")}
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-text-2">{p.description}</p>
            </>
          )}
          {releases.data && !latest && (
            <EmptyState className="mt-5" title="No releases yet">Upload your first bundle on the product page.</EmptyState>
          )}
        </div>
        {latest && (
          <div className="border-t bg-surface-2/40 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-text-3">Latest release</span>
              <Link to={paths.summary(pid, latest.release.version)} className="font-mono text-code font-medium text-text hover:text-accent">
                {versionLabel(latest.release.version)}
              </Link>
              {r ? <GateChip gate={r.gate} label={r.gate_label} aiOnly={r.counsel_reviewed.reviewed === 0} /> : latest.latest_assessment ? <Skeleton className="h-5 w-20 rounded-full" /> : <span className="text-text-3">Not assessed</span>}
              {r && (r.blockers?.length ?? 0) > 0 && <span className="text-text" data-testid="blocking-count">{r.blockers!.length} blocking</span>}
              <span className="text-text-3">{fmtDateTime(latest.latest_assessment?.finished_at ?? latest.release.created_at)}</span>
            </div>
            <p className="mt-1.5 text-sm text-text-2">
              {plural(releases.data!.length, "release")}
              {rep.findings.data && <> · last checked {plural(rep.checked.documents, "document")} + {plural(rep.checked.codeFiles, "code file")} against {plural(rep.checked.provisions, "provision")}</>}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3 sm:px-6">
          <Slot name="home.demo" props={{ productId: pid }} />
          <Button asChild variant="primary" size="md" data-testid="open-product">
            <Link to={paths.product(pid)}>Open product <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </motion.section>
      <p className="mt-3 text-xs text-text-3">{AI_LABEL}</p>
    </div>
  );
}
