import { Card } from "./tremor";
import type { ReactNode } from "react";

export function SectionCard({ title, aside, children, className = "", flush = false }: {
  title: string; aside?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card className={`p-0 ring-slate-200 ${className}`} role="region" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <h2 id={id} className="text-sm font-semibold text-charcoal">{title}</h2>
        {aside && <div className="text-xs text-slate-500">{aside}</div>}
      </div>
      <div className={flush ? "" : "p-4"}>{children}</div>
    </Card>
  );
}
