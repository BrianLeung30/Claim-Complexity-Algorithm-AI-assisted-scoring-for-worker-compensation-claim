import { ClaimFilters } from "../components/ClaimFilters";
import { ClaimsTable } from "../components/ClaimsTable";
import { Pagination } from "../components/Pagination";
import { SectionCard } from "../components/SectionCard";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { StatusLabel } from "../components/Badges";
import { COMPLEXITY_BANDS, THRESHOLD_STATUS } from "../lib/config";
import { useSettings } from "../lib/settingsContext";
import { useApi } from "../lib/useApi";
import { api, claimsQueryString } from "../services/api";
import type { ClaimQuery, FilterOptions, SortBy } from "../types/api";

const NO_OPTIONS: FilterOptions = { statuses: [], loss_types: [], adjusters: [], employers: [], claims_without_adjuster: 0 };

interface Props {
  query: ClaimQuery;
  setQuery: (q: ClaimQuery) => void;
}

export function ClaimScorerPage({ query, setQuery }: Props) {
  const { dataVersion, previewWeights } = useSettings();
  const claims = useApi((s) => api.listClaims(query, s), `${claimsQueryString(query)}#${dataVersion}`);
  const filters = useApi((s) => api.getFilters(s), "filters");

  const update = (changes: Partial<ClaimQuery>) => setQuery({ ...query, page: 1, ...changes });
  const onSort = (column: SortBy) =>
    update({ sort_by: column, order: query.sort_by === column && query.order === "desc" ? "asc" : "desc" });
  const filtered = Boolean(query.search || query.status || query.loss_type || query.adjuster || query.employer);

  return (
    <SectionCard
      title="Claims"
      flush
      aside={<>Complexity bands ({THRESHOLD_STATUS}): Low &lt;{COMPLEXITY_BANDS.medium} · Medium {COMPLEXITY_BANDS.medium}–{COMPLEXITY_BANDS.high - 1} · High ≥{COMPLEXITY_BANDS.high}</>}
    >
      <ClaimFilters key={filters.error ? "text" : "options"} query={query}
        options={filters.data ?? (filters.error ? null : NO_OPTIONS)} onChange={update} />
      {previewWeights && (
        <p className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600" data-testid="preview-sort-note">
          <StatusLabel tone="info">Weights preview</StatusLabel>
          Complexity shows the unsaved preview beside the saved score. Rows are still ordered by saved scores.
        </p>
      )}
      {claims.loading && !claims.data && <LoadingState label="Loading claims…" />}
      {claims.error && <div className="p-4"><ErrorState error={claims.error} onRetry={claims.reload} /></div>}
      {claims.data && !claims.error && (
        claims.data.items.length === 0 ? (
          <EmptyState
            title={filtered ? "No claims match these filters" : "No claims available"}
            detail={filtered ? "Change or clear the filters." : "Initialise the database, then reload."}
          />
        ) : (
          <div aria-busy={claims.loading} className={claims.loading ? "opacity-60" : undefined}>
            <ClaimsTable items={claims.data.items} sortBy={query.sort_by} order={query.order} onSort={onSort} />
            <Pagination
              info={claims.data.pagination}
              onPage={(page) => setQuery({ ...query, page })}
              onPageSize={(page_size) => update({ page_size })}
            />
          </div>
        )
      )}
    </SectionCard>
  );
}
