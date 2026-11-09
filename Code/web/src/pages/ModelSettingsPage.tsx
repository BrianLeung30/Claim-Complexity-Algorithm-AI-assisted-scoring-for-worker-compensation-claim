import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/tremor";
import { SectionCard } from "../components/SectionCard";
import { ErrorState, LoadingState } from "../components/StateViews";
import { WeightsPanel } from "../components/WeightsPanel";
import { WEIGHT_LABELS } from "../lib/config";
import { formatFraction, formatTimestamp, MISSING } from "../lib/format";
import { useSettings } from "../lib/settingsContext";
import { approvalStatus, normalise, savedWeights, WEIGHT_KEYS } from "../lib/weights";
import type { SettingEntry } from "../types/api";

function Row({ label, entry, value }: { label: string; entry: SettingEntry; value: string }) {
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell className="text-charcoal">{label}</TableCell>
      <TableCell className="text-right font-medium tabular-nums text-charcoal">{value}</TableCell>
      <TableCell className="text-slate-600">{entry.source}</TableCell>
      <TableCell className="text-slate-600">{entry.approved_by}</TableCell>
    </TableRow>
  );
}

export function ModelSettingsPage() {
  const { saved: data, error, loading, reloadSaved } = useSettings();
  if (loading && !data) return <LoadingState label="Loading settings…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reloadSaved} />;
  if (!data) return null;
  const w = data.complexity_weights;
  const shares = normalise(savedWeights(data));
  const p = data.cost_range_percentiles;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <SectionCard
        title="Current settings"
        flush
        aside={<>Version {data.version}{data.updated_at ? ` · updated ${formatTimestamp(data.updated_at)}` : ""} · {approvalStatus(data).label}</>}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <TableHeaderCell>Setting</TableHeaderCell>
                <TableHeaderCell className="text-right">Value</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Approval</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {WEIGHT_KEYS.map((k) => (
                <Row key={k} label={`${WEIGHT_LABELS[k]} weight`} entry={w[k]} value={shares ? formatFraction(shares[k]) : MISSING} />
              ))}
              <Row label="Annual inflation rate" entry={data.annual_inflation_rate}
                value={formatFraction(data.annual_inflation_rate.value)} />
              <Row label="Cost range" entry={p.low} value={`P${p.low.value}–P${p.high.value}`} />
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          Weights are each factor's share of the complexity score. Complexity and cost are separate estimates; weights never change cost.
        </p>
      </SectionCard>
      <SectionCard title="Edit settings" aside="Preview until saved">
        <WeightsPanel />
      </SectionCard>
    </div>
  );
}
