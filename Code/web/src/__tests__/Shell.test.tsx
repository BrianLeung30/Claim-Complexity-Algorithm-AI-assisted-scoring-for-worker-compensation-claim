import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import { mockBackend, weights } from "../test/fixtures";

describe("Application shell and settings summary", () => {
  it("shows navigation with the current page marked", async () => {
    mockBackend(() => "network-error");
    window.location.hash = "#/workload";
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Overview / Claim Scorer", "Workload Board", "Cost & Risk Insights", "Model Settings",
    ]);
    expect(within(nav).getByRole("link", { name: "Workload Board" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1, name: "Workload Board" })).toBeInTheDocument();
    expect(screen.queryByText("Coming next")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Model weights" })).toBeInTheDocument();
    expect(screen.getByText("Baseline · Early Data")).toBeInTheDocument();
    expect(screen.getByText("Penser")).toBeInTheDocument();
    expect(screen.getByText("Claims Intelligence")).toBeInTheDocument();
  });

  it("moves between pages from the sidebar, marking only the current page", async () => {
    const user = userEvent.setup();
    mockBackend(() => "network-error");
    window.location.hash = "#/";
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const current = () => within(nav).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent);
    expect(current()).toEqual(["Overview / Claim Scorer"]);
    for (const [label, heading] of [
      ["Workload Board", "Workload Board"], ["Cost & Risk Insights", "Cost & Risk Insights"],
      ["Model Settings", "Model Settings"], ["Overview / Claim Scorer", "Claim Scorer"],
    ]) {
      await user.click(within(nav).getByRole("link", { name: label }));
      expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      expect(current()).toEqual([label]);
    }
  });

  it("marks the active page with a darker navy background, not a red line", async () => {
    mockBackend(() => "network-error");
    window.location.hash = "#/insights";
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const active = within(nav).getByRole("link", { name: "Cost & Risk Insights" });
    expect(active).toHaveClass("bg-navy-800", "font-semibold", "text-white");
    expect(active.className).not.toMatch(/shadow|inset|accent|E53B45/);
    const other = within(nav).getByRole("link", { name: "Workload Board" });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other).not.toHaveClass("bg-navy-800");
    // status labels stay visible but are not warning-coloured
    const baseline = screen.getByText("Baseline · Early Data");
    expect(baseline).toHaveAttribute("title", expect.stringMatching(/not validated production predictions/));
    expect(baseline.className).not.toMatch(/accent|amber|red/);
  });

  it("dashboards only read from the backend on load", async () => {
    const calls = mockBackend((url) => (url.pathname === "/weights" ? { body: weights } : { status: 500, body: {} }));
    for (const hash of ["#/", "#/workload", "#/insights", "#/settings"]) {
      window.location.hash = hash;
      const { unmount } = render(<App />);
      await screen.findAllByRole("heading", { level: 1 });
      unmount();
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("shows the read-only weights summary", async () => {
    const calls = mockBackend((url) => (url.pathname === "/weights" ? { body: weights } : { status: 404, body: {} }));
    window.location.hash = "#/settings";
    render(<App />);
    const card = await screen.findByRole("region", { name: "Current settings" });
    const rows = within(card).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(within(card).getByText(/Weights are each factor's share of the complexity score/)).toBeInTheDocument();
    expect(rows[0]).toContain("Duration weight40%");
    expect(rows[1]).toContain("Medical intensity weight20%");
    expect(rows[2]).toContain("Time loss weight20%");
    expect(rows[3]).toContain("Legal weight20%");
    expect(rows[4]).toContain("Annual inflation rate3.5%");
    expect(rows[5]).toContain("P10–P90");
    expect(within(card).getAllByText("pending Penser").length).toBeGreaterThan(0);
    expect(screen.getByText(/Version 3/)).toBeInTheDocument();
    // 2B: the editor is on this page (four weight sliders + inflation); loading never writes
    expect(screen.getAllByRole("slider")).toHaveLength(5);
    expect(calls.every((u) => u.pathname === "/weights" && u.method === "GET")).toBe(true);
  });
});
