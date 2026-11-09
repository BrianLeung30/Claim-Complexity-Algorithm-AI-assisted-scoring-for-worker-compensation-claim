import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import { hrefFor } from "../lib/router";
import { detail, mockBackend, weights, workload, type RequestRecord } from "../test/fixtures";
import type { WeightsResponse } from "../types/api";

function saved(version: number): WeightsResponse {
  const w = structuredClone(weights);
  w.version = version;
  return w;
}

function setup(hash: string, put: "ok" | "fail" = "ok") {
  let current = saved(3);
  const calls = mockBackend((url) => {
    if (url.pathname === "/weights" && url.method === "PUT") {
      if (put === "fail") return { status: 422, body: { detail: "complexity weights must not sum to zero" } };
      current = saved(4);
      return { body: { settings: current, claims_recalculated: 17 } };
    }
    if (url.pathname === "/weights") return { body: current };
    if (url.pathname.startsWith("/claims/")) return { body: detail() };
    if (url.pathname === "/workload") return { body: workload() };
    return { status: 404, body: {} };
  });
  window.location.hash = hash;
  render(<App />);
  return calls;
}
const puts = (calls: RequestRecord[]) => calls.filter((c) => c.method === "PUT");
const panel = () => screen.getByRole("region", { name: "Edit settings" });
const slide = (label: string, value: string) => fireEvent.change(within(panel()).getByLabelText(label), { target: { value } });

