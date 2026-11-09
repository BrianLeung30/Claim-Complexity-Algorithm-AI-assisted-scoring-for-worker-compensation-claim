import { ApiError } from "../services/api";
import { ErrorIcon } from "./Icons";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
      <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-navy-600 motion-safe:animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const isNetwork = error instanceof ApiError && error.kind === "network";
  return (
    <div role="alert" className="flex gap-3 rounded border border-slate-200 bg-white px-4 py-3 text-sm">
      <ErrorIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark" />
      <div>
        <p className="font-medium text-charcoal">{isNetwork ? "Backend unavailable" : "Could not load data"}</p>
        <p className="mt-0.5 text-slate-600">
          {error.message}
          {isNetwork && " Start the backend and retry."}
        </p>
        {onRetry && (
          <button type="button" className="btn-secondary mt-2" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="px-4 py-8 text-center text-sm">
      <p className="font-medium text-charcoal">{title}</p>
      {detail && <p className="mt-1 text-slate-500">{detail}</p>}
    </div>
  );
}
