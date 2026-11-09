import type { ReactNode } from "react";
import { complexityBand, THRESHOLD_STATUS, type ComplexityBand } from "../lib/config";
import { formatScore, MISSING } from "../lib/format";
import { WarningIcon } from "./Icons";

// One blue ramp, light to dark, so the band reads without relying on hue. The band name is
// also given as text (visible label or screen-reader text).
const BAND_STYLE: Record<ComplexityBand, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-navy-50 text-navy-800",
  high: "bg-navy-200 font-semibold text-navy-900",
};
const BAND_LABEL: Record<ComplexityBand, string> = { low: "Low", medium: "Medium", high: "High" };

export function ComplexityBadge({ score, showLabel = false }: { score: number | null; showLabel?: boolean }) {
  if (score === null) return <span className="text-slate-400">{MISSING}</span>;
  // The band uses the unrounded score (as the workload board does), so 74.6 shows "75" but is
  // Medium; the exact score is in the hover text.
  const band = complexityBand(score);
  return (
    <span
      className={`inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium tabular-nums ${BAND_STYLE[band]}`}
      title={`${BAND_LABEL[band]} complexity · score ${score.toFixed(1)} (band ${THRESHOLD_STATUS})`}
      data-band={band}
    >
      {formatScore(score)}
      {showLabel ? <span className="font-medium">· {BAND_LABEL[band]}</span> : <span className="sr-only"> {BAND_LABEL[band]}</span>}
    </span>
  );
}

const ACTIVE_STATUSES = new Set(["Open", "Reopened"]);

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400">{MISSING}</span>;
  const style = ACTIVE_STATUSES.has(status) ? "bg-navy-50 text-navy-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${style}`}>{status}</span>;
}

type LabelTone = "neutral" | "info";
const LABEL_TONE: Record<LabelTone, { box: string; dot: string }> = {
  neutral: { box: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  info: { box: "bg-navy-50 text-navy-700", dot: "bg-navy-500" },
};

/**
 * Understated status text: preliminary, pending approval, preview, simulation. It keeps the
 * meaning visible without warning colours; "info" marks something temporary that is active now.
 */
export function StatusLabel({ children, tone = "neutral", title, testId }: {
  children: ReactNode; tone?: LabelTone; title?: string; testId?: string;
}) {
  const t = LABEL_TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${t.box}`}
      title={title} data-testid={testId}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

/** A genuine risk indicator: noticeable (small warning mark) but understated (neutral text, no box). */
export function WarningText({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span className="inline-flex items-start gap-1.5 text-xs text-charcoal" data-testid={testId}>
      <WarningIcon className="mt-px h-3.5 w-3.5 shrink-0 text-accent-dark" />
      <span>{children}</span>
    </span>
  );
}
