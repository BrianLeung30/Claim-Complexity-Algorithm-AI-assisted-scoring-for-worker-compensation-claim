import { PAGE_SIZE_OPTIONS } from "../lib/config";
import type { Pagination as PaginationInfo } from "../types/api";

interface Props {
  info: PaginationInfo;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

export function Pagination({ info, onPage, onPageSize }: Props) {
  const { page, page_size, total, total_pages } = info;
  const first = total === 0 ? 0 : (page - 1) * page_size + 1;
  const last = Math.min(page * page_size, total);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
      <p className="text-slate-600" aria-live="polite">
        {fmt(first)}–{fmt(last)} of {fmt(total)} claims
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-slate-600">
          Rows
          <select
            className="field-input w-auto py-1"
            value={page_size}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <span className="tabular-nums text-slate-600">
          Page {fmt(page)} of {fmt(Math.max(total_pages, 1))}
        </span>
        <button type="button" className="btn-secondary" onClick={() => onPage(page + 1)} disabled={page >= total_pages}>
          Next
        </button>
      </div>
    </nav>
  );
}
