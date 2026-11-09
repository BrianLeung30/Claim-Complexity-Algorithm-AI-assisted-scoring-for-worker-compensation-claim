import { useId, useState } from "react";
import { THRESHOLD_STATUS } from "../lib/config";
import { formatCostRange, formatScore, MISSING } from "../lib/format";
import { hrefFor } from "../lib/router";
import { useApi } from "../lib/useApi";
import { displayedComplexity, rowFor, type Transfer } from "../lib/workload";
import { api } from "../services/api";
import type { Weights, WorkloadRow } from "../types/api";
import { ComplexityBadge, StatusBadge, WarningText } from "./Badges";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./tremor";

interface Props {
  adjuster: string | null;        // null = unassigned
  row: WorkloadRow | undefined;   // current workload, before any simulated move
  preview: Weights | null;        // same (debounced) preview weights as the workload request
  highThreshold: number;          // from config/workload.yaml via GET /workload
  destinations: string[];
  before: WorkloadRow[];
  after: WorkloadRow[] | null;
  simulation: Transfer | null;
  onSimulate: (t: Transfer) => void;
  onReset: () => void;
  dataVersion: number;
}

const label = (a: string | null) => a ?? "Unassigned";
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");

/** Contents of the adjuster slide-out panel: summary, simulated reassignment and active claims. */
export function AdjusterDetail(p: Props) {
  const id = useId();
  const claims = useApi((s) => api.adjusterClaims(p.adjuster, s), `${p.adjuster ?? "\u0000"}#${p.dataVersion}`);
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [claimNum, setClaimNum] = useState("");
  const [dest, setDest] = useState("");

  const items = (claims.data ?? []).map((c) => ({ c, x: displayedComplexity(c, p.preview) }));
  items.sort((a, b) => ((a.x ?? -1) - (b.x ?? -1)) * (order === "asc" ? 1 : -1) || a.c.claim_number.localeCompare(b.c.claim_number));
  const movable = items.filter((i) => i.x !== null);
  const picked = movable.find((i) => i.c.claim_number === claimNum);

  const run = () => {
    if (!picked || !dest || picked.x === null) return;
    p.onSimulate({ claimNumber: picked.c.claim_number, complexity: picked.x, from: p.adjuster, to: dest });
  };

  return (
    <div className="space-y-6">
      <Summary row={p.row} highThreshold={p.highThreshold} previewing={p.preview !== null} />

      <section aria-labelledby={`${id}-sim`} className="rounded border border-slate-200">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h3 id={`${id}-sim`} className="text-sm font-semibold text-charcoal">Reassignment</h3>
          <span className="text-xs text-slate-500">Simulation only</span>
        </div>
        <div className="space-y-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-claim`} className="field-label">Claim</label>
              <select id={`${id}-claim`} className="field-input" value={claimNum} onChange={(e) => setClaimNum(e.target.value)}>
                <option value="">Select a claim</option>
                {movable.map(({ c, x }) => <option key={c.claim_number} value={c.claim_number}>{c.claim_number} · {formatScore(x)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-dest`} className="field-label">Destination adjuster</label>
              <select id={`${id}-dest`} className="field-input" value={dest} onChange={(e) => setDest(e.target.value)}>
                <option value="">Select an adjuster</option>
                {p.destinations.filter((d) => d !== p.adjuster).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={run} disabled={!picked || !dest}>Simulate</button>
            <button type="button" className="btn-secondary" onClick={() => { setClaimNum(""); setDest(""); p.onReset(); }} disabled={!p.simulation}>
              Reset
            </button>
          </div>
          {p.simulation && p.after && <Comparison sim={p.simulation} before={p.before} after={p.after} />}
          <p className="text-xs text-slate-500">Assignments are not changed and nothing is saved.</p>
        </div>
      </section>

      <section aria-labelledby={`${id}-claims`}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={`${id}-claims`} className="text-sm font-semibold text-charcoal">Assigned claims</h3>
          <span className="text-xs text-slate-500">
            Open and reopened{claims.data ? ` · ${claims.data.length.toLocaleString("en-US")} claims` : ""}
          </span>
        </div>
        {claims.loading && !claims.data && <LoadingState label="Loading claims…" />}
        {claims.error && <ErrorState error={claims.error} onRetry={claims.reload} />}
        {claims.data && !claims.error && (items.length === 0 ? <EmptyState title="No active claims" /> : (
          <div className="overflow-hidden rounded border border-slate-200">
            <Table>
              <TableHead>
                <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <TableHeaderCell>Claim number</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell aria-sort={order === "asc" ? "ascending" : "descending"}>
                    <button type="button" className="inline-flex items-center gap-1 font-semibold text-navy-700"
                      onClick={() => setOrder(order === "desc" ? "asc" : "desc")}>
                      Complexity<span aria-hidden="true" className="text-xs">{order === "asc" ? "▲" : "▼"}</span>
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>Est. cost range</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(({ c, x }) => (
                  <TableRow key={c.claim_number} data-testid="adjuster-claim" className="hover:bg-slate-50">
                    <TableCell><a className="font-medium text-navy-700 underline-offset-2 hover:underline" href={hrefFor.claim(c.claim_number)}>{c.claim_number}</a></TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell><ComplexityBadge score={x} /></TableCell>
                    <TableCell className="tabular-nums text-charcoal">{formatCostRange(c.cost_low, c.cost_high)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </section>
    </div>
  );
}

function Summary({ row, highThreshold, previewing }: { row: WorkloadRow | undefined; highThreshold: number; previewing: boolean }) {
  const stats = [
    { label: "Active claims", value: row ? n0(row.assigned_claims) : "0", testId: "panel-claims" },
    { label: "Total complexity", value: row ? n0(row.total_complexity) : "0", testId: "panel-total" },
    { label: "Average complexity", value: row && row.average_complexity !== null ? row.average_complexity.toFixed(1) : MISSING, testId: "panel-average" },
    { label: `High (≥ ${highThreshold})`, value: row ? n0(row.high_complexity_claims) : "0", testId: "panel-high" },
  ];
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.testId} className="bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">{s.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-charcoal" data-testid={s.testId}>{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">
        Current open and reopened claims{previewing ? " · complexity uses the weights preview (not saved)" : ""}.
      </p>
      {row?.workload_warning && (
        <div className="space-y-0.5">
          <WarningText testId="panel-warning">{row.warning_reasons.join("; ")}</WarningText>
          <p className="pl-5 text-xs text-slate-500">Caseload indicator using {THRESHOLD_STATUS} thresholds; not a performance measure.</p>
        </div>
      )}
    </div>
  );
}

function Comparison({ sim, before, after }: { sim: Transfer; before: WorkloadRow[]; after: WorkloadRow[] }) {
  const rows = [
    { role: "Source", who: sim.from },
    { role: "Destination", who: sim.to },
  ];
  const n = (r?: WorkloadRow) => (r ? r.assigned_claims.toLocaleString("en-US") : "0");
  const t = (r?: WorkloadRow) => (r ? Math.round(r.total_complexity).toLocaleString("en-US") : "0");
  const w = (r?: WorkloadRow) => (r?.workload_warning ? "Warning" : "—");
  return (
    <div className="overflow-hidden rounded border border-slate-200" data-testid="sim-comparison">
      <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
        Simulated move of {sim.claimNumber} (complexity {formatScore(sim.complexity)}) · before → after
      </p>
      <Table>
        <TableHead>
          <TableRow className="text-xs uppercase tracking-wide text-slate-600">
            <TableHeaderCell>Adjuster</TableHeaderCell>
            <TableHeaderCell className="text-right">Claims</TableHeaderCell>
            <TableHeaderCell className="text-right">Total complexity</TableHeaderCell>
            <TableHeaderCell>Warning</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ role, who }) => {
            const b = rowFor(before, who);
            const a = rowFor(after, who);
            return (
              <TableRow key={role} data-testid={`sim-${role.toLowerCase()}`}>
                <TableCell className="text-charcoal"><span className="text-xs text-slate-500">{role}</span><br />{label(who)}</TableCell>
                <TableCell className="text-right tabular-nums text-charcoal">{n(b)} → <strong>{n(a)}</strong></TableCell>
                <TableCell className="text-right tabular-nums text-charcoal">{t(b)} → <strong>{t(a)}</strong></TableCell>
                <TableCell className="text-xs text-charcoal">{w(b)} → {w(a)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
