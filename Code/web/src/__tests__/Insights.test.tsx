import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import { analytics, analyticsGroup, mockBackend, weights } from "../test/fixtures";
import type { AnalyticsResponse, GroupBy } from "../types/api";

const byEmployer = analytics("employer", [
  analyticsGroup("Synthetic Employer A", { claim_count: 6, claims_with_estimates: 6, average_complexity: 60,
    total_predicted_median_cost: 1_500_000, total_incurred_to_date: 1_200_000, claims_with_financials: 5,
    total_final_cost: 700_000, closed_claims_with_final_cost: 3 }),
  analyticsGroup("Synthetic Employer B", { claim_count: 4, claims_with_estimates: 4, average_complexity: 40,
    total_predicted_median_cost: 250_000, total_incurred_to_date: null, claims_with_financials: 0,
    total_final_cost: null, closed_claims_with_final_cost: 0 }),
]);
const byYear = analytics("injury_year", [
  analyticsGroup(2023, { claim_count: 5, total_incurred_to_date: 900_000 }),
  analyticsGroup(2024, { claim_count: 5, total_incurred_to_date: 300_000 }),
]);

function setup(responses: Partial<Record<GroupBy, AnalyticsResponse | "error">> = {}) {
  const all = { employer: byEmployer, injury_year: byYear, tier_2: analytics("tier_2", []), loss_cause: byEmployer, ...responses };
  const calls = mockBackend((url) => {
    if (url.pathname === "/weights") return { body: weights };
    if (url.pathname === "/analytics") {
      const r = all[url.searchParams.get("group_by") as GroupBy];
      return r === "error" ? { status: 500, body: {} } : { body: r };
    }
    return { status: 404, body: {} };
  });
  window.location.hash = "#/insights";
  render(<App />);
  return calls;
}

describe("Cost & Risk Insights", () => {
  it("shows summary totals with incurred-to-date distinct from final cost", async () => {
    setup();
    expect(await screen.findByTestId("i-claims")).toHaveTextContent("10");
    expect(screen.getByTestId("i-complexity")).toHaveTextContent("52.0");          // (6*60 + 4*40) / 10
    expect(screen.getByTestId("i-predicted")).toHaveTextContent("$1.8M");
    expect(screen.getByText(/^\$1,750,000 · baseline estimates$/)).toBeInTheDocument();
    expect(screen.getByTestId("i-incurred")).toHaveTextContent("$1.2M");
    expect(screen.getByText(/Recorded, incl\. reserves · 5 of 10 claims/)).toBeInTheDocument();
    // final cost: closed claims only, and only where recorded
    expect(screen.getByTestId("i-final")).toHaveTextContent("$700K");
    expect(screen.getByText("3 closed claims with financials")).toBeInTheDocument();
  });

  it("labels predicted, incurred and final cost as different measures", async () => {
    setup();
    await screen.findByTestId("i-predicted");
    expect(screen.getByRole("button", { name: "About Predicted median (sum)" }))
      .toHaveAccessibleDescription(/Sum of each claim's baseline median cost estimate/);
    expect(screen.getByRole("button", { name: "About Incurred to date" }))
      .toHaveAccessibleDescription(/paid amounts plus outstanding reserves.*Not final for open claims/);
    expect(screen.getByRole("button", { name: "About Final cost (closed)" }))
      .toHaveAccessibleDescription(/closed claims.*not known for open claims/);
    expect(screen.getByText(/comparing them is not a test of model accuracy/)).toBeInTheDocument();
    expect(screen.getByTestId("i-predicted")).toHaveAttribute("title", "$1,750,000");
    expect(screen.getByTestId("i-incurred")).toHaveAttribute("title", "$1,200,000");
    // the table headers carry the same definitions
    const table = screen.getByRole("region", { name: "Summary by employer" });
    expect(within(table).getByRole("button", { name: /Incurred to date/ })).toHaveAccessibleDescription(/outstanding reserves/);
  });

  it("warns that analytics may mix settings versions once settings have been saved", async () => {
    setup();
    expect(await screen.findByTestId("mixed-versions")).toHaveTextContent(/Settings v3: saves recalculate only open and reopened claims/);
  });

  it("does not show the mixed-version note before any save", async () => {
    const first = structuredClone(weights);
    first.version = 1;
    mockBackend((url) => {
      if (url.pathname === "/weights") return { body: first };
      if (url.pathname === "/analytics") return { body: url.searchParams.get("group_by") === "injury_year" ? byYear : byEmployer };
      return { status: 404, body: {} };
    });
    window.location.hash = "#/insights";
    render(<App />);
    await screen.findByTestId("i-claims");
    expect(screen.queryByTestId("mixed-versions")).not.toBeInTheDocument();
  });

  it("shows exact values in a sortable table, missing financials as missing", async () => {
    const user = userEvent.setup();
    setup();
    const table = await screen.findByRole("region", { name: "Summary by employer" });
    const rows = () => within(table).getAllByTestId("insight-row");
    expect(rows()[0]).toHaveTextContent("Synthetic Employer A");
    expect(rows()[0]).toHaveTextContent("$1,200,000");
    expect(rows()[0]).toHaveTextContent("$700,000");
    expect(rows()[1]).toHaveTextContent("—");
    expect(rows()[1]).not.toHaveTextContent("$0");
    expect(rows()[1]).toHaveTextContent("No financial data");
    expect(rows()[0]).not.toHaveTextContent("No financial data");
    for (const h of ["Incurred to date", "Final cost (closed)", "Predicted median (sum)"]) {
      expect(within(table).getByRole("button", { name: new RegExp(h.replace(/[()]/g, "\\$&")) })).toBeInTheDocument();
    }
    await user.click(within(table).getByRole("button", { name: /Avg complexity/ }));
    expect(rows()[0]).toHaveTextContent("Synthetic Employer A");
    await user.click(within(table).getByRole("button", { name: /Avg complexity/ }));
    expect(rows()[0]).toHaveTextContent("Synthetic Employer B");
  });

  it("requests the selected grouping from the backend", async () => {
    const user = userEvent.setup();
    const calls = setup();
    await screen.findByTestId("i-claims");
    await user.click(screen.getByRole("radio", { name: "Loss cause" }));
    await waitFor(() => expect(calls.some((c) => c.searchParams.get("group_by") === "loss_cause")).toBe(true));
    expect(await screen.findByRole("region", { name: "Summary by loss cause" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Tier 2" }));
    expect(await screen.findByText("No claims to analyse")).toBeInTheDocument();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("shows injury-year trend and an illustrative inflation comparison", async () => {
    setup();
    expect(await screen.findByRole("region", { name: "Cost trend by injury year" })).toBeInTheDocument();
    const infl = screen.getByRole("region", { name: "Inflation comparison" });
    expect(within(infl).getByText("Illustrative · not a model setting")).toBeInTheDocument();
    expect(within(infl).getByTestId("ill-rate")).toHaveTextContent("3%");
    fireEvent.change(within(infl).getByLabelText("Illustrative annual rate"), { target: { value: "0.05" } });
    expect(within(infl).getByTestId("ill-rate")).toHaveTextContent("5%");
  });

  it("shows loading then error states", async () => {
    setup({ employer: "error" });
    expect(screen.getByText(/Loading insights/)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load data");
  });
});
