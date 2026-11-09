import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./tremor";
import { formatCostRange, formatCurrency, formatPercent, formatTimestamp } from "../lib/format";
import type { EstimateRecord } from "../types/api";
import { ComplexityBadge } from "./Badges";
import { SectionCard } from "./SectionCard";

/** Previous estimates (the latest is shown above), newest first as returned by the backend. */
export function EstimateHistory({ history }: { history: EstimateRecord[] }) {
  return (
    <SectionCard title="Estimate history" aside="Previous estimates, newest first" flush>
      {history.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">No previous estimates. Only the current estimate exists.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <TableHeaderCell>Estimated</TableHeaderCell>
                <TableHeaderCell>Settings</TableHeaderCell>
                <TableHeaderCell>Complexity</TableHeaderCell>
                <TableHeaderCell>Cost range</TableHeaderCell>
                <TableHeaderCell>Median</TableHeaderCell>
                <TableHeaderCell className="text-right">Baseline confidence</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.estimate_id} className="hover:bg-slate-50">
                  <TableCell className="tabular-nums text-charcoal">{formatTimestamp(h.estimated_at)}</TableCell>
                  <TableCell className="text-charcoal">v{h.weights_version}</TableCell>
                  <TableCell><ComplexityBadge score={h.complexity.score} /></TableCell>
                  <TableCell className="tabular-nums text-charcoal">{formatCostRange(h.cost.low, h.cost.high)}</TableCell>
                  <TableCell className="tabular-nums text-charcoal">{formatCurrency(h.cost.median)}</TableCell>
                  <TableCell className="text-right tabular-nums text-charcoal">{formatPercent(h.cost.confidence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
