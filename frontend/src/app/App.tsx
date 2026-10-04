import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams, useSearchParams } from "react-router";
import { authStore, FIXTURES, needsToken } from "@/api/client";
import { NotFound } from "@/components/feedback";
import { TooltipProvider } from "@/components/tooltip";
import { useMode } from "@/lib/mode";
import { useProduct } from "@/lib/queries";
import { DEFAULT_PRODUCT_ID, paths } from "@/lib/routes";
import WorkspacePage from "@/features/workspace/page";
import ProductPage from "@/features/product/page";
import ProfilePage from "@/features/profile/page";
import SummaryPage from "@/features/summary/page";
import RisksPage from "@/features/risks/page";
import CheckPage from "@/features/check/page";
import DocumentsPage from "@/features/documents/page";
import CodePage from "@/features/code/page";
import FixPlanPage from "@/features/fixplan/page";
import ActivityPage from "@/features/activity/page";
import ReviewPage from "@/features/review/page";
import { LegacyRedirects } from "./legacy";
import { CounselOnly, ReleaseLayout } from "./ReleaseLayout";
import { TokenPrompt } from "./TokenPrompt";
import { TopBar } from "./TopBar";
import { registerFeatures } from "./registerFeatures";

registerFeatures();
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

/** Fixtures mode: a slim band across the top; every external link is suppressed elsewhere. */
function SampleBanner() {
  if (!FIXTURES) return null;
  return (
    <div data-testid="sample-banner" className="border-b bg-surface-2 px-4 py-1 text-center text-xs text-text-2 sm:px-6">
      <span className="font-medium text-text">Sample data</span>: fixtures, not a real run
    </div>
  );
}

/** Mirrors the mode to `?mode=counsel` so a shared link opens in review (lib/mode.ts reads it on load). */
function useModeInUrl() {
  const mode = useMode();
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    const want = mode === "counsel" ? "counsel" : null;
    if (sp.get("mode") === want) return;
    const next = new URLSearchParams(sp);
    if (want) next.set("mode", want);
    else next.delete("mode");
    setSp(next, { replace: true });
  }, [mode, sp, setSp]);
}

function Shell() {
  useSyncExternalStore(authStore.subscribe, authStore.version);
  useModeInUrl();
  const locked = needsToken(); // nothing fetches before the token exists
  return (
    <div className="flex min-h-full flex-col">
      <SampleBanner />
      <TopBar minimal={locked} />
      <main className="flex-1">{locked ? null : <Outlet />}</main>
      <TokenPrompt />
    </div>
  );
}

/** `/p/:productId/*`: unknown product → NotFound. */
function ProductScope() {
  const { productId = "" } = useParams();
  const product = useProduct();
  const known = product.data ? product.data.product.id : DEFAULT_PRODUCT_ID;
  if (productId !== known) return <NotFound title="This product doesn't exist" />;
  return <Outlet />;
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<WorkspacePage />} />
              <Route path="p/:productId" element={<ProductScope />}>
                <Route index element={<ProductPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="v/:version" element={<ReleaseLayout />}>
                  <Route index element={<Navigate to="summary" replace />} />
                  <Route path="summary" element={<SummaryPage />} />
                  <Route path="risks" element={<RisksPage />} />
                  <Route path="risks/:findingId" element={<CheckPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="documents/:artifactId" element={<DocumentsPage />} />
                  <Route path="code" element={<CodePage />} />
                  <Route path="fix-plan" element={<FixPlanPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="review" element={<CounselOnly><ReviewPage /></CounselOnly>} />
                  <Route path="review/:findingId" element={<CounselOnly><ReviewPage /></CounselOnly>} />
                  <Route path="*" element={<NotFound title="This section doesn't exist" />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
              {/* legacy URLs (DESIGN §2) */}
              <Route path="profile" element={<LegacyRedirects />} />
              <Route path="releases" element={<LegacyRedirects />} />
              <Route path="r/:release/*" element={<LegacyRedirects />} />
              <Route path="*" element={<NotFound backTo={paths.home()} />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
