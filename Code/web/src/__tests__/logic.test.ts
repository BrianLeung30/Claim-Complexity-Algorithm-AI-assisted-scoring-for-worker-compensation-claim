import { describe, expect, it } from "vitest";
import {
  byInjuryYear, claimsWithoutYear, formatCompactCurrency, hasNoFinancials, inflationTrend, inYearRange, recentYearRange,
  sumKnown, totals,
} from "../lib/analytics";
import { RECENT_INJURY_YEARS } from "../lib/config";
import { approvalStatus, complexityFromSubscores, normalise } from "../lib/weights";
import { applyWorkloadRules, rowFor, simulateTransfer } from "../lib/workload";
import { analyticsGroup, weights, workload } from "../test/fixtures";

describe("weights", () => {
  it("normalises to a sum of 1 and rejects all-zero weights", () => {
    const n = normalise({ duration: 2, medical_intensity: 1, time_loss: 1, legal: 0 })!;
    expect(n.duration).toBeCloseTo(0.5);
    expect(n.duration + n.medical_intensity + n.time_loss + n.legal).toBeCloseTo(1);
    expect(normalise({ duration: 0, medical_intensity: 0, time_loss: 0, legal: 0 })).toBeNull();
  });

  it("matches the backend weighted average: sum(w*s)/sum(w), clipped to 0-100", () => {
    const s = { duration: 90, medical_intensity: 60, time_loss: 30, legal: 10 };
    expect(complexityFromSubscores(s, { duration: 1, medical_intensity: 1, time_loss: 1, legal: 1 })).toBeCloseTo(47.5);
    expect(complexityFromSubscores(s, { duration: 0.7, medical_intensity: 0.1, time_loss: 0.1, legal: 0.1 })).toBeCloseTo(73);
    // un-normalised weights give the same result as normalised ones
    expect(complexityFromSubscores(s, { duration: 7, medical_intensity: 1, time_loss: 1, legal: 1 })).toBeCloseTo(73);
    expect(complexityFromSubscores({ ...s, legal: null }, { duration: 1, medical_intensity: 1, time_loss: 1, legal: 1 })).toBeNull();
    expect(complexityFromSubscores(null, { duration: 1, medical_intensity: 1, time_loss: 1, legal: 1 })).toBeNull();
  });

  it("never reports placeholder settings as approved", () => {
    expect(approvalStatus(weights).approved).toBe(false);
    expect(approvalStatus(weights).label).toMatch(/pending Penser approval/);
    const tbd = structuredClone(weights);
    for (const e of Object.values(tbd.complexity_weights)) e.approved_by = "TBD";
    tbd.annual_inflation_rate.approved_by = "Penser not yet reviewed";
    expect(approvalStatus(tbd).approved).toBe(false);
    const all = structuredClone(weights);
    for (const e of Object.values(all.complexity_weights)) e.approved_by = "Penser";
    all.annual_inflation_rate.approved_by = "Penser";
    expect(approvalStatus(all).approved).toBe(true);
  });
});

describe("workload rules and simulation", () => {
  const w = workload();

  it("reproduces the backend warnings from config thresholds", () => {
    const stripped = w.adjusters.map((r) => ({ ...r, workload_warning: false, warning_reasons: [] }));
    const { rows, teamMedian } = applyWorkloadRules(stripped, w.thresholds);
    expect(teamMedian).toBe(w.team_median_total_complexity);
    expect(rows.map((r) => r.workload_warning)).toEqual(w.adjusters.map((r) => r.workload_warning));
    expect(rows.map((r) => r.warning_reasons)).toEqual(w.adjusters.map((r) => r.warning_reasons));
  });

  it("moves one claim's complexity, count and high flag between adjusters", () => {
    const { rows } = simulateTransfer(w.adjusters, { claimNumber: "ClaimNum 00042", complexity: 80, from: "Adjuster 00901", to: "Adjuster 00903" }, w.thresholds);
    const src = rowFor(rows, "Adjuster 00901")!;
    const dst = rowFor(rows, "Adjuster 00903")!;
    expect([src.assigned_claims, src.total_complexity, src.high_complexity_claims]).toEqual([3, 240, 2]);
    expect([dst.assigned_claims, dst.total_complexity, dst.high_complexity_claims]).toEqual([3, 180, 2]);
    // team total unchanged
    const sum = (rs: typeof rows) => rs.reduce((s, r) => s + r.total_complexity, 0);
    expect(sum(rows)).toBeCloseTo(sum(w.adjusters));
    // warnings recomputed with the same rules: 00903 now has 2 high claims
    expect(dst.workload_warning).toBe(true);
    // the input rows are not modified
    expect(rowFor(w.adjusters, "Adjuster 00901")!.assigned_claims).toBe(4);
  });

  it("handles unassigned sources and destinations with no active claims", () => {
    const { rows } = simulateTransfer(w.adjusters, { claimNumber: "ClaimNum 00050", complexity: 40, from: null, to: "Adjuster 00904" }, w.thresholds);
    expect(rowFor(rows, null)!.assigned_claims).toBe(1);
    expect(rowFor(rows, "Adjuster 00904")).toMatchObject({ assigned_claims: 1, total_complexity: 40, high_complexity_claims: 0 });
  });
});

