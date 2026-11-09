import type { Subscores, WeightKey, Weights, WeightsResponse } from "../types/api";

export const WEIGHT_KEYS: WeightKey[] = ["duration", "medical_intensity", "time_loss", "legal"];

export function savedWeights(s: WeightsResponse): Weights {
  const w = s.complexity_weights;
  return { duration: w.duration.value, medical_intensity: w.medical_intensity.value, time_loss: w.time_loss.value, legal: w.legal.value };
}

/** Weights scaled to sum to 1, or null when they sum to zero (invalid). */
export function normalise(w: Weights): Weights | null {
  const total = WEIGHT_KEYS.reduce((s, k) => s + w[k], 0);
  if (!(total > 0)) return null;
  return {
    duration: w.duration / total, medical_intensity: w.medical_intensity / total,
    time_loss: w.time_loss / total, legal: w.legal / total,
  };
}

export function sameWeights(a: Weights | null, b: Weights | null, tol = 1e-6): boolean {
  if (!a || !b) return a === b;
  return WEIGHT_KEYS.every((k) => Math.abs(a[k] - b[k]) <= tol);
}

/**
 * Complexity from the four sub-scores: the weighted average used by the backend
 * (models/baseline.py score(): sum(w * s) / sum(w), clipped to 0-100).
 * Returns null when any sub-score is missing, so no value is invented.
 */
export function complexityFromSubscores(s: Subscores | null | undefined, w: Weights): number | null {
  if (!s) return null;
  const total = WEIGHT_KEYS.reduce((acc, k) => acc + w[k], 0);
  if (!(total > 0)) return null;
  let sum = 0;
  for (const k of WEIGHT_KEYS) {
    const v = s[k];
    if (v === null || v === undefined) return null;
    sum += w[k] * v;
  }
  return Math.min(100, Math.max(0, sum / total));
}

/** Baseline status label. Never reports approval unless every entry was approved by Penser. */
export function approvalStatus(s: WeightsResponse): { approved: boolean; label: string } {
  const entries = [...WEIGHT_KEYS.map((k) => s.complexity_weights[k]), s.annual_inflation_rate];
  // Only an explicit Penser approval counts; anything else (e.g. "pending Penser", "TBD") is pending.
  const isApproved = (v: string) => /penser/i.test(v) && !/pending|not|un/i.test(v);
  const pending = entries.filter((e) => !isApproved(e.approved_by));
  return pending.length === 0
    ? { approved: true, label: "Approved by Penser" }
    : { approved: false, label: `Baseline placeholder · ${pending.length} of ${entries.length} pending Penser approval` };
}
