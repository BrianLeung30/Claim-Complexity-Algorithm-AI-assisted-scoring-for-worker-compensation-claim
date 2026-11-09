import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import { filterOptions, listItem, listResponse, mockBackend, weights, workload, type RequestRecord } from "../test/fixtures";

const claims901 = [
  listItem(11, { complexity_score: 80, adjuster: "Adjuster 00901" }),
  listItem(12, { complexity_score: 90, adjuster: "Adjuster 00901" }),
  listItem(13, { complexity_score: 70, adjuster: "Adjuster 00901", status: "Reopened" }),
  listItem(14, { complexity_score: 80, adjuster: "Adjuster 00901" }),
];

function setup(over: Partial<{ workload: "ok" | "error"; claims: "ok" | "error" }> = {}) {
  const calls = mockBackend((url) => {
    if (url.pathname === "/weights") return { body: weights };
    if (url.pathname === "/filters") return { body: filterOptions };
    if (url.pathname === "/workload") return over.workload === "error" ? { status: 500, body: {} } : { body: workload() };
    if (url.pathname === "/claims") {
      return over.claims === "error" ? { status: 500, body: {} } : { body: listResponse(claims901, 1, 200, claims901.length) };
    }
    return { status: 404, body: {} };
  });
  window.location.hash = "#/workload";
  render(<App />);
  return calls;
}
const rowOf = (adj: string) => screen.getByTestId(`workload-row-${adj}`);
const noWrites = (calls: RequestRecord[]) => calls.every((c) => c.method === "GET");

async function openPanel(user: ReturnType<typeof userEvent.setup>, adjuster: string) {
  await user.click(await screen.findByRole("button", { name: adjuster }));
  return screen.findByRole("dialog", { name: adjuster });
}

