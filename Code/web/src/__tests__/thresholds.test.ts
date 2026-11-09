import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPLEXITY_BANDS, complexityBand } from "../lib/config";
import { workload } from "../test/fixtures";

// The repository's workload configuration (thresholds only; no claims data). Tests run from
// web/ (npm test); the second path covers running from the repository root.
const configPath = [resolve(process.cwd(), "../config/workload.yaml"), resolve(process.cwd(), "config/workload.yaml")]
  .find((p) => existsSync(p));
const workloadYaml = configPath ? readFileSync(configPath, "utf8") : "";

function yamlValue(key: string): number {
  const m = workloadYaml.match(new RegExp(`^${key}:\\s*\\n\\s+value:\\s*([\\d.]+)`, "m"));
  if (!m?.[1]) throw new Error(`${key} not found in config/workload.yaml`);
  return Number(m[1]);
}

describe("complexity thresholds", () => {
  it("uses the workload board's high-complexity threshold for the displayed High band", () => {
    expect(COMPLEXITY_BANDS.high).toBe(yamlValue("high_complexity_threshold"));
    expect(workloadYaml).toMatch(/high_complexity_threshold:[\s\S]*?approved_by: pending Penser/);
  });

  it("matches the synthetic workload fixture used by the dashboard tests", () => {
    const t = workload().thresholds.high_complexity_threshold.value;
    expect(complexityBand(t)).toBe("high");
    expect(complexityBand(t - 0.01)).toBe("medium");
  });
});
