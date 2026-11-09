import { useCallback, useRef, useState } from "react";
import { AdjusterDetail } from "../components/AdjusterDetail";
import { InfoIcon } from "../components/Icons";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { SlideOverPanel } from "../components/SlideOverPanel";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { WorkloadTable } from "../components/WorkloadTable";
import { previewQuery, api } from "../services/api";
import { useDebounced } from "../lib/useDebounced";
import { useApi } from "../lib/useApi";
import { useSettings } from "../lib/settingsContext";
import { rowFor, simulateTransfer, sortRows, type Transfer, type WorkloadSortKey } from "../lib/workload";

const n0 = (v: number) => Math.round(v).toLocaleString("en-US");

export function WorkloadPage() {
  const { previewWeights, dataVersion, panelOpen } = useSettings();
  const preview = useDebounced(previewWeights, 250);
  const key = `${previewQuery(preview)}#${dataVersion}`;
  const workload = useApi((s) => api.getWorkload(preview, s), key);
  const filters = useApi((s) => api.getFilters(s), "filters");

  const [sortKey, setSortKey] = useState<WorkloadSortKey>("total_complexity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // undefined = panel closed; null = the Unassigned group.
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  // A simulation belongs to the data it was made from; a new preview or save discards it.
  const [sim, setSim] = useState<{ key: string; move: Transfer } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const select = useCallback((adjuster: string | null, el: HTMLElement) => {
    trigger.current = el;
    setSelected(adjuster);
  }, []);
  const closePanel = useCallback(() => {
    setSelected(undefined);
    trigger.current?.focus();
  }, []);

  if (workload.loading && !workload.data) return <LoadingState label="Loading workload…" />;
  if (workload.error) return <ErrorState error={workload.error} onRetry={workload.reload} />;
  const data = workload.data;
  if (!data) return null;

  const move = sim && sim.key === key ? sim.move : null;
  const base = data.adjusters;
  const result = move ? simulateTransfer(base, move, data.thresholds) : { rows: base, teamMedian: data.team_median_total_complexity };
  const rows = result.rows;
  const assigned = rows.filter((r) => !r.unassigned);
  const unassigned = rows.filter((r) => r.unassigned);
  const maxTotal = Math.max(0, ...rows.map((r) => r.total_complexity));
  const changed = new Set<string | null>(move ? [move.from, move.to] : []);
  const t = data.thresholds;

  const onSort = (k: WorkloadSortKey) => {
    if (k === sortKey) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir(k === "adjuster" ? "asc" : "desc"); }
  };
  const destinations = filters.data?.adjusters ?? assigned.map((r) => r.adjuster!).sort();
  const tableProps = { maxTotal, teamMedian: result.teamMedian, sortKey, sortDir, onSort, selected, onSelect: select, changed };

  return (
    <div className="space-y-4">
      {move && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm shadow-tremor-card">
          <p role="status" className="flex items-center gap-2 text-slate-600">
            <InfoIcon className="h-4 w-4 shrink-0 text-navy-500" />
            <span><span className="font-medium text-charcoal">Simulation only</span> · totals include a simulated move of {move.claimNumber}. No assignment has changed.</span>
          </p>
          <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setSim(null)}>Reset simulation</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Active claims" testId="m-active" value={n0(rows.reduce((s, r) => s + r.assigned_claims, 0))}
          detail={data.statuses_included.join(" + ")} />
        <MetricCard label="Adjusters with active claims" testId="m-adjusters" value={n0(assigned.filter((r) => r.assigned_claims > 0).length)} />
        <MetricCard label="Total complexity" testId="m-total" value={n0(rows.reduce((s, r) => s + r.total_complexity, 0))}
          detail={data.preview_weights ? "Preview weights · not saved" : "Sum of claim complexity scores"} />
        <MetricCard label="Adjusters with warnings" testId="m-warnings" value={n0(assigned.filter((r) => r.workload_warning).length)}
          detail="Preliminary thresholds"
          info="Caseload indicators from placeholder thresholds pending Penser approval. They describe how work is distributed, not individual performance." />
      </div>

      <SectionCard title="Adjuster workload" flush
        aside={<>High ≥ {t.high_complexity_threshold.value} · warn above {t.warning_load_ratio.value}× team median ({n0(result.teamMedian)}) or {t.warning_high_claims.value}+ high · thresholds preliminary, {t.high_complexity_threshold.approved_by}</>}>
        {assigned.length === 0 ? <EmptyState title="No adjusters with active claims" /> : (
          <WorkloadTable rows={sortRows(assigned, sortKey, sortDir)} {...tableProps} />
        )}
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          Select an adjuster to see their claims and simulate a reassignment. Warnings describe caseload, not performance.
        </p>
      </SectionCard>

      {unassigned.length > 0 && (
        <SectionCard title="Unassigned" flush aside="Not included in the team median or warnings">
          <WorkloadTable rows={unassigned} {...tableProps} />
        </SectionCard>
      )}

      {selected !== undefined && (
        <SlideOverPanel eyebrow={selected === null ? "Claims without an adjuster" : "Adjuster"} title={selected ?? "Unassigned"}
          onClose={closePanel} besideWeightsPanel={panelOpen}>
          <AdjusterDetail
            key={`${selected ?? "\u0000"}`}
            adjuster={selected}
            row={rowFor(base, selected)}
            preview={preview}
            highThreshold={t.high_complexity_threshold.value}
            destinations={destinations}
            before={base}
            after={move ? rows : null}
            simulation={move}
            onSimulate={(m) => setSim({ key, move: m })}
            onReset={() => setSim(null)}
            dataVersion={dataVersion}
          />
        </SlideOverPanel>
      )}
    </div>
  );
}