describe("Workload Board", () => {
  it("shows summary totals that include unassigned claims", async () => {
    setup();
    expect(await screen.findByTestId("m-active")).toHaveTextContent("14");
    expect(screen.getByTestId("m-adjusters")).toHaveTextContent("3");
    expect(screen.getByTestId("m-total")).toHaveTextContent("710");
    expect(screen.getByTestId("m-warnings")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "About Adjusters with warnings" })).toHaveAccessibleDescription(/not individual performance/);
  });

  it("shows claim count beside total complexity, warnings and high indicators", async () => {
    setup();
    const r = await waitFor(() => rowOf("Adjuster 00901"));
    expect(within(r).getByText("320")).toBeInTheDocument();
    expect(within(r).getByText(/· 4 claims/)).toBeInTheDocument();
    expect(within(r).getByTestId("warning")).toHaveTextContent("total complexity above 1.25x the team median; 2+ high-complexity claims");
    expect(within(r).getByTestId("high")).toHaveTextContent("3");
    expect(within(rowOf("Adjuster 00902")).getByText("None")).toBeInTheDocument();
    expect(screen.getByText(/High ≥ 75 · warn above 1.25× team median \(200\) or 2\+ high · thresholds preliminary, pending Penser/)).toBeInTheDocument();
    // warning rows are not decorated with red row lines
    expect(r.className).not.toMatch(/inset|shadow|accent/);
  });

  it("lists unassigned claims separately", async () => {
    setup();
    const card = await screen.findByRole("region", { name: "Unassigned" });
    const r = within(card).getByTestId("workload-row-unassigned");
    expect(within(r).getByText("90")).toBeInTheDocument();
    expect(within(r).getByText("n/a")).toBeInTheDocument();
    const main = screen.getByRole("region", { name: "Adjuster workload" });
    expect(within(main).queryByTestId("workload-row-unassigned")).not.toBeInTheDocument();
  });

  it("sorts adjusters by any column", async () => {
    const user = userEvent.setup();
    setup();
    const main = await screen.findByRole("region", { name: "Adjuster workload" });
    const order = () => within(main).getAllByRole("row").slice(1).map((r) => r.getAttribute("data-testid"));
    expect(order()).toEqual(["workload-row-Adjuster 00901", "workload-row-Adjuster 00902", "workload-row-Adjuster 00903"]);
    await user.click(within(main).getByRole("button", { name: /^Claims/ }));
    expect(order()).toEqual(["workload-row-Adjuster 00902", "workload-row-Adjuster 00901", "workload-row-Adjuster 00903"]);
    await user.click(within(main).getByRole("button", { name: /^Claims/ }));
    expect(order()[0]).toBe("workload-row-Adjuster 00903");
  });

  it("opens a slide-out panel with the selected adjuster's details", async () => {
    const user = userEvent.setup();
    const calls = setup();
    const btn = await screen.findByRole("button", { name: "Adjuster 00901" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(btn);

    const panel = await screen.findByRole("dialog", { name: "Adjuster 00901" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByRole("heading", { name: "Adjuster 00901" })).toHaveFocus();
    expect(within(panel).getByRole("button", { name: "Close" })).toBeVisible();
    expect(within(panel).getByTestId("panel-claims")).toHaveTextContent("4");
    expect(within(panel).getByTestId("panel-total")).toHaveTextContent("320");
    expect(within(panel).getByTestId("panel-average")).toHaveTextContent("80.0");
    expect(within(panel).getByTestId("panel-high")).toHaveTextContent("3");
    expect(within(panel).getByTestId("panel-warning")).toHaveTextContent("total complexity above 1.25x the team median");
    expect(within(panel).getByText(/not a performance measure/)).toBeInTheDocument();

    const list = within(panel).getByRole("region", { name: "Assigned claims" });
    await waitFor(() => expect(within(list).getAllByTestId("adjuster-claim")).toHaveLength(4));
    const req = calls.filter((c) => c.pathname === "/claims").at(-1)!;
    expect(req.searchParams.get("adjuster")).toBe("Adjuster 00901");
    expect(req.searchParams.getAll("status")).toEqual(["Open", "Reopened"]);
    // each claim shows its complexity and estimated cost
    const first = within(list).getAllByTestId("adjuster-claim")[0]!;
    expect(within(first).getByRole("link", { name: "ClaimNum 00012" })).toHaveAttribute("href", "#/claims/ClaimNum%2000012");
    expect(first).toHaveTextContent("90");
    expect(first).toHaveTextContent("$1,000 – $12,000");
    // the old detail section at the bottom of the page is gone
    expect(screen.queryByRole("region", { name: /active claims/ })).not.toBeInTheDocument();
  });

  it("sorts the panel's claims by complexity and bands them with the workload threshold", async () => {
    const user = userEvent.setup();
    setup();
    const panel = await openPanel(user, "Adjuster 00901");
    const list = within(panel).getByRole("region", { name: "Assigned claims" });
    await waitFor(() => expect(within(list).getAllByTestId("adjuster-claim")).toHaveLength(4));
    const first = () => within(within(list).getAllByTestId("adjuster-claim")[0]!).getAllByRole("link")[0]!.textContent;
    expect(first()).toBe("ClaimNum 00012");
    await user.click(within(list).getByRole("button", { name: /Complexity/ }));
    expect(first()).toBe("ClaimNum 00013");
    // 80, 90 and 80 are >= 75 (config/workload.yaml); 70 is not. The badges agree with the board's High count.
    expect(within(list).getAllByTitle(/^High complexity/)).toHaveLength(3);
    expect(within(list).getAllByTitle(/^Medium complexity/)).toHaveLength(1);
    expect(within(panel).getByTestId("panel-high")).toHaveTextContent("3");
  });

  it("closes the panel with Close or Escape and returns focus to the adjuster", async () => {
    const user = userEvent.setup();
    setup();
    const btn = await screen.findByRole("button", { name: "Adjuster 00901" });
    await user.click(btn);
    const panel = await screen.findByRole("dialog", { name: "Adjuster 00901" });
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
    expect(btn).toHaveAttribute("aria-expanded", "false");

    await user.click(btn);
    await screen.findByRole("dialog", { name: "Adjuster 00901" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });

  it("updates the open panel when another adjuster is clicked", async () => {
    const user = userEvent.setup();
    setup();
    await openPanel(user, "Adjuster 00901");
    await user.click(screen.getByRole("button", { name: "Adjuster 00903" }));
    const panel = await screen.findByRole("dialog", { name: "Adjuster 00903" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(panel).getByRole("heading", { name: "Adjuster 00903" })).toHaveFocus();
    expect(within(panel).getByTestId("panel-claims")).toHaveTextContent("2");
    expect(within(panel).getByTestId("panel-total")).toHaveTextContent("100");
    expect(within(panel).queryByTestId("panel-warning")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjuster 00901" })).toHaveAttribute("aria-expanded", "false");
    // the Unassigned group opens the same panel
    await user.click(screen.getByRole("button", { name: "Unassigned" }));
    const un = await screen.findByRole("dialog", { name: "Unassigned" });
    expect(within(un).getByTestId("panel-claims")).toHaveTextContent("2");
  });

  it("simulates a reassignment inside the panel with before/after totals, then resets, without writing", async () => {
    const user = userEvent.setup();
    const calls = setup();
    const panel = await openPanel(user, "Adjuster 00901");
    const sim = within(panel).getByRole("region", { name: "Reassignment" });
    expect(within(sim).getByText("Simulation only")).toBeInTheDocument();
    await waitFor(() => expect(within(sim).getAllByRole("option").length).toBeGreaterThan(2));
    await user.selectOptions(within(sim).getByLabelText("Claim"), "ClaimNum 00012");
    await user.selectOptions(within(sim).getByLabelText("Destination adjuster"), "Adjuster 00903");
    expect(within(within(sim).getByLabelText("Destination adjuster")).queryByRole("option", { name: "Adjuster 00901" })).not.toBeInTheDocument();
    await user.click(within(sim).getByRole("button", { name: "Simulate" }));

    const cmp = within(sim).getByTestId("sim-comparison");
    expect(within(cmp).getByTestId("sim-source")).toHaveTextContent("4 → 3");
    expect(within(cmp).getByTestId("sim-source")).toHaveTextContent("320 → 230");
    expect(within(cmp).getByTestId("sim-destination")).toHaveTextContent("2 → 3");
    expect(within(cmp).getByTestId("sim-destination")).toHaveTextContent("100 → 190");
    // the board updates immediately and is marked as simulated; the panel keeps the actual workload
    expect(within(rowOf("Adjuster 00901")).getByTestId("total")).toHaveTextContent("230");
    expect(within(rowOf("Adjuster 00903")).getByTestId("total")).toHaveTextContent("190");
    expect(within(rowOf("Adjuster 00903")).getByText("Simulated")).toBeInTheDocument();
    expect(within(panel).getByTestId("panel-total")).toHaveTextContent("320");
    expect(screen.getByTestId("m-total")).toHaveTextContent("710");
    expect(screen.getByRole("status")).toHaveTextContent("Simulation only");

    await user.click(within(sim).getByRole("button", { name: "Reset" }));
    expect(within(rowOf("Adjuster 00901")).getByTestId("total")).toHaveTextContent("320");
    expect(within(rowOf("Adjuster 00903")).getByTestId("total")).toHaveTextContent("100");
    expect(within(sim).queryByTestId("sim-comparison")).not.toBeInTheDocument();
    expect(noWrites(calls)).toBe(true);
    expect(calls.some((c) => c.pathname.startsWith("/estimate"))).toBe(false);
  });

  it("keeps a simulation marked after the panel closes until it is reset, still without writing", async () => {
    const user = userEvent.setup();
    const calls = setup();
    const panel = await openPanel(user, "Adjuster 00901");
    const sim = within(panel).getByRole("region", { name: "Reassignment" });
    await waitFor(() => expect(within(sim).getAllByRole("option").length).toBeGreaterThan(2));
    await user.selectOptions(within(sim).getByLabelText("Claim"), "ClaimNum 00011");
    await user.selectOptions(within(sim).getByLabelText("Destination adjuster"), "Adjuster 00904");
    await user.click(within(sim).getByRole("button", { name: "Simulate" }));
    await user.click(within(panel).getByRole("button", { name: "Close" }));

    expect(screen.getByRole("status")).toHaveTextContent("Simulation only · totals include a simulated move of ClaimNum 00011");
    expect(within(rowOf("Adjuster 00901")).getByTestId("total")).toHaveTextContent("240");
    expect(within(rowOf("Adjuster 00904")).getByTestId("total")).toHaveTextContent("80");   // destination had no active claims
    await user.click(screen.getByRole("button", { name: "Reset simulation" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(within(rowOf("Adjuster 00901")).getByTestId("total")).toHaveTextContent("320");
    expect(screen.queryByTestId("workload-row-Adjuster 00904")).not.toBeInTheDocument();
    expect(noWrites(calls)).toBe(true);
  });

  it("shows a loading state, then an error state when the workload cannot load", async () => {
    setup({ workload: "error" });
    expect(screen.getByText("Loading workload…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load data");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows an error with retry inside the panel when an adjuster's claims cannot load", async () => {
    const user = userEvent.setup();
    setup({ claims: "error" });
    const panel = await openPanel(user, "Adjuster 00901");
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Could not load data");
    expect(within(panel).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // the workload summary in the panel still shows
    expect(within(panel).getByTestId("panel-claims")).toHaveTextContent("4");
  });
});
