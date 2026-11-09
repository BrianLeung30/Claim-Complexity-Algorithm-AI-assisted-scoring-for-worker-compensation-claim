import { formatCurrency } from "../lib/format";

/** Horizontal range: band from low to high, marker at the median, on a $0-based scale. */
export function CostRangeBar({ low, median, high }: { low: number; median: number; high: number }) {
  const max = Math.max(high * 1.15, 1);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const label = `Estimated cost range ${formatCurrency(low)} to ${formatCurrency(high)}, median ${formatCurrency(median)}`;
  return (
    <figure className="mt-1" aria-label={label} role="img">
      <div className="relative h-3 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full bg-navy-200"
          style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }}
        />
        <div className="absolute -top-1 h-5 w-0.5 bg-navy-700" style={{ left: pct(median) }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500" aria-hidden="true">
        <span>$0</span>
        <span>{formatCurrency(max)}</span>
      </div>
    </figure>
  );
}
