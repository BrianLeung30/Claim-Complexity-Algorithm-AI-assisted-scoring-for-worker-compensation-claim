// Workload rules and simulated transfers. The rules mirror GET /workload exactly, using
// the thresholds the backend returns from config/workload.yaml; no thresholds live here.
import type { ClaimListItem, Weights, WorkloadResponse, WorkloadRow } from "../types/api";
import { complexityFromSubscores } from "./weights";

export type Thresholds = WorkloadResponse["thresholds"];

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Recompute warnings (and the team median) exactly as the backend does. */
export function applyWorkloadRules(rows: WorkloadRow[], t: Thresholds): { rows: WorkloadRow[]; teamMedian: number } {
  const med = median(rows.filter((r) => !r.unassigned).map((r) => r.total_complexity));
  const ratio = t.warning_load_ratio.value;
  const maxHigh = t.warning_high_claims.value;
  const out = rows.map((r) => {
    const reasons: string[] = [];
    if (!r.unassigned) {
      if (med > 0 && r.total_complexity > ratio * med) reasons.push(`total complexity above ${ratio}x the team median`);
      if (r.high_complexity_claims >= maxHigh) reasons.push(`${maxHigh}+ high-complexity claims`);
    }
    return { ...r, workload_warning: reasons.length > 0, warning_reasons: reasons };
  });
  return { rows: out, teamMedian: med };
}

export interface Transfer {
  claimNumber: string;
  complexity: number;
  from: string | null; // null = unassigned
  to: string;
}

function emptyRow(adjuster: string): WorkloadRow {
  return {
    adjuster, unassigned: false, assigned_claims: 0, total_complexity: 0, average_complexity: null,
    high_complexity_claims: 0, workload_warning: false, warning_reasons: [],
  };
}

function adjust(r: WorkloadRow, sign: 1 | -1, x: number, isHigh: boolean): WorkloadRow {
  const n = r.assigned_claims + sign;
  const total = Math.max(0, r.total_complexity + sign * x);
  return {
    ...r,
    assigned_claims: n,
    total_complexity: Math.round(total * 100) / 100,
    average_complexity: n > 0 ? Math.round((total / n) * 100) / 100 : null,
    high_complexity_claims: r.high_complexity_claims + (isHigh ? sign : 0),
  };
}

/** Rows after moving one claim. Pure: never touches the backend. */
export function simulateTransfer(rows: WorkloadRow[], move: Transfer, t: Thresholds): { rows: WorkloadRow[]; teamMedian: number } {
  const isHigh = move.complexity >= t.high_complexity_threshold.value;
  let next = rows.map((r) => {
    if (r.adjuster === move.from) return adjust(r, -1, move.complexity, isHigh);
    if (r.adjuster === move.to) return adjust(r, 1, move.complexity, isHigh);
    return r;
  });
  if (!next.some((r) => r.adjuster === move.to)) next = [...next, adjust(emptyRow(move.to), 1, move.complexity, isHigh)];
  next = next.filter((r) => !(r.unassigned && r.assigned_claims === 0));
  return applyWorkloadRules(next, t);
}

export function rowFor(rows: WorkloadRow[], adjuster: string | null): WorkloadRow | undefined {
  return rows.find((r) => r.adjuster === adjuster);
}

export type WorkloadSortKey = "adjuster" | "assigned_claims" | "total_complexity" | "average_complexity" | "high_complexity_claims" | "workload_warning";

export function sortRows(rows: WorkloadRow[], key: WorkloadSortKey, dir: "asc" | "desc"): WorkloadRow[] {
  const val = (r: WorkloadRow): number | string => {
    const v = r[key];
    if (typeof v === "boolean") return v ? 1 : 0;
    return v ?? (key === "adjuster" ? "" : -Infinity);
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    const c = typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : (x as number) - (y as number);
    return c * sign || (a.adjuster ?? "").localeCompare(b.adjuster ?? "");
  });
}

/** Displayed complexity: the preview from sub-scores when a preview is active, else the saved score. */
export function displayedComplexity(c: ClaimListItem, preview: Weights | null): number | null {
  return preview ? complexityFromSubscores(c.subscores, preview) : c.complexity_score;
}
