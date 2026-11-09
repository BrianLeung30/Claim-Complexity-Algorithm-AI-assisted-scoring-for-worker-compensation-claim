import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import { filterOptions, listItem, listResponse, mockBackend, weights } from "../test/fixtures";

function backend(listFor: (url: URL) => { status?: number; body: unknown } | "network-error", filters: "ok" | "down" = "ok") {
  return mockBackend((url) => {
    if (url.pathname === "/filters") return filters === "ok" ? { body: filterOptions } : { status: 500, body: {} };
    if (url.pathname === "/weights") return { body: weights };
    if (url.pathname === "/claims") return listFor(url);
    return { status: 404, body: { detail: "unexpected" } };
  });
}
const claimCalls = (calls: URL[]) => calls.filter((u) => u.pathname === "/claims");

describe("Claim Scorer", () => {
  it("renders the claim list with separate complexity and cost columns", async () => {
    const calls = backend(() => ({ body: listResponse([listItem(42), listItem(7, { complexity_score: 35 })], 1, 50, 2) }));
    render(<App />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    const first = within(rows[1]!);
    expect(first.getByRole("link", { name: "ClaimNum 00042" })).toHaveAttribute("href", "#/claims/ClaimNum%2000042");
    expect(first.getByText("38")).toHaveAttribute("data-band", "low");
    expect(first.getByText("$1,000 – $12,000")).toBeInTheDocument();
    expect(first.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("Baseline · Early Data")).toBeInTheDocument();
    // bands share the workload board's high threshold and are labelled as preliminary
    expect(screen.getByText("Complexity bands (preliminary, pending Penser approval): Low <40 · Medium 40–74 · High ≥75")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Baseline confidence" }))
      .toHaveAttribute("title", expect.stringMatching(/not a validated probability/));
    // default: highest complexity first, server-side
    const q = claimCalls(calls)[0]!.searchParams;
    expect(q.get("sort_by")).toBe("complexity");
    expect(q.get("order")).toBe("desc");
    expect(q.get("page")).toBe("1");
  });

  it("shows missing values as missing rather than zero", async () => {
    backend(() => ({ body: listResponse([listItem(1, {
      adjuster: null, complexity_score: null, cost_low: null, cost_median: null, cost_high: null, cost_confidence: null,
    })]) }));
    render(<App />);
    const row = within((await screen.findAllByRole("row"))[1]!);
    expect(row.queryByText("$0")).not.toBeInTheDocument();
    expect(row.queryByText("0%")).not.toBeInTheDocument();
    expect(row.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("sends search and filters to the backend and resets to page 1", async () => {
    const user = userEvent.setup();
    const calls = backend(() => ({ body: listResponse([listItem(42)]) }));
    render(<App />);
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Status"), "Reopened");
    await user.selectOptions(screen.getByLabelText("Loss type"), "Medical only");
    await screen.findByRole("option", { name: "Synthetic Employer A" });
    await user.selectOptions(screen.getByLabelText("Employer"), "Synthetic Employer A");
    await user.selectOptions(screen.getByLabelText("Adjuster"), "Adjuster 00901");
    await user.type(screen.getByLabelText("Claim number"), "00042");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(claimCalls(calls).at(-1)!.searchParams.get("search")).toBe("00042"));
    const q = claimCalls(calls).at(-1)!.searchParams;
    expect(q.get("status")).toBe("Reopened");
    expect(q.get("loss_type")).toBe("Medical only");
    expect(q.get("employer")).toBe("Synthetic Employer A");
    expect(q.get("adjuster")).toBe("Adjuster 00901");
    expect(q.get("page")).toBe("1");
    // all option lists come from GET /filters, not hardcoded values
    const opts = (label: string) => within(screen.getByLabelText(label)).getAllByRole("option").map((o) => o.textContent);
    expect(opts("Employer")).toEqual(["All employers", "Synthetic Employer A", "Synthetic Employer B"]);
    expect(opts("Status")).toEqual(["All statuses", ...filterOptions.statuses]);
    expect(opts("Loss type")).toEqual(["All loss types", ...filterOptions.loss_types]);
    expect(opts("Adjuster")).toEqual(["All adjusters", ...filterOptions.adjusters]);
  });

  it("falls back to text filters when filter options are unavailable", async () => {
    const user = userEvent.setup();
    const calls = backend(() => ({ body: listResponse([listItem(42)]) }), "down");
    render(<App />);
    await screen.findByRole("table");
    await waitFor(() => expect(screen.getByLabelText("Adjuster").tagName).toBe("INPUT"));
    await user.type(screen.getByLabelText("Adjuster"), "901");
    await user.type(screen.getByLabelText("Status"), "Open");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(claimCalls(calls).at(-1)!.searchParams.get("adjuster")).toBe("Adjuster 00901"));
    expect(claimCalls(calls).at(-1)!.searchParams.get("status")).toBe("Open");
  });

  it("previews complexity from sub-scores with unsaved weights, leaving cost unchanged", async () => {
    const user = userEvent.setup();
    const calls = backend(() => ({ body: listResponse([listItem(42)]) }));
    render(<App />);
    const row = within((await screen.findAllByRole("row"))[1]!);
    expect(row.getByText("38")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Model weights" }));
    const panel = await screen.findByRole("complementary", { name: "Model weights" });
    // weights 1,0,0,0 -> preview = duration sub-score (90)
    for (const k of ["Medical intensity", "Time loss", "Legal"]) {
      fireEvent.change(within(panel).getByLabelText(k), { target: { value: "0" } });
    }
    fireEvent.change(within(panel).getByLabelText("Duration"), { target: { value: "1" } });
    expect(row.getByTestId("complexity-preview")).toHaveTextContent("90");
    expect(row.getByTestId("complexity-preview")).toHaveTextContent("saved 38");
    expect(row.getByText("$1,000 – $12,000")).toBeInTheDocument();
    expect(screen.getByTestId("preview-banner")).toBeInTheDocument();
    // the list is not re-sorted by the preview, and says so
    expect(screen.getByTestId("preview-sort-note")).toHaveTextContent("Rows are still ordered by saved scores.");
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("shows a clear empty state when filters match nothing", async () => {
    const user = userEvent.setup();
    backend((url) => ({ body: url.searchParams.get("status") ? listResponse([], 1, 50, 0) : listResponse([listItem(1)]) }));
    render(<App />);
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Status"), "Pending");
    expect(await screen.findByText("No claims match these filters")).toBeInTheDocument();
  });

  it("paginates server-side", async () => {
    const user = userEvent.setup();
    const calls = backend((url) => {
      const page = Number(url.searchParams.get("page"));
      return { body: listResponse([listItem(page)], page, 50, 120) };
    });
    render(<App />);
    expect(await screen.findByText("1–50 of 120 claims")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("51–100 of 120 claims")).toBeInTheDocument();
    expect(claimCalls(calls).at(-1)!.searchParams.get("page")).toBe("2");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("101–120 of 120 claims")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Rows"), "25");
    await waitFor(() => expect(claimCalls(calls).at(-1)!.searchParams.get("page_size")).toBe("25"));
    expect(claimCalls(calls).at(-1)!.searchParams.get("page")).toBe("1");
  });

  it("sorts server-side when a column header is clicked", async () => {
    const user = userEvent.setup();
    const calls = backend(() => ({ body: listResponse([listItem(1)]) }));
    render(<App />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: /Est\. cost range/ }));
    await waitFor(() => expect(claimCalls(calls).at(-1)!.searchParams.get("sort_by")).toBe("cost"));
    expect(claimCalls(calls).at(-1)!.searchParams.get("order")).toBe("desc");
    await user.click(screen.getByRole("button", { name: /Est\. cost range/ }));
    await waitFor(() => expect(claimCalls(calls).at(-1)!.searchParams.get("order")).toBe("asc"));
    await user.click(screen.getByRole("button", { name: /Injury date/ }));
    await waitFor(() => expect(claimCalls(calls).at(-1)!.searchParams.get("sort_by")).toBe("injury_date"));
  });

  it("shows a connection error when the backend is unavailable, and retries", async () => {
    const user = userEvent.setup();
    let up = false;
    backend(() => (up ? { body: listResponse([listItem(42)]) } : "network-error"));
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Backend unavailable");
    expect(alert).toHaveTextContent("Cannot reach the claims service at http://127.0.0.1:8000");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    up = true;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows HTTP errors from the backend", async () => {
    backend(() => ({ status: 500, body: { detail: "boom" } }));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load data");
  });
});
