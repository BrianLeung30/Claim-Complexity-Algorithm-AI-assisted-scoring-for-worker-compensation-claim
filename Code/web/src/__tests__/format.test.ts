import { describe, expect, it } from "vitest";
import { complexityBand, normaliseAdjuster } from "../lib/config";
import {
  formatCostRange, formatCurrency, formatDate, formatFraction, formatPercent, formatScore, formatTimestamp, MISSING,
} from "../lib/format";
import { parseRoute, hrefFor } from "../lib/router";
import { claimsQueryString } from "../services/api";

describe("formatting", () => {
  it("formats dollars consistently as whole dollars", () => {
    expect(formatCurrency(2500.4)).toBe("$2,500");
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCostRange(1000, 12000)).toBe("$1,000 – $12,000");
  });

  it("shows missing values as missing, never zero", () => {
    expect(formatCurrency(null)).toBe(MISSING);
    expect(formatCostRange(null, 5)).toBe(MISSING);
    expect(formatScore(null)).toBe(MISSING);
    expect(formatPercent(undefined)).toBe(MISSING);
    expect(formatDate(null)).toBe(MISSING);
    expect(formatTimestamp(null)).toBe(MISSING);
  });

  it("formats scores, percents, fractions and dates", () => {
    expect(formatScore(72.6)).toBe("73");
    expect(formatPercent(43.2)).toBe("43%");
    expect(formatFraction(0.25)).toBe("25%");
    expect(formatFraction(0.035)).toBe("3.5%");
    expect(formatDate("2024-03-05")).toBe("Mar 05, 2024");
    expect(formatTimestamp("2026-11-02T09:30:00Z")).toBe("Nov 02, 2026, 09:30 UTC");
  });
});

describe("helpers", () => {
  it("bands complexity using the central thresholds", () => {
    expect(complexityBand(10)).toBe("low");
    expect(complexityBand(39.9)).toBe("low");
    expect(complexityBand(40)).toBe("medium");
    expect(complexityBand(70)).toBe("medium");
    expect(complexityBand(74.9)).toBe("medium");
    expect(complexityBand(75)).toBe("high");
    expect(complexityBand(100)).toBe("high");
  });

  it("expands bare adjuster numbers to the token form", () => {
    expect(normaliseAdjuster("12")).toBe("Adjuster 00012");
    expect(normaliseAdjuster("Adjuster 00012")).toBe("Adjuster 00012");
  });

  it("keeps claim numbers as strings with leading zeros through routing", () => {
    const href = hrefFor.claim("ClaimNum 00042");
    expect(parseRoute(href)).toEqual({ page: "claim", claimNumber: "ClaimNum 00042" });
  });

  it("builds server-side query parameters", () => {
    const qs = claimsQueryString({
      search: " 00042 ", status: "Open", loss_type: "", adjuster: "", employer: "Synthetic Employer A",
      sort_by: "cost", order: "asc", page: 2, page_size: 25,
    });
    expect(Object.fromEntries(new URLSearchParams(qs))).toEqual({
      search: "00042", status: "Open", employer: "Synthetic Employer A",
      sort_by: "cost", order: "asc", page: "2", page_size: "25",
    });
  });
});
