import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./tremor";
import type { WorkloadSortKey } from "../lib/workload";
import type { WorkloadRow } from "../types/api";
import { StatusLabel, WarningText } from "./Badges";

const fmt = (n: number | null, digits = 0) =>
  n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

interface Props {
  rows: WorkloadRow[];
  maxTotal: number;
  teamMedian: number;
  sortKey: WorkloadSortKey;
  sortDir: "asc" | "desc";
  onSort: (k: WorkloadSortKey) => void;
  selected: string | null | undefined;
  /** Opens the adjuster panel; ``trigger`` gets focus back when the panel closes. */
  onSelect: (adjuster: string | null, trigger: HTMLElement) => void;
  changed: Set<string | null>;
}

function Header({ label, k, props, right = false }: { label: string; k: WorkloadSortKey; props: Props; right?: boolean }) {
  const active = props.sortKey === k;
  return (
    <TableHeaderCell aria-sort={active ? (props.sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={right ? "text-right" : undefined}>
      <button type="button" onClick={() => props.onSort(k)}
        className={`inline-flex items-center gap-1 font-semibold hover:text-navy-700 ${active ? "text-navy-700" : ""}`}>
        {label}<span aria-hidden="true" className="text-xs">{active ? (props.sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </TableHeaderCell>
  );
}

/** Adjuster workload table. Total complexity is shown with its claim count and a bar. */
export function WorkloadTable(props: Props) {
  const { rows, maxTotal, teamMedian, selected, onSelect, changed } = props;
  const pct = (v: number) => `${maxTotal > 0 ? Math.min(100, (v / maxTotal) * 100) : 0}%`;
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[860px]">
        <TableHead>
          <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <Header label="Adjuster" k="adjuster" props={props} />
            <Header label="Claims" k="assigned_claims" props={props} right />
            <Header label="Total complexity" k="total_complexity" props={props} />
            <Header label="Avg" k="average_complexity" props={props} right />
            <Header label="High" k="high_complexity_claims" props={props} right />
            <Header label="Warning" k="workload_warning" props={props} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const isSel = selected === r.adjuster;
            const sim = changed.has(r.adjuster);
            return (
              <TableRow key={r.adjuster ?? "unassigned"} data-testid={`workload-row-${r.adjuster ?? "unassigned"}`}
                className={isSel ? "bg-navy-50" : "hover:bg-slate-50"}>
                <TableCell>
                  <button type="button" onClick={(e) => onSelect(r.adjuster, e.currentTarget)}
                    aria-haspopup="dialog" aria-expanded={isSel}
                    className={`font-medium text-navy-700 underline-offset-2 hover:underline ${isSel ? "underline" : ""}`}>
                    {r.adjuster ?? "Unassigned"}
                  </button>
                  {sim && <span className="ml-2"><StatusLabel>Simulated</StatusLabel></span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-charcoal" data-testid="claims">{fmt(r.assigned_claims)}</TableCell>
                <TableCell className="min-w-[280px]">
                  <div className="flex items-center gap-3">
                    <div className="relative h-2 flex-1 rounded-full bg-slate-100" aria-hidden="true">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-navy-500" style={{ width: pct(r.total_complexity) }} />
                      {teamMedian > 0 && !r.unassigned && (
                        <div className="absolute -inset-y-1 w-px bg-slate-500" style={{ left: pct(teamMedian) }} title="Team median" />
                      )}
                    </div>
                    <span className="w-36 shrink-0 text-right tabular-nums text-charcoal">
                      <span className="font-semibold" data-testid="total">{fmt(r.total_complexity)}</span>
                      <span className="text-slate-500"> · {fmt(r.assigned_claims)} claims</span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-charcoal">{fmt(r.average_complexity, 1)}</TableCell>
                <TableCell className="text-right tabular-nums text-charcoal">
                  <span data-testid="high">{fmt(r.high_complexity_claims)}</span>
                </TableCell>
                <TableCell>
                  {r.workload_warning ? (
                    <WarningText testId="warning">{r.warning_reasons.join("; ")}</WarningText>
                  ) : <span className="text-xs text-slate-400">{r.unassigned ? "n/a" : "None"}</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