describe("Model weights", () => {
  it("loads current settings with version, metadata and baseline status", async () => {
    setup("#/settings");
    await waitFor(() => expect(within(panel()).getByTestId("config-version")).toHaveTextContent("3"));
    expect(within(panel()).getByTestId("norm-duration")).toHaveTextContent("40%");
    expect(within(panel()).getByTestId("raw-legal")).toHaveTextContent("0.20");
    expect(within(panel()).getByTestId("inflation-value")).toHaveTextContent("3.5%");
    expect(within(panel()).getByTestId("baseline-status")).toHaveTextContent("Baseline placeholder · 5 of 5 pending Penser approval");
    expect(within(panel()).queryByText(/Approved by Penser/)).not.toBeInTheDocument();
    expect(within(panel()).getAllByText(/pending Penser/).length).toBeGreaterThan(1);
    const inf = within(panel()).getByLabelText("Annual inflation rate");
    expect(inf).toHaveAttribute("min", "0");
    expect(inf).toHaveAttribute("max", "0.25");
  });

  it("shows each weight as its share of the score, with raw values only under technical details", async () => {
    setup("#/settings");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    const shares = { duration: "40%", medical_intensity: "20%", time_loss: "20%", legal: "20%" };
    for (const [k, v] of Object.entries(shares)) expect(within(panel()).getByTestId(`norm-${k}`)).toHaveTextContent(v);
    // the share is the only number beside each slider label
    expect(within(panel()).getByTestId("norm-duration").parentElement).toHaveTextContent(/^Duration40%$/);
    expect(within(panel()).getByLabelText("Duration")).toHaveAttribute("aria-valuetext", "40% of the complexity score");
    // raw values sit in a collapsed technical details area
    const details = within(panel()).getByTestId("weights-technical");
    expect(details.tagName).toBe("DETAILS");
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("Technical details")).toBeInTheDocument();
    expect(within(details).getByTestId("raw-duration")).toHaveTextContent("0.40");
    expect(within(details).getByTestId("raw-legal")).toHaveTextContent("0.20");
  });

  it("never saves automatically while sliders move", async () => {
    const calls = setup("#/settings");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    slide("Duration", "0.61");
    slide("Legal", "0.05");
    slide("Annual inflation rate", "0.1");
    expect(within(panel()).getByTestId("norm-duration")).toHaveTextContent("57.5%");   // 0.61 / 1.06
    await new Promise((r) => setTimeout(r, 400));                                    // past every preview debounce
    expect(puts(calls)).toHaveLength(0);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(within(panel()).getByTestId("config-version")).toHaveTextContent("3");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an error with retry when settings cannot load", async () => {
    mockBackend(() => ({ status: 500, body: {} }));
    window.location.hash = "#/settings";
    render(<App />);
    expect(screen.getByText("Loading settings…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load data");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });

  it("updates values and normalised shares as sliders move, without saving", async () => {
    const calls = setup("#/settings");
    await waitFor(() => panel());
    await within(panel()).findByTestId("config-version");
    slide("Duration", "0.8");
    expect(within(panel()).getByTestId("raw-duration")).toHaveTextContent("0.80");
    expect(within(panel()).getByTestId("norm-duration")).toHaveTextContent("57.1%");   // 0.8 / 1.4
    expect(within(panel()).getByTestId("norm-legal")).toHaveTextContent("14.3%");
    expect(within(panel()).getByTestId("preview-active")).toBeInTheDocument();
    expect(screen.getByTestId("preview-banner")).toBeInTheDocument();
    slide("Annual inflation rate", "0.05");
    expect(within(panel()).getByTestId("inflation-value")).toHaveTextContent("5%");
    expect(puts(calls)).toHaveLength(0);
  });

  it("previews claim complexity immediately while cost stays unchanged", async () => {
    const calls = setup(hrefFor.claim("ClaimNum 00042"));
    expect(await screen.findByTestId("complexity-score")).toHaveTextContent("73");
    const cost = screen.getByRole("region", { name: "Cost estimate" }).textContent;
    await userEvent.setup().click(screen.getByRole("button", { name: "Model weights" }));
    const side = await screen.findByRole("complementary", { name: "Model weights" });
    await within(side).findByTestId("config-version");
    // only legal weight -> preview equals the legal sub-score (12.4 -> 12)
    for (const k of ["Duration", "Medical intensity", "Time loss"]) fireEvent.change(within(side).getByLabelText(k), { target: { value: "0" } });
    expect(screen.getByTestId("complexity-score")).toHaveTextContent("12");
    expect(screen.getByTestId("saved-score")).toHaveTextContent("Saved 73");
    expect(screen.getByRole("region", { name: "Cost estimate" }).textContent).toBe(cost);
    expect(puts(calls)).toHaveLength(0);
    expect(calls.some((c) => c.pathname.startsWith("/estimate"))).toBe(false);
  });

  it("sends preview weights to the read-only workload request, never a save", async () => {
    const calls = setup("#/workload");
    await screen.findByTestId("m-total");
    await userEvent.setup().click(screen.getByRole("button", { name: "Model weights" }));
    const side = await screen.findByRole("complementary", { name: "Model weights" });
    await within(side).findByTestId("config-version");
    fireEvent.change(within(side).getByLabelText("Duration"), { target: { value: "1" } });
    await waitFor(() => expect(calls.some((c) => c.pathname === "/workload" && c.searchParams.has("w_duration"))).toBe(true));
    const req = calls.filter((c) => c.pathname === "/workload" && c.searchParams.has("w_duration")).at(-1)!;
    const w = ["duration", "medical_intensity", "time_loss", "legal"].map((k) => Number(req.searchParams.get(`w_${k}`)));
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(w[0]).toBeCloseTo(1 / 1.6);
    expect(req.method).toBe("GET");
    expect(puts(calls)).toHaveLength(0);
  });

  it("resets the draft back to the saved settings", async () => {
    const user = userEvent.setup();
    const calls = setup("#/settings");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    slide("Legal", "1");
    slide("Annual inflation rate", "0.05");
    expect(screen.getByTestId("preview-banner")).toBeInTheDocument();
    expect(within(panel()).getByTestId("preview-active")).toHaveTextContent("Claim list order and reason codes still come from the saved estimates.");
    expect(within(panel()).getByTestId("norm-legal")).toHaveTextContent("55.6%");   // 1 / 1.8
    await user.click(within(panel()).getByRole("button", { name: "Reset" }));
    expect(within(panel()).getByTestId("raw-legal")).toHaveTextContent("0.20");
    expect(within(panel()).getByTestId("norm-legal")).toHaveTextContent("20%");
    expect(within(panel()).getByTestId("inflation-value")).toHaveTextContent("3.5%");
    expect(screen.queryByTestId("preview-banner")).not.toBeInTheDocument();
    expect(within(panel()).queryByTestId("preview-active")).not.toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(panel()).getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(puts(calls)).toHaveLength(0);
  });

  it("asks for confirmation, saves with PUT and shows the new version", async () => {
    const user = userEvent.setup();
    const calls = setup("#/settings");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    slide("Duration", "0.7");
    slide("Medical intensity", "0.1");
    slide("Time loss", "0.1");
    slide("Legal", "0.1");
    await user.click(within(panel()).getByRole("button", { name: "Save" }));
    const dialog = screen.getByRole("dialog", { name: "Save model settings?" });
    expect(dialog).toHaveTextContent("Updates the local model settings file.");
    expect(dialog).toHaveTextContent("Previous estimates are kept.");
    expect(puts(calls)).toHaveLength(0);                                   // nothing until confirmed
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(puts(calls)).toHaveLength(0);
    await user.click(within(panel()).getByRole("button", { name: "Save" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save settings" }));
    expect(await within(panel()).findByRole("status")).toHaveTextContent("Saved as version 4 · 17 open and reopened claims recalculated");
    expect(puts(calls)).toHaveLength(1);
    expect(JSON.parse(puts(calls)[0]!.body!)).toEqual({ duration: 0.7, medical_intensity: 0.1, time_loss: 0.1, legal: 0.1 });
    await waitFor(() => expect(within(panel()).getByTestId("config-version")).toHaveTextContent("4"));
    expect(screen.getByText(/Version 4/)).toBeInTheDocument();                // read-only summary refreshed
    expect(within(panel()).getByTestId("baseline-status")).toHaveTextContent("pending Penser approval");
  });

  it("sends only the inflation rate when only inflation changed", async () => {
    const user = userEvent.setup();
    const calls = setup("#/settings");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    slide("Annual inflation rate", "0.05");
    await user.click(within(panel()).getByRole("button", { name: "Save" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save settings" }));
    await within(panel()).findByRole("status");
    expect(JSON.parse(puts(calls)[0]!.body!)).toEqual({ annual_inflation_rate: 0.05 });
  });

  it("shows a failed save and keeps the draft", async () => {
    const user = userEvent.setup();
    setup("#/settings", "fail");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    slide("Duration", "0.9");
    await user.click(within(panel()).getByRole("button", { name: "Save" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save settings" }));
    expect(await within(panel()).findByRole("alert")).toHaveTextContent("Save failed.");
    expect(within(panel()).getByTestId("raw-duration")).toHaveTextContent("0.90");
    expect(within(panel()).getByTestId("config-version")).toHaveTextContent("3");
  });

  it("blocks saving all-zero weights", async () => {
    const calls = setup("#/settings");
    await within(await waitFor(() => panel())).findByTestId("config-version");
    for (const k of ["Duration", "Medical intensity", "Time loss", "Legal"]) slide(k, "0");
    expect(within(panel()).getByRole("alert")).toHaveTextContent("Weights cannot all be zero.");
    expect(within(panel()).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByTestId("preview-banner")).not.toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });
});
