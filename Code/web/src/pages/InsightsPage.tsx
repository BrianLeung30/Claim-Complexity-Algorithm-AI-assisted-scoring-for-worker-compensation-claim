import { useState } from "react";
import { StatusLabel } from "../components/Badges";
import { BarChart, CHART_COLORS, LineChart } from "../components/charts";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { SegmentedControl } from "../components/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/tremor";
import {
  byInjuryYear, claimsWithoutYear, formatCompactCurrency, groupLabel, hasNoFinancials, inflationTrend, inYearRange,
  recentYearRange, totals, type YearGroup,
} from "../lib/analytics";
import { RECENT_INJURY_YEARS } from "../lib/config";
import { formatCurrency, formatFraction, MISSING } from "../lib/format";
import { useSettings } from "../lib/settingsContext";
import { useApi } from "../lib/useApi";
import { useDebounced } from "../lib/useDebounced";
import { api, previewQuery } from "../services/api";
import type { AnalyticsGroup, GroupBy } from "../types/api";

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "employer", label: "Employer" },
  { value: "tier_2", label: "Tier 2" },
  { value: "loss_cause", label: "Loss cause" },
  { value: "injury_year", label: "Injury year" },
];
const TOP_N = 12;
const ILLUSTRATIVE_MAX = 0.1;

/** Series names, shared by every chart so each measure keeps one name and one colour. */
const SERIES = {
  predicted: "Predicted median (sum)",
  incurred: "Incurred to date",
  final: "Final cost (closed)",
  complexity: "Average complexity",
} as const;

/** Short definitions, used for tooltips and column titles. */
const DEFINITIONS = {
  predicted: "Sum of each claim's baseline median cost estimate. A median is a typical value, so summed medians usually sit well below recorded totals when a few claims are very costly.",
  incurred: "Recorded paid amounts plus outstanding reserves, for claims with a financial record. Not final for open claims.",
  final: "Total incurred on closed claims with a financial record. Final cost is not known for open claims.",
} as const;

type YearView = "recent" | "all";
const YEAR_VIEWS: { value: YearView; label: string }[] = [
  { value: "recent", label: "Recent years" },
  { value: "all", label: "All years" },
];

type ColKey = "group" | "claim_count" | "average_complexity" | "total_predicted_median_cost" | "total_incurred_to_date"
  | "claims_with_financials" | "total_final_cost" | "closed_claims_with_final_cost";
const COLUMNS: { key: ColKey; label: string; money?: boolean; right?: boolean; title?: string }[] = [
  { key: "group", label: "Group" },
  { key: "claim_count", label: "Claims", right: true },
  { key: "average_complexity", label: "Avg complexity", right: true },
  { key: "total_predicted_median_cost", label: SERIES.predicted, money: true, right: true, title: DEFINITIONS.predicted },
  { key: "total_incurred_to_date", label: SERIES.incurred, money: true, right: true, title: DEFINITIONS.incurred },
  { key: "claims_with_financials", label: "With financials", right: true, title: "Claims with a financial record" },
  { key: "total_final_cost", label: SERIES.final, money: true, right: true, title: DEFINITIONS.final },
  { key: "closed_claims_with_final_cost", label: "Closed", right: true, title: "Closed claims with a financial record" },
];

function sortGroups(groups: AnalyticsGroup[], key: ColKey, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1;
  return [...groups].sort((a, b) => {
    if (key === "group") return groupLabel(a.group).localeCompare(groupLabel(b.group), undefined, { numeric: true }) * sign;
    const x = a[key], y = b[key];
    if (x === null && y === null) return 0;
    if (x === null) return 1;                     // missing values last in either direction
    if (y === null) return -1;
    return (x - y) * sign;
  });
}

const cell = (v: number | null, money?: boolean, digits = 0) =>
  v === null ? MISSING : money ? formatCurrency(v) : v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const n = (v: number) => v.toLocaleString("en-US");
const span = (gs: YearGroup[]) => (gs.length ? `${gs[0]!.group}–${gs[gs.length - 1]!.group}` : MISSING);

