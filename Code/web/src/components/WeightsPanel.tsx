import { Fragment, useState } from "react";
import { WEIGHT_LABELS } from "../lib/config";
import { formatFraction, formatTimestamp, MISSING } from "../lib/format";
import { useSettings } from "../lib/settingsContext";
import { approvalStatus, normalise, WEIGHT_KEYS } from "../lib/weights";
import { StatusLabel } from "./Badges";
import { ConfirmDialog } from "./ConfirmDialog";
import { WarningIcon } from "./Icons";
import { ErrorState, LoadingState } from "./StateViews";

const SLIDER_MAX = 1; // UI range for raw weights; the backend normalises any non-negative values

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "done"; version: number; recalculated: number } | { kind: "error"; message: string };

/** Shared complexity-weights panel. Sliders only change a local preview; Save is explicit. */
export function WeightsPanel() {
  const s = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  if (s.loading && !s.saved) return <LoadingState label="Loading settings…" />;
  if (s.error && !s.saved) return <ErrorState error={s.error} onRetry={s.reloadSaved} />;
  if (!s.saved || !s.draftWeights || s.draftInflation === null) return null;

  const saved = s.saved;
  const draft = s.draftWeights;
  const norm = normalise(draft);
  const status = approvalStatus(saved);
  const changed = s.weightsChanged || s.inflationChanged;
  const infMax = saved.limits.annual_inflation_rate_max;
  const infMin = saved.limits.annual_inflation_rate_min;

  const doSave = async () => {
    setState({ kind: "saving" });
    try {
      const res = await s.save();
      setState({ kind: "done", version: res.settings.version, recalculated: res.claims_recalculated });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5" aria-label="Model weights editor">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-600">
          Version <span className="font-semibold text-charcoal" data-testid="config-version">{saved.version}</span>
          {saved.updated_at && <> · updated {formatTimestamp(saved.updated_at)}</>}
        </span>
        <StatusLabel tone={status.approved ? "info" : "neutral"} testId="baseline-status">{status.label}</StatusLabel>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">Complexity weights</legend>
        <p className="mb-3 mt-1 text-xs text-slate-500">Each factor's share of the complexity score. Shares always total 100%.</p>
        <ul className="space-y-4">
          {WEIGHT_KEYS.map((k) => {
            const id = `w-${k}`;
            const entry = saved.complexity_weights[k];
            const share = norm ? formatFraction(norm[k]) : MISSING;
            return (
              <li key={k}>
                <div className="flex items-baseline justify-between">
                  <label htmlFor={id} className="text-sm text-charcoal">{WEIGHT_LABELS[k]}</label>
                  <span className="text-base font-semibold tabular-nums text-charcoal" data-testid={`norm-${k}`}>{share}</span>
                </div>
                <input id={id} type="range" min={saved.limits.complexity_weight_min} max={SLIDER_MAX} step={0.01}
                  value={draft[k]} onChange={(e) => s.setWeight(k, Number(e.target.value))}
                  aria-valuetext={norm ? `${share} of the complexity score` : undefined}
                  className="mt-1 w-full accent-navy-700" />
                <p className="text-xs text-slate-500">{entry.source} · {entry.approved_by}</p>
              </li>
            );
          })}
        </ul>
        <details className="mt-3 text-xs text-slate-600" data-testid="weights-technical">
          <summary className="cursor-pointer select-none text-slate-500 hover:text-charcoal">Technical details</summary>
          <p className="mt-2 text-slate-500">Raw slider values. Shares are each value divided by their total; Save stores the shares.</p>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
            {WEIGHT_KEYS.map((k) => (
              <Fragment key={k}>
                <dt>{WEIGHT_LABELS[k]}</dt>
                <dd className="text-right" data-testid={`raw-${k}`}>{draft[k].toFixed(2)}</dd>
              </Fragment>
            ))}
          </dl>
        </details>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Cost model</legend>
        <div className="flex items-baseline justify-between">
          <label htmlFor="w-inflation" className="text-sm text-charcoal">Annual inflation rate</label>
          <span className="text-base font-semibold tabular-nums text-charcoal" data-testid="inflation-value">{formatFraction(s.draftInflation)}</span>
        </div>
        <input id="w-inflation" type="range" min={infMin} max={infMax} step={0.0025} value={s.draftInflation}
          onChange={(e) => s.setInflation(Number(e.target.value))} className="mt-1 w-full accent-navy-700" />
        <p className="text-xs text-slate-500">
          {saved.annual_inflation_rate.source} · {saved.annual_inflation_rate.approved_by} · applies to cost estimates on Save, not previewed
        </p>
      </fieldset>

      <div className="space-y-2 border-t border-slate-200 pt-3">
        {s.invalid && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-accent-dark">
            <WarningIcon className="h-4 w-4 shrink-0" />{s.invalid}
          </p>
        )}
        {s.previewWeights && !s.invalid && (
          <div className="space-y-1" data-testid="preview-active">
            <StatusLabel tone="info">Previewing on all dashboards · not saved</StatusLabel>
            <p className="text-xs text-slate-500">Claim list order and reason codes still come from the saved estimates.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => { s.reset(); setState({ kind: "idle" }); }} disabled={!changed && !s.invalid}>
            Reset
          </button>
          <button type="button" className="btn-primary" onClick={() => setConfirming(true)}
            disabled={!changed || Boolean(s.invalid) || state.kind === "saving"}>
            Save
          </button>
        </div>
        {changed && !s.invalid && <p className="text-xs text-slate-500">Reset returns to the last saved settings.</p>}
        {state.kind === "done" && (
          <p role="status" className="text-sm text-navy-700">
            Saved as version {state.version} · {state.recalculated.toLocaleString("en-US")} open and reopened claims recalculated
          </p>
        )}
        {state.kind === "error" && <p role="alert" className="text-sm text-accent-dark">Save failed. {state.message}</p>}
      </div>

      {confirming && (
        <ConfirmDialog title="Save model settings?" confirmLabel="Save settings" busy={state.kind === "saving"}
          onConfirm={doSave} onCancel={() => setConfirming(false)}>
          <ul className="list-disc space-y-1 pl-4">
            <li>Updates the local model settings file.</li>
            <li>Recalculates open and reopened claims as new estimate records.</li>
            <li>Previous estimates are kept.</li>
            <li>Settings remain pending Penser approval.</li>
          </ul>
        </ConfirmDialog>
      )}
    </div>
  );
}
