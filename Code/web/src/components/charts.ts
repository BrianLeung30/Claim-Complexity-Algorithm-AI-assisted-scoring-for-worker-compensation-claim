// Chart components, kept separate so only the lazily loaded Insights page pulls in the
// charting library.
export { default as BarChart } from "@tremor/react/dist/components/chart-elements/BarChart/BarChart.js";
export { default as LineChart } from "@tremor/react/dist/components/chart-elements/LineChart/LineChart.js";

/**
 * One colour per measure, the same on every chart (colours live in tailwind.config.js and are
 * safelisted there). Restrained and checked for colour-vision deficiency on white.
 */
export const CHART_COLORS = {
  /** Baseline estimates: predicted median cost and average complexity. */
  estimate: "chart-estimate",
  /** Recorded incurred to date (paid plus reserves). */
  incurred: "chart-incurred",
  /** Final cost, closed claims only. */
  final: "chart-final",
  /** Illustrative inflation-adjusted incurred (not a model output). */
  illustrative: "chart-illustrative",
} as const;
