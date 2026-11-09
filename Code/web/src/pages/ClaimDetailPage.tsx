import { ComplexityBadge, StatusBadge } from "../components/Badges";
import { CostRangeBar } from "../components/CostRangeBar";
import { EstimateHistory } from "../components/EstimateHistory";
import { SectionCard } from "../components/SectionCard";
import { SubscoreBars } from "../components/SubscoreBars";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { formatCurrency, formatDate, formatPercent, formatTimestamp, orMissing } from "../lib/format";
import { hrefFor } from "../lib/router";
import { useSettings } from "../lib/settingsContext";
import { useApi } from "../lib/useApi";
import { complexityFromSubscores } from "../lib/weights";
import { api, ApiError } from "../services/api";
import type { ClaimDetail, ComplexityEstimate, CostEstimate } from "../types/api";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-charcoal">{value}</dd>
    </div>
  );
}

function ClaimInformation({ d }: { d: ClaimDetail }) {
  const c = d.claim;
  return (
    <SectionCard title="Claim information">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Claim number" value={c.claim_number} />
        <Field label="Status" value={orMissing(c.status)} />
        <Field label="Adjuster" value={orMissing(c.adjuster)} />
        <Field label="Employer" value={orMissing(c.employer)} />
        <Field label="Division" value={orMissing(c.insured_division)} />
        <Field label="Tier 2" value={orMissing(c.tier_2)} />
        <Field label="Injury date" value={formatDate(c.injury_date)} />
        <Field label="Loss type" value={orMissing(c.loss_type)} />
        <Field label="Loss cause" value={orMissing(c.loss_cause)} />
        <Field label="Loss nature" value={orMissing(c.loss_nature)} />
      </dl>
    </SectionCard>
  );
}

function ComplexityCard({ complexity }: { complexity: ComplexityEstimate | null }) {
  const { previewWeights } = useSettings();
  const preview = complexity && previewWeights ? complexityFromSubscores(complexity.subscores, previewWeights) : null;
  const shown = preview ?? complexity?.score ?? null;
  return (
    <SectionCard title="Complexity estimate" aside="0–100 · higher is harder to manage">
      {!complexity || complexity.score === null ? (
        <EmptyState title="No complexity estimate" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="sm:border-r sm:border-slate-200 sm:pr-6">
            <p className="text-xs font-medium text-slate-500">{preview !== null ? "Preview score" : "Overall score"}</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums text-charcoal" data-testid="complexity-score">
              {Math.round(shown ?? 0)}
            </p>
            <div className="mt-2"><ComplexityBadge score={shown} showLabel /></div>
            {preview !== null && (
              <p className="mt-2 text-xs text-slate-500" data-testid="saved-score">Saved {Math.round(complexity.score)} · preview not saved</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Contributing sub-scores</p>
            <SubscoreBars subscores={complexity.subscores} />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Top reasons{preview !== null && " (saved estimate)"}</p>
            {complexity.reasons.length ? (
              <ol className="space-y-1 text-sm text-charcoal" aria-label="Reason codes">
                {complexity.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 shrink-0 tabular-nums text-slate-400">{i + 1}.</span>{r}
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-slate-500">No reason codes recorded.</p>}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function Amount({ label, value, strong = false }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 tabular-nums text-charcoal ${strong ? "text-2xl font-semibold" : "text-lg font-medium"}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function CostCard({ cost }: { cost: CostEstimate | null }) {
  const complete = cost && cost.low !== null && cost.median !== null && cost.high !== null;
  return (
    <SectionCard title="Cost estimate" aside={cost?.dollar_year ? `${cost.dollar_year} dollars` : undefined}>
      {!cost || !complete ? (
        <EmptyState title="No cost estimate" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Amount label="Low" value={cost.low} />
            <Amount label="Median" value={cost.median} strong />
            <Amount label="High" value={cost.high} />
          </div>
          <CostRangeBar low={cost.low!} median={cost.median!} high={cost.high!} />
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-charcoal" title="Heuristic from reference group size and spread; not a calibrated probability">
              Baseline confidence
            </span>
            <span className="text-lg font-semibold tabular-nums text-charcoal" data-testid="cost-confidence">
              {formatPercent(cost.confidence)}
            </span>
          </div>
          <p className="text-xs text-slate-500">Heuristic indicator, not a probability. Reference group: {orMissing(cost.reference_group)}.</p>
        </div>
      )}
    </SectionCard>
  );
}

function RecordedFinancials({ d }: { d: ClaimDetail }) {
  const h = d.historical_costs;
  const closed = h.final_cost !== null;
  return (
    <SectionCard title="Recorded financials">
      {!h.has_financials ? (
        <p className="text-sm text-slate-500">No financial record for this claim.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Incurred to date" value={formatCurrency(h.incurred_to_date)} />
          <Field label="Final cost" value={closed ? formatCurrency(h.final_cost) : "Not final"} />
        </dl>
      )}
    </SectionCard>
  );
}

export function ClaimDetailPage({ claimNumber }: { claimNumber: string }) {
  const { dataVersion } = useSettings();
  const { data, error, loading, reload } = useApi((s) => api.getClaim(claimNumber, s), `${claimNumber}#${dataVersion}`);
  const back = <a href={hrefFor.scorer} className="text-sm font-medium text-navy-700 hover:underline">← Back to claims</a>;

  if (loading) return <div>{back}<LoadingState label="Loading claim…" /></div>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="space-y-3">
        {back}
        {notFound ? <SectionCard title="Claim not found"><EmptyState title={`No claim ${claimNumber}`} /></SectionCard>
          : <ErrorState error={error} onRetry={reload} />}
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {back}
          <span className="text-slate-300" aria-hidden="true">|</span>
          <h2 className="text-xl font-semibold text-charcoal">{data.claim.claim_number}</h2>
          <StatusBadge status={data.claim.status} />
        </div>
        <p className="text-xs text-slate-500">
          {data.latest_estimate
            ? <>Estimated {formatTimestamp(data.latest_estimate.estimated_at)} · Settings v{data.latest_estimate.weights_version}</>
            : "No estimate yet"}
        </p>
      </div>
      <ClaimInformation d={data} />
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <ComplexityCard complexity={data.complexity} />
        <div className="space-y-4">
          <CostCard cost={data.cost} />
          <RecordedFinancials d={data} />
        </div>
      </div>
      <EstimateHistory history={data.history} />
    </div>
  );
}
