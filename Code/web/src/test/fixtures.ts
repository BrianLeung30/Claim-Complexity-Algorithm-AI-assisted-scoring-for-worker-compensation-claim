// Synthetic fixtures only. Shapes match backend/api.py; values are invented.
import { vi } from "vitest";
import type {
  AnalyticsGroup, AnalyticsResponse, ClaimDetail, ClaimListItem, ClaimListResponse, EstimateRecord, FilterOptions,
  WeightsResponse, WorkloadResponse, WorkloadRow,
} from "../types/api";

export function listItem(n: number, overrides: Partial<ClaimListItem> = {}): ClaimListItem {
  return {
    claim_number: `ClaimNum ${String(n).padStart(5, "0")}`,
    status: "Open",
    adjuster: "Adjuster 00901",
    employer: "Synthetic Employer A",
    loss_type: "Indemnity",
    injury_date: "2024-03-05",
    complexity_score: 80 - n,
    cost_low: 1000,
    cost_median: 2500.4,
    cost_high: 12000,
    cost_confidence: 43.2,
    subscores: { duration: 90, medical_intensity: 60, time_loss: 30, legal: 10 },
    ...overrides,
  };
}

export function listResponse(items: ClaimListItem[], page = 1, pageSize = 50, total = items.length): ClaimListResponse {
  return { items, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } };
}

export function estimate(id: number, overrides: Partial<EstimateRecord> = {}): EstimateRecord {
  return {
    estimate_id: id,
    estimated_at: "2026-10-01T12:00:00Z",
    weights_version: 1,
    complexity: {
      score: 72.6,
      subscores: { duration: 81.2, medical_intensity: 64.9, time_loss: 55.0, legal: 12.4 },
      reasons: ["Strain: long time to close", "Strain: typical medical costs", "Strain: sometimes involves time loss"],
    },
    cost: {
      low: 850, median: 4300.5, high: 26750, confidence: 47.8, dollar_year: 2026,
      reference_group: "Indemnity | Lifting | Strain", reference_level: "type+cause+nature",
    },
    ...overrides,
  };
}

export function detail(overrides: Partial<ClaimDetail> = {}): ClaimDetail {
  const latest = estimate(3, { estimated_at: "2026-11-02T09:30:00Z", weights_version: 2 });
  return {
    claim: {
      claim_number: "ClaimNum 00042", status: "Reopened", adjuster: "Adjuster 00901",
      employer: "Synthetic Employer A", insured_division: "Synthetic Division 1", tier_2: "Synthetic Tier",
      loss_type: "Indemnity", loss_cause: "Lifting", loss_nature: "Strain", injury_date: "2024-03-05", injury_year: 2024,
    },
    historical_costs: { has_financials: true, incurred_to_date: 15234.56, final_cost: null },
    complexity: latest.complexity,
    cost: latest.cost,
    latest_estimate: { estimate_id: 3, estimated_at: latest.estimated_at, weights_version: 2 },
    history: [
      estimate(2, { estimated_at: "2026-10-15T08:00:00Z", complexity: { ...latest.complexity, score: 61 } }),
      estimate(1, { estimated_at: "2026-10-01T08:00:00Z", complexity: { ...latest.complexity, score: 58 } }),
    ],
    ...overrides,
  };
}

export const weights: WeightsResponse = {
  version: 3,
  updated_at: "2026-11-01T10:00:00+00:00",
  complexity_weights: {
    duration: { value: 0.4, source: "changed via PUT /weights", approved_by: "pending Penser" },
    medical_intensity: { value: 0.2, source: "baseline placeholder", approved_by: "pending Penser" },
    time_loss: { value: 0.2, source: "baseline placeholder", approved_by: "pending Penser" },
    legal: { value: 0.2, source: "baseline placeholder", approved_by: "pending Penser" },
  },
  annual_inflation_rate: { value: 0.035, source: "baseline placeholder", approved_by: "pending Penser" },
  cost_range_percentiles: {
    low: { value: 10, source: "baseline placeholder", approved_by: "pending Penser" },
    high: { value: 90, source: "baseline placeholder", approved_by: "pending Penser" },
  },
  limits: { complexity_weight_min: 0, annual_inflation_rate_min: 0, annual_inflation_rate_max: 0.25 },
};

export const filterOptions: FilterOptions = {
  statuses: ["Closed", "Open", "Pending", "Reopened"],
  loss_types: ["Indemnity", "Medical only"],
  adjusters: ["Adjuster 00901", "Adjuster 00902", "Adjuster 00903", "Adjuster 00904"],
  employers: ["Synthetic Employer A", "Synthetic Employer B"],
  claims_without_adjuster: 2,
};

export function analyticsGroup(group: string | number | null, o: Partial<AnalyticsGroup> = {}): AnalyticsGroup {
  return {
    group, claim_count: 10, claims_with_estimates: 10, average_complexity: 50,
    total_predicted_median_cost: 100000, claims_with_financials: 8, total_incurred_to_date: 80000,
    closed_claims_with_final_cost: 5, total_final_cost: 40000, ...o,
  };
}

export function analytics(groupBy: AnalyticsResponse["group_by"], groups: AnalyticsGroup[]): AnalyticsResponse {
  return { group_by: groupBy, preview_weights: null, definitions: {}, groups };
}

export function workloadRow(adjuster: string | null, o: Partial<WorkloadRow> = {}): WorkloadRow {
  return {
    adjuster, unassigned: adjuster === null, assigned_claims: 3, total_complexity: 150, average_complexity: 50,
    high_complexity_claims: 0, workload_warning: false, warning_reasons: [], ...o,
  };
}

/** Synthetic workload consistent with the backend rules (median of assigned totals = 200). */
export function workload(): WorkloadResponse {
  return {
    statuses_included: ["Open", "Reopened"],
    team_median_total_complexity: 200,
    thresholds: {
      high_complexity_threshold: { value: 75, source: "baseline placeholder", approved_by: "pending Penser" },
      warning_load_ratio: { value: 1.25, source: "baseline placeholder", approved_by: "pending Penser" },
      warning_high_claims: { value: 2, source: "baseline placeholder", approved_by: "pending Penser" },
    },
    preview_weights: null,
    adjusters: [
      workloadRow("Adjuster 00901", { assigned_claims: 4, total_complexity: 320, average_complexity: 80, high_complexity_claims: 3,
        workload_warning: true, warning_reasons: ["total complexity above 1.25x the team median", "2+ high-complexity claims"] }),
      workloadRow("Adjuster 00902", { assigned_claims: 6, total_complexity: 200, average_complexity: 33.33, high_complexity_claims: 0 }),
      workloadRow("Adjuster 00903", { assigned_claims: 2, total_complexity: 100, average_complexity: 50, high_complexity_claims: 1 }),
      workloadRow(null, { assigned_claims: 2, total_complexity: 90, average_complexity: 45, high_complexity_claims: 0 }),
    ],
  };
}

export type RequestRecord = URL & { method: string; body?: string };
type Handler = (url: RequestRecord) => { status?: number; body: unknown } | "network-error";

/** Replace fetch with a router over synthetic responses. Returns every request (URL + method + body). */
export function mockBackend(handler: Handler) {
  const calls: RequestRecord[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const rec = Object.assign(url, { method: (init?.method ?? "GET").toUpperCase(), body: init?.body as string | undefined });
    calls.push(rec);
    const res = handler(rec);
    if (res === "network-error") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(res.body), {
      status: res.status ?? 200, headers: { "Content-Type": "application/json" },
    });
  });
  return calls;
}
