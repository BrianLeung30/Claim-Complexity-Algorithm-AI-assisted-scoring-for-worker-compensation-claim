import { ProgressBar } from "./tremor";
import { SUBSCORE_LABELS } from "../lib/config";
import { formatScore } from "../lib/format";
import type { Subscores } from "../types/api";

const ORDER = ["duration", "medical_intensity", "time_loss", "legal"] as const;

export function SubscoreBars({ subscores }: { subscores: Subscores }) {
  return (
    <ul className="space-y-3" aria-label="Contributing sub-scores">
      {ORDER.map((key) => {
        const v = subscores[key];
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-charcoal">{SUBSCORE_LABELS[key]}</span>
              <span className="tabular-nums font-medium text-charcoal" data-testid={`subscore-${key}`}>
                {formatScore(v)}
              </span>
            </div>
            <ProgressBar
              value={v ?? 0}
              className="mt-1"
              aria-label={`${SUBSCORE_LABELS[key]} sub-score`}
              aria-valuenow={v ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </li>
        );
      })}
    </ul>
  );
}
