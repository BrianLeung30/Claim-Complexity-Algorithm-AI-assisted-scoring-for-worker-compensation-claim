import type { ClaimQuery } from "../types/api";

// Central UI settings. These are preliminary display choices, NOT approved complexity
// categories. Change them here only.

/** Shown wherever a threshold or band is displayed. */
export const THRESHOLD_STATUS = "preliminary, pending Penser approval";

export const COMPLEXITY_BANDS = {
  /**
   * score >= high → "High". Must equal high_complexity_threshold in config/workload.yaml so
   * every page agrees with the Workload Board; a frontend test checks that they match.
   */
  high: 75,
  /** score >= medium (and < high) → "Medium"; below → "Low". Display only. */
  medium: 40,
} as const;

export type ComplexityBand = "low" | "medium" | "high";

export function complexityBand(score: number): ComplexityBand {
  if (score >= COMPLEXITY_BANDS.high) return "high";
  if (score >= COMPLEXITY_BANDS.medium) return "medium";
  return "low";
}

/** Injury-year charts open on this many most recent injury years; "All years" shows the rest. */
export const RECENT_INJURY_YEARS = 6;

export const PAGE_SIZE_OPTIONS = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;

/** Default list view: highest complexity first. */
export const DEFAULT_QUERY: ClaimQuery = {
  search: "", status: "", loss_type: "", adjuster: "", employer: "",
  sort_by: "complexity", order: "desc", page: 1, page_size: DEFAULT_PAGE_SIZE,
};

export const SUBSCORE_LABELS = {
  duration: "Expected duration",
  medical_intensity: "Medical intensity",
  time_loss: "Time loss",
  legal: "Legal risk",
} as const;

export const WEIGHT_LABELS = {
  duration: "Duration",
  medical_intensity: "Medical intensity",
  time_loss: "Time loss",
  legal: "Legal",
} as const;

/** Adjuster IDs are tokenised as "Adjuster 00012"; a bare number is expanded to that form. */
export function normaliseAdjuster(input: string): string {
  const s = input.trim();
  return /^\d{1,5}$/.test(s) ? `Adjuster ${s.padStart(5, "0")}` : s;
}