describe("analytics helpers", () => {
  it("sums known values and keeps all-missing as missing, not zero", () => {
    expect(sumKnown([1, null, 2])).toBe(3);
    expect(sumKnown([null, null])).toBeNull();
    const t = totals([
      analyticsGroup("A", { claim_count: 4, claims_with_estimates: 4, average_complexity: 60, total_incurred_to_date: null, claims_with_financials: 0, total_final_cost: null }),
      analyticsGroup("B", { claim_count: 6, claims_with_estimates: 6, average_complexity: 40, total_incurred_to_date: 1000, total_final_cost: 400 }),
    ]);
    expect(t.claims).toBe(10);
    expect(t.averageComplexity).toBeCloseTo(48);           // weighted by claims with estimates
    expect(t.incurredToDate).toBe(1000);
    expect(t.finalCost).toBe(400);
    expect(totals([analyticsGroup("A", { total_incurred_to_date: null })]).incurredToDate).toBeNull();
  });

  it("builds an illustrative inflation trend without changing original values", () => {
    const groups = [analyticsGroup(2024, { total_incurred_to_date: 1000 }), analyticsGroup(2022, { total_incurred_to_date: 500 }),
      analyticsGroup(2025, { total_incurred_to_date: null })];
    const tr = inflationTrend(groups, 0.1, 2026);
    expect(tr.map((r) => r.year)).toEqual([2022, 2024, 2025]);
    expect(tr[0]!.original).toBe(500);
    expect(tr[0]!.adjusted).toBeCloseTo(500 * 1.1 ** 4);
    expect(tr[1]!.adjusted).toBeCloseTo(1000 * 1.1 ** 2);
    expect(tr[2]).toMatchObject({ original: null, adjusted: null });
    expect(groups[1]!.total_incurred_to_date).toBe(500);
  });

  it("selects the recent injury years from the data without altering any group", () => {
    const groups = [2024, 1987, 2019, 2021, 2020, 2022, 2023, 1995].map((y) => analyticsGroup(y));
    const all = [...groups, analyticsGroup(null, { claim_count: 3 })];
    const years = byInjuryYear(all);
    expect(years.map((g) => g.group)).toEqual([1987, 1995, 2019, 2020, 2021, 2022, 2023, 2024]);
    expect(claimsWithoutYear(all)).toBe(3);

    expect(RECENT_INJURY_YEARS).toBe(6);
    const range = recentYearRange(years.map((g) => g.group), RECENT_INJURY_YEARS);
    expect(range).toEqual({ from: 2019, to: 2024 });                   // ends at the latest year in the data
    expect(inYearRange(years, range).map((g) => g.group)).toEqual([2019, 2020, 2021, 2022, 2023, 2024]);
    expect(inYearRange(years, null)).toHaveLength(8);                   // "All years" keeps the old years
    expect(recentYearRange([2025, 2024], 6)).toEqual({ from: 2024, to: 2025 });
    expect(recentYearRange([], 6)).toBeNull();
    // the input groups are untouched
    expect(groups.map((g) => g.total_incurred_to_date)).toEqual(groups.map(() => 80000));
  });

  it("flags groups without any financial record, but not recorded zero amounts", () => {
    expect(hasNoFinancials(analyticsGroup(1994, { claims_with_financials: 0, total_incurred_to_date: null }))).toBe(true);
    expect(hasNoFinancials(analyticsGroup(2020, { claims_with_financials: 2, total_incurred_to_date: 0 }))).toBe(false);
    expect(formatCompactCurrency(null)).toBe("—");
    expect(formatCompactCurrency(0)).toBe("$0");
    expect(formatCompactCurrency(700_000)).toBe("$700K");
    expect(formatCompactCurrency(137_900_000)).toBe("$137.9M");
  });
});
