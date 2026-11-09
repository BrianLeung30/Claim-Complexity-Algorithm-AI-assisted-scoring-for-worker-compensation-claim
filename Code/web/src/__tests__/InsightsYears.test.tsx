import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { analytics, analyticsGroup, mockBackend, weights } from "../test/fixtures";
import type { AnalyticsGroup } from "../types/api";

// jsdom cannot lay out charts, so the chart components are replaced by a list of exactly the
// data points each chart receives ("year: value | value", null where a value is missing).
vi.mock("../components/charts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/charts")>();
  const { createElement: h } = await import("react");
  const show = (v: unknown) => (v === null ? "null" : v === undefined ? "undefined" : String(v));
  function ChartStub({ data, index, categories }: { data: Record<string, unknown>[]; index: string; categories: string[] }) {
    return h("ol", { "data-testid": "chart-data", "aria-label": categories.join(", ") },
      data.map((d) => h("li", { key: String(d[index]) }, `${String(d[index])}: ${categories.map((c) => show(d[c])).join(" | ")}`)));
  }
  return { ...actual, BarChart: ChartStub, LineChart: ChartStub };
});

const none: Partial<AnalyticsGroup> = {
  claims_with_financials: 0, total_incurred_to_date: null, closed_claims_with_final_cost: 0, total_final_cost: null,
};
const year = (y: number, o: Partial<AnalyticsGroup> = {}) =>
  analyticsGroup(y, { claim_count: 4, claims_with_estimates: 4, total_predicted_median_cost: y * 10, ...o });

// Synthetic years, deliberately out of order: old years without financial records, a year whose
// recorded amounts are genuinely $0, recent years with data, and claims without an injury year.
const byYear = analytics("injury_year", [
  year(2025, { total_incurred_to_date: 500_000, total_final_cost: 100_000 }),
  year(1994, none),
  year(2012, none),
  year(2019, none),
  year(2020, { claims_with_financials: 1, total_incurred_to_date: 0, closed_claims_with_final_cost: 1, total_final_cost: 0 }),
  year(2021), year(2022), year(2023), year(2024),
  analyticsGroup(null, { claim_count: 2, claims_with_estimates: 2 }),
]);
const byEmployer = analytics("employer", [analyticsGroup("Synthetic Employer A")]);

function setup(years: "ok" | "error" = "ok") {
  const calls = mockBackend((url) => {
    if (url.pathname === "/weights") return { body: weights };
    if (url.pathname === "/analytics") {
      if (url.searchParams.get("group_by") !== "injury_year") return { body: byEmployer };
      return years === "error" ? { status: 500, body: {} } : { body: byYear };
    }
    return { status: 404, body: {} };
  });
  window.location.hash = "#/insights";
  render(<App />);
  return calls;
}

const points = async (title: string) => {
  const card = await screen.findByRole("region", { name: title });
  return within(card).findByTestId("chart-data");
};
const yearsIn = (chart: HTMLElement) => within(chart).getAllByRole("listitem").map((li) => li.textContent!.split(":")[0]);
const RECENT = ["2020", "2021", "2022", "2023", "2024", "2025"];

