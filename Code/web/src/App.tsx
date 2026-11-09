import { lazy, Suspense, useState } from "react";
import { AppShell } from "./components/AppShell";
import { SettingsProvider } from "./components/SettingsProvider";
import { DEFAULT_QUERY } from "./lib/config";
import { useRoute } from "./lib/router";
import { ClaimDetailPage } from "./pages/ClaimDetailPage";
import { ClaimScorerPage } from "./pages/ClaimScorerPage";
import { LoadingState } from "./components/StateViews";
import { WorkloadPage } from "./pages/WorkloadPage";
import { ModelSettingsPage } from "./pages/ModelSettingsPage";
import type { ClaimQuery } from "./types/api";

// Charts are only downloaded when the Insights page is opened.
const InsightsPage = lazy(() => import("./pages/InsightsPage"));

export default function App() {
  return (
    <SettingsProvider>
      <Routes />
    </SettingsProvider>
  );
}

function Routes() {
  const route = useRoute();
  // Kept here so filters, sort and page survive opening a claim and coming back.
  const [query, setQuery] = useState<ClaimQuery>(DEFAULT_QUERY);

  switch (route.page) {
    case "claim":
      return (
        <AppShell route={route} title="Claim detail">
          <ClaimDetailPage key={route.claimNumber} claimNumber={route.claimNumber} />
        </AppShell>
      );
    case "workload":
      return (
        <AppShell route={route} title="Workload Board">
          <WorkloadPage />
        </AppShell>
      );
    case "insights":
      return (
        <AppShell route={route} title="Cost & Risk Insights">
          <Suspense fallback={<LoadingState label="Loading insights…" />}>
            <InsightsPage />
          </Suspense>
        </AppShell>
      );
    case "settings":
      return (
        <AppShell route={route} title="Model Settings">
          <ModelSettingsPage />
        </AppShell>
      );
    default:
      return (
        <AppShell route={route} title="Claim Scorer">
          <ClaimScorerPage query={query} setQuery={setQuery} />
        </AppShell>
      );
  }
}
