// Response types mirroring backend/api.py exactly. Nullable fields are null when the
// backend has no value (for example claims without a financial record).

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** GET /claims item */
export interface ClaimListItem {
  claim_number: string;
  status: string | null;
  adjuster: string | null;
  employer: string | null;
  loss_type: string | null;
  injury_date: string | null; // YYYY-MM-DD
  complexity_score: number | null;
  cost_low: number | null;
  cost_median: number | null;
  cost_high: number | null;
  cost_confidence: number | null;
  subscores: Subscores | null;
}

export interface ClaimListResponse {
  items: ClaimListItem[];
  pagination: Pagination;
}

export interface Subscores {
  duration: number | null;
  medical_intensity: number | null;
  time_loss: number | null;
  legal: number | null;
}

export interface ComplexityEstimate {
  score: number | null;
  subscores: Subscores;
  reasons: string[];
}

export interface CostEstimate {
  low: number | null;
  median: number | null;
  high: number | null;
  confidence: number | null;
  dollar_year: number | null;
  reference_group: string | null;
  reference_level: string | null;
}

/** One record in GET /claims/{n} history */
export interface EstimateRecord {
  estimate_id: number;
  estimated_at: string | null; // ISO 8601 UTC, ends in Z
  weights_version: number;
  complexity: ComplexityEstimate;
  cost: CostEstimate;
}

export interface ClaimInfo {
  claim_number: string;
  status: string | null;
  adjuster: string | null;
  employer: string | null;
  insured_division: string | null;
  tier_2: string | null;
  loss_type: string | null;
  loss_cause: string | null;
  loss_nature: string | null;
  injury_date: string | null;
  injury_year: number | null;
}

export interface HistoricalCosts {
  has_financials: boolean;
  incurred_to_date: number | null;
  final_cost: number | null;
}

/** GET /claims/{claim_number} */
export interface ClaimDetail {
  claim: ClaimInfo;
  historical_costs: HistoricalCosts;
  complexity: ComplexityEstimate | null;
  cost: CostEstimate | null;
  latest_estimate: { estimate_id: number; estimated_at: string | null; weights_version: number } | null;
  history: EstimateRecord[]; // previous estimates only, newest first
}

export interface SettingEntry<T = number> {
  value: T;
  source: string;
  approved_by: string;
  note?: string;
}

/** GET /weights */
export interface WeightsResponse {
  version: number;
  updated_at: string | null;
  complexity_weights: {
    duration: SettingEntry;
    medical_intensity: SettingEntry;
    time_loss: SettingEntry;
    legal: SettingEntry;
  };
  annual_inflation_rate: SettingEntry;
  cost_range_percentiles: { low: SettingEntry; high: SettingEntry };
  limits: { complexity_weight_min: number; annual_inflation_rate_min: number; annual_inflation_rate_max: number };
}

export type WeightKey = "duration" | "medical_intensity" | "time_loss" | "legal";
export type Weights = Record<WeightKey, number>;

/** PUT /weights body: only changed settings are sent. */
export type WeightsUpdate = Partial<Weights> & { annual_inflation_rate?: number };

/** PUT /weights response */
export interface WeightsUpdateResponse {
  settings: WeightsResponse;
  claims_recalculated: number;
}

export type GroupBy = "employer" | "tier_2" | "loss_cause" | "injury_year";

export interface AnalyticsGroup {
  group: string | number | null;
  claim_count: number;
  claims_with_estimates: number;
  average_complexity: number | null;
  total_predicted_median_cost: number | null;
  claims_with_financials: number;
  total_incurred_to_date: number | null;
  closed_claims_with_final_cost: number;
  total_final_cost: number | null;
}

/** GET /analytics */
export interface AnalyticsResponse {
  group_by: GroupBy;
  preview_weights: Weights | null;
  definitions: Record<string, string>;
  groups: AnalyticsGroup[];
}

export interface ThresholdEntry {
  value: number;
  source: string;
  approved_by: string;
  note?: string;
}

export interface WorkloadRow {
  adjuster: string | null;
  unassigned: boolean;
  assigned_claims: number;
  total_complexity: number;
  average_complexity: number | null;
  high_complexity_claims: number;
  workload_warning: boolean;
  warning_reasons: string[];
}

/** GET /workload */
export interface WorkloadResponse {
  statuses_included: string[];
  team_median_total_complexity: number;
  thresholds: {
    high_complexity_threshold: ThresholdEntry;
    warning_load_ratio: ThresholdEntry;
    warning_high_claims: ThresholdEntry;
  };
  preview_weights: Weights | null;
  adjusters: WorkloadRow[];
}

/** GET /filters */
export interface FilterOptions {
  statuses: string[];
  loss_types: string[];
  adjusters: string[];
  employers: string[];
  claims_without_adjuster: number;
}

export type SortBy = "complexity" | "cost" | "injury_date";
export type SortOrder = "asc" | "desc";

export interface ClaimQuery {
  search: string;
  status: string;
  loss_type: string;
  adjuster: string;
  employer: string;
  sort_by: SortBy;
  order: SortOrder;
  page: number;
  page_size: number;
}
