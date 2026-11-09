// Pure helpers for Cost & Risk Insights. One backend row per group; the backend already
// counts each claim once, so totals here are plain sums across groups.
import type { AnalyticsGroup } from "../types/api";
import { MISSING } from "./format";

/** Sum of non-null values; null when every value is missing (never treated as zero). */
export function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

export interface Totals {
  claims: number;
  averageComplexity: number | null;
  predictedMedian: number | null;
  incurredToDate: number | null;
  claimsWithFinancials: number;
  finalCost: number | null;
  closedWithFinalCost: number;
}

export function totals(groups: AnalyticsGroup[]): Totals {
  const est = groups.reduce((s, g) => s + g.claims_with_estimates, 0);
  const wsum = groups.reduce((s, g) => s + (g.average_complexity ?? 0) * g.claims_with_estimates, 0);
  return {
    claims: groups.reduce((s, g) => s + g.claim_count, 0),
    averageComplexity: est > 0 ? wsum / est : null,
    predictedMedian: sumKnown(groups.map((g) => g.total_predicted_median_cost)),
    incurredToDate: sumKnown(groups.map((g) => g.total_incurred_to_date)),
    claimsWithFinancials: groups.reduce((s, g) => s + g.claims_with_financials, 0),
    finalCost: sumKnown(groups.map((g) => g.total_final_cost)),
    closedWithFinalCost: groups.reduce((s, g) => s + g.closed_claims_with_final_cost, 0),
  };
}

export const groupLabel = (g: AnalyticsGroup["group"]) => (g === null || g === "" ? "Not recorded" : String(g));

/** True when none of the group's claims has a financial record (its money totals are missing, not $0). */
export const hasNoFinancials = (g: AnalyticsGroup) => g.claims_with_financials === 0;

export type YearGroup = AnalyticsGroup & { group: number };

/** Injury-year groups oldest first. Groups without a recorded year are left out (count them with ``claimsWithoutYear``). */
export function byInjuryYear(groups: AnalyticsGroup[]): YearGroup[] {
  return groups.filter((g): g is YearGroup => typeof g.group === "number").sort((a, b) => a.group - b.group);
}

export const claimsWithoutYear = (groups: AnalyticsGroup[]) =>
  groups.filter((g) => typeof g.group !== "number").reduce((s, g) => s + g.claim_count, 0);

export interface YearRange {
  from: number;
  to: number;
}

/** The ``n`` most recent calendar years ending at the latest injury year in the data; null when there are no years. */
export function recentYearRange(years: number[], n: number): YearRange | null {
  if (!years.length) return null;
  const to = Math.max(...years);
  return { from: Math.max(Math.min(...years), to - n + 1), to };
}

/** Groups inside ``range`` (inclusive), or all groups when ``range`` is null. Groups are never altered. */
export function inYearRange(groups: YearGroup[], range: YearRange | null): YearGroup[] {
  return range ? groups.filter((g) => g.group >= range.from && g.group <= range.to) : groups;
}

/**
 * Illustrative only: incurred-to-date by injury year compounded to ``asOfYear`` at ``rate``.
 * Original values are returned unchanged alongside; missing values stay missing.
 */
export function inflationTrend(groups: AnalyticsGroup[], rate: number, asOfYear: number) {
  return groups
    .filter((g) => typeof g.group === "number")
    .sort((a, b) => (a.group as number) - (b.group as number))
    .map((g) => {
      const year = g.group as number;
      const original = g.total_incurred_to_date;
      const adjusted = original === null ? null : original * Math.pow(1 + rate, Math.max(0, asOfYear - year));
      return { year, original, adjusted, claimsWithFinancials: g.claims_with_financials };
    });
}

const compact = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1,
});
export const formatCompactCurrency = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? MISSING : compact.format(v);
