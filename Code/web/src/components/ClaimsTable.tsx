import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./tremor";
import { formatCostRange, formatDate, formatPercent, orMissing } from "../lib/format";
import { hrefFor } from "../lib/router";
import type { ClaimListItem, SortBy, SortOrder } from "../types/api";
import { StatusBadge } from "./Badges";
import { ComplexityCell } from "./PreviewScore";

interface Props {
  items: ClaimListItem[];
  sortBy: SortBy;
  order: SortOrder;
  onSort: (sortBy: SortBy) => void;
}

function SortHeader({ label, column, sortBy, order, onSort, align = "left" }: {
  label: string; column: SortBy; sortBy: SortBy; order: SortOrder; onSort: (c: SortBy) => void; align?: "left" | "right";
}) {
  const active = sortBy === column;
  return (
    <TableHeaderCell
      aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={align === "right" ? "text-right" : undefined}
    >
      <button type="button" onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 font-semibold hover:text-navy-700 ${active ? "text-navy-700" : ""}`}>
        {label}
        <span aria-hidden="true" className="text-xs">{active ? (order === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </TableHeaderCell>
  );
}

export function ClaimsTable({ items, sortBy, order, onSort }: Props) {
  const sort = { sortBy, order, onSort };
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[960px]">
        <TableHead>
          <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <TableHeaderCell>Claim number</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Adjuster</TableHeaderCell>
            <TableHeaderCell>Employer</TableHeaderCell>
            <TableHeaderCell>Loss type</TableHeaderCell>
            <SortHeader label="Injury date" column="injury_date" {...sort} />
            <SortHeader label="Complexity" column="complexity" {...sort} />
            <SortHeader label="Est. cost range" column="cost" {...sort} />
            <TableHeaderCell className="text-right" title="Baseline heuristic from reference-group size and spread; not a validated probability">
              Baseline confidence
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.claim_number} className="hover:bg-slate-50">
              <TableCell>
                <a href={hrefFor.claim(c.claim_number)} className="font-medium text-navy-700 underline-offset-2 hover:underline">
                  {c.claim_number}
                </a>
              </TableCell>
              <TableCell><StatusBadge status={c.status} /></TableCell>
              <TableCell className="text-charcoal">{orMissing(c.adjuster)}</TableCell>
              <TableCell className="text-charcoal">{orMissing(c.employer)}</TableCell>
              <TableCell className="text-charcoal">{orMissing(c.loss_type)}</TableCell>
              <TableCell className="tabular-nums text-charcoal">{formatDate(c.injury_date)}</TableCell>
              <TableCell><ComplexityCell saved={c.complexity_score} subscores={c.subscores} /></TableCell>
              <TableCell className="tabular-nums text-charcoal">{formatCostRange(c.cost_low, c.cost_high)}</TableCell>
              <TableCell className="text-right tabular-nums text-charcoal">{formatPercent(c.cost_confidence)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
