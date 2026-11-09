import type { ReactNode } from "react";
import { InfoTip } from "./InfoTip";
import { Card } from "./tremor";

/** Summary number. ``info`` adds a short definition tooltip; ``exact`` is shown on hover of a rounded value. */
export function MetricCard({ label, value, detail, info, exact, testId }: {
  label: string; value: string; detail?: ReactNode; info?: string; exact?: string; testId?: string;
}) {
  return (
    <Card className="p-4 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {info && <InfoTip label={`About ${label}`} text={info} placement="card" />}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal" data-testid={testId} title={exact}>
        {value}
      </p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </Card>
  );
}
