import { useId, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  const id = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onKeyDown={(e) => { if (e.key === "Escape" && !busy) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}
        className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-tremor-dropdown">
        <h2 id={`${id}-t`} className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-charcoal">{title}</h2>
        <div className="px-4 py-3 text-sm text-charcoal">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
