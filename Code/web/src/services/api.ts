// Thin client for the local FastAPI backend. No other network requests are made.
import type {
  AnalyticsResponse, ClaimDetail, ClaimListItem, ClaimListResponse, ClaimQuery, FilterOptions, GroupBy,
  Weights, WeightsResponse, WeightsUpdate, WeightsUpdateResponse, WorkloadResponse,
} from "../types/api";

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  readonly kind: "network" | "http";
  readonly status?: number;

  constructor(kind: "network" | "http", message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

async function request<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init, signal, headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("network", `Cannot reach the claims service at ${API_BASE_URL}.`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // body was not JSON; keep the status-only message
    }
    const message = res.status === 404 ? "Not found." : `Request failed (${res.status}).`;
    throw new ApiError("http", detail ? `${message} ${detail}` : message, res.status);
  }
  return (await res.json()) as T;
}

export function claimsQueryString(q: ClaimQuery): string {
  const p = new URLSearchParams();
  if (q.search.trim()) p.set("search", q.search.trim());
  if (q.status) p.set("status", q.status);
  if (q.loss_type) p.set("loss_type", q.loss_type);
  if (q.adjuster.trim()) p.set("adjuster", q.adjuster.trim());
  if (q.employer) p.set("employer", q.employer);
  p.set("sort_by", q.sort_by);
  p.set("order", q.order);
  p.set("page", String(q.page));
  p.set("page_size", String(q.page_size));
  return p.toString();
}

/** Read-only preview parameters (unsaved weights); empty when no preview is active. */
export function previewQuery(w: Weights | null): string {
  if (!w) return "";
  const p = new URLSearchParams();
  for (const k of ["duration", "medical_intensity", "time_loss", "legal"] as const) p.set(`w_${k}`, String(w[k]));
  return p.toString();
}

const ACTIVE_STATUSES = ["Open", "Reopened"];
const MAX_PAGE = 200;

/** All open and reopened claims for one adjuster (null = unassigned), fetched page by page. */
async function adjusterClaims(adjuster: string | null, signal?: AbortSignal): Promise<ClaimListItem[]> {
  const items: ClaimListItem[] = [];
  for (let page = 1; ; page++) {
    const p = new URLSearchParams();
    ACTIVE_STATUSES.forEach((s) => p.append("status", s));
    if (adjuster === null) p.set("unassigned", "true");
    else p.set("adjuster", adjuster);
    p.set("sort_by", "complexity");
    p.set("order", "desc");
    p.set("page", String(page));
    p.set("page_size", String(MAX_PAGE));
    const res = await request<ClaimListResponse>(`/claims?${p}`, signal);
    items.push(...res.items);
    if (page >= res.pagination.total_pages) return items;
  }
}

const withQuery = (path: string, qs: string) => (qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path);

export const api = {
  listClaims: (q: ClaimQuery, signal?: AbortSignal) =>
    request<ClaimListResponse>(`/claims?${claimsQueryString(q)}`, signal),
  getClaim: (claimNumber: string, signal?: AbortSignal) =>
    request<ClaimDetail>(`/claims/${encodeURIComponent(claimNumber)}`, signal),
  getFilters: (signal?: AbortSignal) => request<FilterOptions>("/filters", signal),
  getWeights: (signal?: AbortSignal) => request<WeightsResponse>("/weights", signal),
  /** The only write the frontend makes. Called only after explicit confirmation. */
  putWeights: (body: WeightsUpdate) =>
    request<WeightsUpdateResponse>("/weights", undefined, {
      method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
    }),
  getWorkload: (preview: Weights | null, signal?: AbortSignal) =>
    request<WorkloadResponse>(withQuery("/workload", previewQuery(preview)), signal),
  getAnalytics: (groupBy: GroupBy, preview: Weights | null, signal?: AbortSignal) =>
    request<AnalyticsResponse>(withQuery(`/analytics?group_by=${groupBy}`, previewQuery(preview)), signal),
  adjusterClaims,
};
