import type { ReactNode } from "react";
import { hrefFor, type Route } from "../lib/router";
import { useSettings } from "../lib/settingsContext";
import { StatusLabel } from "./Badges";
import { WeightsPanel } from "./WeightsPanel";

const NAV = [
  { key: "scorer", label: "Overview / Claim Scorer", href: hrefFor.scorer },
  { key: "workload", label: "Workload Board", href: hrefFor.workload },
  { key: "insights", label: "Cost & Risk Insights", href: hrefFor.insights },
  { key: "settings", label: "Model Settings", href: hrefFor.settings },
] as const;

function activeKey(route: Route): string {
  return route.page === "claim" ? "scorer" : route.page;
}

export function AppShell({ route, title, children }: { route: Route; title: string; children: ReactNode }) {
  const active = activeKey(route);
  const { previewWeights, panelOpen, setPanelOpen } = useSettings();
  const showPanelToggle = route.page !== "settings";
  const panelVisible = panelOpen && showPanelToggle;
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <aside className="bg-navy-700 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 px-5 py-4 md:py-5">
          <span className="text-base font-semibold tracking-tight">Penser</span>
          <span className="text-navy-300" aria-hidden="true">|</span>
          <span className="text-sm font-medium text-navy-100">Claims Intelligence</span>
        </div>
        <nav aria-label="Main" className="px-2 pb-3 md:pb-0">
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <a
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "block rounded px-3 py-2 text-sm focus-visible:ring-white focus-visible:ring-offset-navy-700",
                      isActive ? "bg-navy-800 font-semibold text-white" : "text-navy-100 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold text-charcoal">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {previewWeights && (
              <StatusLabel tone="info" testId="preview-banner" title="Unsaved weights are previewed on every dashboard. Nothing is saved until you confirm Save.">
                Weights preview · not saved
              </StatusLabel>
            )}
            <StatusLabel title="Preliminary baseline estimates from early data, not validated production predictions">
              Baseline · Early Data
            </StatusLabel>
            {showPanelToggle && (
              <button type="button" className="btn-secondary py-1 text-xs" aria-expanded={panelVisible} aria-controls="weights-panel"
                onClick={() => setPanelOpen(!panelOpen)}>
                Model weights
              </button>
            )}
          </div>
        </header>
        <div className="flex">
          <main id="main" className="mx-auto min-w-0 max-w-7xl flex-1 px-4 py-5 sm:px-6">
            {children}
          </main>
          {panelVisible && (
            <aside id="weights-panel" aria-label="Model weights"
              className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-tremor-dropdown lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:shadow-none">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-charcoal">Model weights</h2>
                <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setPanelOpen(false)}>Close</button>
              </div>
              <WeightsPanel />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
