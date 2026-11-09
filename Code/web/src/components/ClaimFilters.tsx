import { useState, type FormEvent } from "react";
import { normaliseAdjuster } from "../lib/config";
import type { ClaimQuery, FilterOptions } from "../types/api";

type FilterKey = "search" | "status" | "loss_type" | "adjuster" | "employer";

interface Props {
  query: ClaimQuery;
  /** Distinct values from GET /filters; null while loading or if unavailable (text inputs are used). */
  options: FilterOptions | null;
  onChange: (changes: Partial<Pick<ClaimQuery, FilterKey>>) => void;
}

function SelectFilter({ id, label, all, value, values, onChange }: {
  id: string; label: string; all: string; value: string; values: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <select id={id} className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {values.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

function TextFilter({ id, label, value, placeholder, onChange }: {
  id: string; label: string; value: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} className="field-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Selects apply immediately; text fields apply on Enter or Apply. */
export function ClaimFilters({ query, options, onChange }: Props) {
  const [search, setSearch] = useState(query.search);
  const [text, setText] = useState({ status: query.status, loss_type: query.loss_type, adjuster: query.adjuster, employer: query.employer });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onChange(options
      ? { search: search.trim() }
      : { search: search.trim(), status: text.status.trim(), loss_type: text.loss_type.trim(),
          adjuster: normaliseAdjuster(text.adjuster), employer: text.employer.trim() });
  };
  const clear = () => {
    setSearch("");
    setText({ status: "", loss_type: "", adjuster: "", employer: "" });
    onChange({ search: "", status: "", loss_type: "", adjuster: "", employer: "" });
  };
  const active = Boolean(query.search || query.status || query.loss_type || query.adjuster || query.employer);
  const field = (key: "status" | "loss_type" | "adjuster" | "employer", label: string, all: string, values?: string[]) =>
    options && values
      ? <SelectFilter id={`f-${key}`} label={label} all={all} value={query[key]} values={values} onChange={(v) => onChange({ [key]: v })} />
      : <TextFilter id={`f-${key}`} label={label} value={text[key]} placeholder={label}
          onChange={(v) => setText((t) => ({ ...t, [key]: v }))} />;

  return (
    <form role="search" aria-label="Filter claims" onSubmit={submit}
      className="grid grid-cols-1 gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1.2fr_auto]">
      <div>
        <label htmlFor="f-search" className="field-label">Claim number</label>
        <input id="f-search" className="field-input" type="search" inputMode="numeric" placeholder="Search claim number"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {field("status", "Status", "All statuses", options?.statuses)}
      {field("loss_type", "Loss type", "All loss types", options?.loss_types)}
      {field("adjuster", "Adjuster", "All adjusters", options?.adjusters)}
      {field("employer", "Employer", "All employers", options?.employers)}
      <div className="flex items-end gap-2">
        <button type="submit" className="btn-primary">Apply</button>
        <button type="button" className="btn-secondary" onClick={clear} disabled={!active && !search}>
          Clear
        </button>
      </div>
    </form>
  );
}