describe("Injury-year charts", () => {
  it("open on the six most recent injury years", async () => {
    setup();
    expect(yearsIn(await points("Cost trend by injury year"))).toEqual(RECENT);
    expect(yearsIn(await points("Inflation comparison"))).toEqual(RECENT);
    expect(screen.getByRole("radio", { name: "Recent years" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "All years" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("year-span")).toHaveTextContent("Showing 2020–2025 · 6 of 9 injury years");
    // every recent year has financial data, so no missing-data note for them
    expect(screen.getByTestId("year-notes")).not.toHaveTextContent("No financial data");
    expect(screen.getByTestId("year-notes")).toHaveTextContent("2 claims without an injury year are not charted.");
  });

  it("show every injury year, oldest included, under All years, and switch back", async () => {
    const user = userEvent.setup();
    const calls = setup();
    const trend = await points("Cost trend by injury year");
    const requests = calls.length;
    await user.click(screen.getByRole("radio", { name: "All years" }));
    const all = ["1994", "2012", "2019", ...RECENT];
    expect(yearsIn(trend)).toEqual(all);
    expect(yearsIn(await points("Inflation comparison"))).toEqual(all);
    expect(screen.getByTestId("year-span")).toHaveTextContent("Showing 1994–2025 · 9 of 9 injury years");
    await user.click(screen.getByRole("radio", { name: "Recent years" }));
    expect(yearsIn(trend)).toEqual(RECENT);
    // the view only filters what is already loaded: no new requests, never a write
    expect(calls.length).toBe(requests);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("can be switched with the arrow keys", async () => {
    const user = userEvent.setup();
    setup();
    const trend = await points("Cost trend by injury year");
    screen.getByRole("radio", { name: "Recent years" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "All years" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "All years" })).toHaveFocus();
    expect(yearsIn(trend)).toHaveLength(9);
  });

  it("keep missing money missing and recorded $0 as $0", async () => {
    const user = userEvent.setup();
    setup();
    const trend = await points("Cost trend by injury year");
    await user.click(screen.getByRole("radio", { name: "All years" }));
    const trendRow = (y: string) => within(trend).getAllByRole("listitem").find((li) => li.textContent!.startsWith(`${y}:`))!;
    // categories: Incurred to date | Final cost (closed) | Predicted median (sum)
    expect(trendRow("1994")).toHaveTextContent("1994: null | null | 19940");   // no financial record: a gap, not 0
    expect(trendRow("2020")).toHaveTextContent("2020: 0 | 0 | 20200");          // recorded $0 stays 0
    expect(trendRow("2025")).toHaveTextContent("2025: 500000 | 100000 | 20250");
    const infl = await points("Inflation comparison");
    const inflRow = (y: string) => within(infl).getAllByRole("listitem").find((li) => li.textContent!.startsWith(`${y}:`))!;
    expect(inflRow("1994")).toHaveTextContent("1994: null | null");
    expect(inflRow("2020")).toHaveTextContent("2020: 0 | 0");
    expect(screen.getByTestId("year-notes")).toHaveTextContent(
      "No financial data for 3 of 9 years shown; incurred and final cost are left blank there, not $0.");

    // the exact values stay available in the summary table
    await user.click(screen.getByRole("radio", { name: "Injury year" }));
    const table = await screen.findByRole("region", { name: "Summary by injury year" });
    const row = (y: string) => within(table).getAllByTestId("insight-row").find((r) => r.textContent!.startsWith(y))!;
    expect(row("1994")).toHaveTextContent("No financial data");
    expect(row("1994")).toHaveTextContent("—");
    expect(row("1994")).not.toHaveTextContent("$0");
    expect(row("2020")).toHaveTextContent("$0");
    expect(row("2020")).not.toHaveTextContent("No financial data");
    expect(within(table).getByText("A dash means no recorded amount, never $0. Recorded zero amounts show as $0.")).toBeInTheDocument();
  });

  it("use one colour and one name per measure across the charts", async () => {
    setup();
    await points("Cost trend by injury year");
    expect(screen.getByRole("list", { name: "Incurred to date, Final cost (closed), Predicted median (sum)" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Incurred to date, Illustrative at 3%" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Predicted median (sum), Incurred to date" })).toBeInTheDocument();
  });

  it("show an error with retry when injury years cannot load, leaving the rest of the page", async () => {
    setup("error");
    const trend = await screen.findByRole("region", { name: "Cost trend by injury year" });
    expect(await within(trend).findByRole("alert")).toHaveTextContent("Could not load data");
    expect(within(trend).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    const infl = screen.getByRole("region", { name: "Inflation comparison" });
    expect(within(infl).getByText("Injury-year data could not be loaded.")).toBeInTheDocument();
    expect(screen.getByTestId("i-claims")).toHaveTextContent("10");
    expect(screen.queryByTestId("year-span")).not.toBeInTheDocument();
  });
});