export default function InsightsPage() {
  const { previewWeights, dataVersion, saved } = useSettings();
  const preview = useDebounced(previewWeights, 250);
  const pk = `${previewQuery(preview)}#${dataVersion}`;
  const [groupBy, setGroupBy] = useState<GroupBy>("employer");
  const [sortKey, setSortKey] = useState<ColKey>("total_predicted_median_cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [rate, setRate] = useState(0.03);
  const [yearView, setYearView] = useState<YearView>("recent");

  const grouped = useApi((s) => api.getAnalytics(groupBy, preview, s), `${groupBy}#${pk}`);
  const years = useApi((s) => api.getAnalytics("injury_year", preview, s), `injury_year#${pk}`);

  const label = GROUPS.find((g) => g.value === groupBy)!.label;
  const onSort = (k: ColKey) => {
    if (k === sortKey) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir(k === "group" ? "asc" : "desc"); }
  };

  const selector = <SegmentedControl label="Group by" options={GROUPS} value={groupBy} onChange={setGroupBy} />;

  if (grouped.loading && !grouped.data) return <div className="space-y-4">{selector}<LoadingState label="Loading insights…" /></div>;
  if (grouped.error) return <div className="space-y-4">{selector}<ErrorState error={grouped.error} onRetry={grouped.reload} /></div>;
  const data = grouped.data;
  if (!data) return null;
  if (data.groups.length === 0) return <div className="space-y-4">{selector}<EmptyState title="No claims to analyse" /></div>;

  const t = totals(data.groups);
  const top = sortGroups(data.groups, "total_predicted_median_cost", "desc").slice(0, TOP_N);
  const costData = top.map((g) => ({
    group: groupLabel(g.group),
    [SERIES.predicted]: g.total_predicted_median_cost,
    [SERIES.incurred]: g.total_incurred_to_date,
  }));
  const complexityData = top.map((g) => ({ group: groupLabel(g.group), [SERIES.complexity]: g.average_complexity }));
  const shown = data.groups.length > TOP_N ? `Top ${TOP_N} of ${data.groups.length} by predicted cost` : `${data.groups.length} groups`;

  // Injury-year trends open on the most recent years; "All years" keeps every older year.
  // Groups are only selected, never altered: missing money stays missing (a gap, not $0).
  const yearGroups = years.data?.groups ?? [];
  const allYears = byInjuryYear(yearGroups);
  const recent = recentYearRange(allYears.map((g) => g.group), RECENT_INJURY_YEARS);
  const yearsShown = inYearRange(allYears, yearView === "recent" ? recent : null);
  const noFinancialYears = yearsShown.filter(hasNoFinancials).length;
  const withoutYear = claimsWithoutYear(yearGroups);
  const asOf = new Date().getUTCFullYear();
  const illustrative = `Illustrative at ${formatFraction(rate)}`;
  const trendData = yearsShown.map((g) => ({
    year: String(g.group),
    [SERIES.incurred]: g.total_incurred_to_date,
    [SERIES.final]: g.total_final_cost,
    [SERIES.predicted]: g.total_predicted_median_cost,
  }));
  const inflationData = inflationTrend(yearsShown, rate, asOf).map((r) => ({
    year: String(r.year),
    [SERIES.incurred]: r.original,
    [illustrative]: r.adjusted,
  }));
  const yearsPending = years.error ? null
    : !years.data ? <LoadingState label="Loading injury years…" />
    : yearsShown.length === 0 ? <EmptyState title="No injury years recorded" /> : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {selector}
        {data.preview_weights && <StatusLabel tone="info">Complexity uses preview weights · costs unchanged</StatusLabel>}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Claims" testId="i-claims" value={n(t.claims)} detail="All statuses" />
          <MetricCard label="Average complexity" testId="i-complexity" value={t.averageComplexity === null ? MISSING : t.averageComplexity.toFixed(1)}
            detail={data.preview_weights ? "Preview weights · 0–100" : "Baseline score · 0–100"} />
          <MetricCard label={SERIES.predicted} testId="i-predicted" value={formatCompactCurrency(t.predictedMedian)}
            exact={formatCurrency(t.predictedMedian)} detail={<>{formatCurrency(t.predictedMedian)} · baseline estimates</>}
            info={DEFINITIONS.predicted} />
          <MetricCard label={SERIES.incurred} testId="i-incurred" value={formatCompactCurrency(t.incurredToDate)}
            exact={formatCurrency(t.incurredToDate)} detail={`Recorded, incl. reserves · ${n(t.claimsWithFinancials)} of ${n(t.claims)} claims`}
            info={DEFINITIONS.incurred} />
          <MetricCard label={SERIES.final} testId="i-final" value={formatCompactCurrency(t.finalCost)}
            exact={formatCurrency(t.finalCost)} detail={`${n(t.closedWithFinalCost)} closed claims with financials`}
            info={DEFINITIONS.final} />
        </div>
        <p className="text-xs text-slate-500">
          Predicted and recorded totals measure different things, so comparing them is not a test of model accuracy.
        </p>
        {saved && saved.version > 1 && (
          <p className="text-xs text-slate-500" data-testid="mixed-versions">
            Settings v{saved.version}: saves recalculate only open and reopened claims, so closed claims may still carry
            earlier estimates. Averages and totals can mix settings versions.
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={`Cost by ${label.toLowerCase()}`} aside={shown}>
          <BarChart data={costData} index="group" categories={[SERIES.predicted, SERIES.incurred]}
            colors={[CHART_COLORS.estimate, CHART_COLORS.incurred]} layout="vertical" yAxisWidth={140}
            valueFormatter={(v: number) => formatCompactCurrency(v)} className="h-96" />
        </SectionCard>
        <SectionCard title={`Complexity by ${label.toLowerCase()}`} aside={`${shown} · separate from cost`}>
          <BarChart data={complexityData} index="group" categories={[SERIES.complexity]} colors={[CHART_COLORS.estimate]}
            layout="vertical" yAxisWidth={140} minValue={0} maxValue={100} valueFormatter={(v: number) => v.toFixed(1)}
            className="h-96" showLegend={false} />
        </SectionCard>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-charcoal">Injury-year trends</p>
            {allYears.length > 0 && (
              <p className="text-xs text-slate-500" data-testid="year-span">
                Showing {span(yearsShown)} · {yearsShown.length} of {allYears.length} injury years
              </p>
            )}
          </div>
          <SegmentedControl label="Injury years shown" options={YEAR_VIEWS} value={yearView} onChange={setYearView} />
        </div>
        {(noFinancialYears > 0 || withoutYear > 0) && (
          <p className="text-xs text-slate-500" data-testid="year-notes">
            {noFinancialYears > 0 && <>No financial data for {noFinancialYears} of {yearsShown.length} years shown; incurred and final cost are left blank there, not $0. </>}
            {withoutYear > 0 && <>{n(withoutYear)} claims without an injury year are not charted.</>}
          </p>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Cost trend by injury year" aside="Incurred to date includes reserves on open claims">
            {years.error ? <ErrorState error={years.error} onRetry={years.reload} /> : yearsPending ?? (
              <LineChart data={trendData} index="year" categories={[SERIES.incurred, SERIES.final, SERIES.predicted]}
                colors={[CHART_COLORS.incurred, CHART_COLORS.final, CHART_COLORS.estimate]}
                valueFormatter={(v: number) => formatCompactCurrency(v)} connectNulls={false} className="h-72" yAxisWidth={64} />
            )}
          </SectionCard>
          <SectionCard title="Inflation comparison" aside={<StatusLabel>Illustrative · not a model setting</StatusLabel>}>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="ill-rate" className="text-charcoal">Illustrative annual rate</label>
              <input id="ill-rate" type="range" min={0} max={ILLUSTRATIVE_MAX} step={0.005} value={rate}
                onChange={(e) => setRate(Number(e.target.value))} className="w-40 accent-navy-700" />
              <span className="font-semibold tabular-nums" data-testid="ill-rate">{formatFraction(rate)}</span>
              <span className="text-xs text-slate-500">Compounded from injury year to {asOf}. Original data is unchanged.</span>
            </div>
            {years.error ? <p className="text-sm text-slate-500">Injury-year data could not be loaded.</p> : yearsPending ?? (
              <LineChart data={inflationData} index="year" categories={[SERIES.incurred, illustrative]}
                colors={[CHART_COLORS.incurred, CHART_COLORS.illustrative]} valueFormatter={(v: number) => formatCompactCurrency(v)}
                connectNulls={false} className="h-64" yAxisWidth={64} />
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title={`Summary by ${label.toLowerCase()}`} flush aside={`${n(data.groups.length)} groups · one row per claim`}>
        <div className="max-h-[32rem] overflow-auto">
          <Table>
            <TableHead>
              <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                {COLUMNS.map((c) => (
                  <TableHeaderCell key={c.key} className={c.right ? "text-right" : undefined}
                    aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => onSort(c.key)} title={c.title}
                      className={`inline-flex items-center gap-1 font-semibold hover:text-navy-700 ${sortKey === c.key ? "text-navy-700" : ""}`}>
                      {c.label}<span aria-hidden="true" className="text-xs">{sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortGroups(data.groups, sortKey, sortDir).map((g) => (
                <TableRow key={groupLabel(g.group)} data-testid="insight-row" className="hover:bg-slate-50">
                  <TableCell className="font-medium text-charcoal">
                    {groupLabel(g.group)}
                    {hasNoFinancials(g) && <span className="ml-2 text-xs font-normal text-slate-500">No financial data</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.claim_count)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.average_complexity, false, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.total_predicted_median_cost, true)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.total_incurred_to_date, true)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.claims_with_financials)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.total_final_cost, true)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{cell(g.closed_claims_with_final_cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          A dash means no recorded amount, never $0. Recorded zero amounts show as $0.
        </p>
      </SectionCard>
    </div>
  );
}
