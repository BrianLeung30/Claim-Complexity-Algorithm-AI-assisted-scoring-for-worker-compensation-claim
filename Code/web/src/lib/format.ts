// Display formatting. Missing values are never shown as zero.

export const MISSING = "—";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatCurrency(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? MISSING : usd.format(v);
}

export function formatCostRange(low: number | null | undefined, high: number | null | undefined): string {
  if (low === null || low === undefined || high === null || high === undefined) return MISSING;
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

export function formatScore(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? MISSING : String(Math.round(v));
}

export function formatPercent(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? MISSING : `${Math.round(v)}%`;
}

/** Fraction (0.25) to percent text ("25%"), keeping one decimal when needed. */
export function formatFraction(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return MISSING;
  const pct = Math.round(v * 1000) / 10;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return MISSING;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return MISSING;
  const s = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  }).format(t);
  return `${s} UTC`;
}

export function orMissing(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === "" ? MISSING : String(v);
}
