import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { hrefFor } from "../lib/router";
import { detail, mockBackend, weights } from "../test/fixtures";
import type { ClaimDetail } from "../types/api";

function openClaim(body: ClaimDetail | { detail: string }, status = 200) {
  const calls = mockBackend((url) => {
    if (url.pathname.startsWith("/claims/")) return { status, body };
    if (url.pathname === "/weights") return { body: weights };
    return { status: 404, body: {} };
  });
  window.location.hash = hrefFor.claim("ClaimNum 00042");
  render(<App />);
  return calls;
}

describe("Claim detail", () => {
  it("requests the claim by its exact number, leading zeros kept", async () => {
    const calls = openClaim(detail());
    await screen.findByText("Claim information");
    expect(calls[0]!.pathname).toBe("/claims/ClaimNum%2000042");
  });

  it("renders claim information, without descriptions", async () => {
    openClaim(detail());
    const info = await screen.findByRole("region", { name: "Claim information" });
    for (const t of ["ClaimNum 00042", "Adjuster 00901", "Synthetic Employer A", "Indemnity", "Mar 05, 2024", "Lifting", "Strain"]) {
      expect(within(info).getByText(t)).toBeInTheDocument();
    }
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  it("shows the overall complexity score separately from its four sub-scores and reasons", async () => {
    openClaim(detail());
    const card = await screen.findByRole("region", { name: "Complexity estimate" });
    expect(within(card).getByTestId("complexity-score")).toHaveTextContent("73");
    // 72.6 is below the High band (75, the workload threshold), so it is Medium
    expect(within(card).getByText(/Medium/)).toBeInTheDocument();
    expect(within(card).queryByText(/· High/)).not.toBeInTheDocument();
    expect(within(card).getByTestId("subscore-duration")).toHaveTextContent("81");
    expect(within(card).getByTestId("subscore-medical_intensity")).toHaveTextContent("65");
    expect(within(card).getByTestId("subscore-time_loss")).toHaveTextContent("55");
    expect(within(card).getByTestId("subscore-legal")).toHaveTextContent("12");
    for (const label of ["Expected duration", "Medical intensity", "Time loss", "Legal risk"]) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
    expect(within(card).getAllByRole("progressbar")).toHaveLength(4);
    const reasons = within(card).getByRole("list", { name: "Reason codes" });
    expect(within(reasons).getAllByRole("listitem")).toHaveLength(3);
    // cost is not inside the complexity card
    expect(within(card).queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("labels a score at the workload threshold as High", async () => {
    const d = detail();
    openClaim(detail({ complexity: { ...d.complexity!, score: 75 } }));
    const card = await screen.findByRole("region", { name: "Complexity estimate" });
    expect(within(card).getByText(/· High/)).toBeInTheDocument();
    expect(within(card).getByTitle("High complexity · score 75.0 (band preliminary, pending Penser approval)")).toBeInTheDocument();
  });

  it("bands on the unrounded score, as the workload board does, and shows the exact score on hover", async () => {
    const d = detail();
    openClaim(detail({ complexity: { ...d.complexity!, score: 74.6 } }));
    const card = await screen.findByRole("region", { name: "Complexity estimate" });
    expect(within(card).getByTestId("complexity-score")).toHaveTextContent("75");
    expect(within(card).getByTitle("Medium complexity · score 74.6 (band preliminary, pending Penser approval)")).toBeInTheDocument();
  });

  it("shows the cost estimate separately with formatted range and baseline confidence", async () => {
    openClaim(detail());
    const card = await screen.findByRole("region", { name: "Cost estimate" });
    expect(within(card).getByText("$850")).toBeInTheDocument();
    expect(within(card).getByText("$4,301")).toBeInTheDocument();
    expect(within(card).getByText("$26,750")).toBeInTheDocument();
    expect(within(card).getByText("Baseline confidence")).toBeInTheDocument();
    expect(within(card).getByTestId("cost-confidence")).toHaveTextContent("48%");
    expect(within(card).getByRole("img", { name: /Estimated cost range \$850 to \$26,750, median \$4,301/ })).toBeInTheDocument();
    expect(within(card).queryByText(/probability of/i)).not.toBeInTheDocument();
  });

  it("lists previous estimates newest first", async () => {
    openClaim(detail());
    const card = await screen.findByRole("region", { name: "Estimate history" });
    const rows = within(card).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Oct 15, 2026, 08:00 UTC");
    expect(rows[0]).toHaveTextContent("61");
    expect(rows[1]).toHaveTextContent("Oct 01, 2026, 08:00 UTC");
    expect(rows[1]).toHaveTextContent("$850 – $26,750");
    expect(screen.getByText(/Estimated Nov 02, 2026, 09:30 UTC · Settings v2/)).toBeInTheDocument();
  });

  it("shows a simple message when there is no previous estimate", async () => {
    openClaim(detail({ history: [] }));
    const card = await screen.findByRole("region", { name: "Estimate history" });
    expect(within(card).getByText(/No previous estimates/)).toBeInTheDocument();
    expect(within(card).queryByRole("table")).not.toBeInTheDocument();
  });

  it("handles missing financial records and missing estimates without showing zero", async () => {
    openClaim(detail({
      historical_costs: { has_financials: false, incurred_to_date: null, final_cost: null },
      complexity: null, cost: null, latest_estimate: null, history: [],
    }));
    expect(await screen.findByText("No financial record for this claim.")).toBeInTheDocument();
    expect(screen.getByText("No complexity estimate")).toBeInTheDocument();
    expect(screen.getByText("No cost estimate")).toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });

  it("distinguishes incurred-to-date from final cost", async () => {
    openClaim(detail({ historical_costs: { has_financials: true, incurred_to_date: 9000, final_cost: 9000 } }));
    const card = await screen.findByRole("region", { name: "Recorded financials" });
    expect(within(card).getAllByText("$9,000")).toHaveLength(2);
  });

  it("shows not found for an unknown claim", async () => {
    openClaim({ detail: "claim not found: ClaimNum 00042" }, 404);
    expect(await screen.findByText("No claim ClaimNum 00042")).toBeInTheDocument();
  });
});
