import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { TooltipProvider } from "@/components/tooltip";
import { FindingPage } from "@/features/finding";
import { EvidencePage } from "@/features/evidence";
import { ActivityPanel } from "@/features/activity";
import { FixPlanPage } from "@/features/fixplan";
import { ReleasesPage } from "@/features/releases";
import { ProfilePage } from "@/features/profile";
import { OverviewPage } from "@/features/overview";
import { FindingsListPage } from "@/features/findings";
import { sortReleases, useReleases } from "@/lib/queries";
import { Header } from "./Header";
import { TokenPrompt } from "./TokenPrompt";
import { registerFeatures } from "./registerFeatures";

registerFeatures();
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

function Shell() {
  return (
    <div className="min-h-full">
      <Header />
      <main><Outlet /></main>
      <ActivityPanel />
      <TokenPrompt />
    </div>
  );
}

/** Default landing: the earliest release (v0.9.0 in the demo). */
function Home() {
  const { data } = useReleases();
  if (!data) return null;
  const first = sortReleases(data)[0];
  return first ? <Navigate to={`/r/${first.release.id}/overview`} replace /> : null;
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="releases" element={<ReleasesPage />} />
              <Route path="r/:release">
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="evidence" element={<EvidencePage />} />
                <Route path="evidence/:artifactId" element={<EvidencePage />} />
                <Route path="findings" element={<FindingsListPage />} />
                <Route path="findings/:findingId" element={<FindingPage />} />
                <Route path="fix-plan" element={<FixPlanPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
