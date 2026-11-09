import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  /** Small line above the title, e.g. "Adjuster". */
  eyebrow: string;
  title: string;
  onClose: () => void;
  /** Leave room for the Model weights panel on wide screens. */
  besideWeightsPanel?: boolean;
  children: ReactNode;
}

/**
 * Right-hand slide-out panel. Non-modal: the page behind stays usable, so choosing another
 * row updates the panel in place. Full width on small screens. Close or Escape dismisses it,
 * and focus moves to the title whenever it changes so keyboard and screen-reader users land
 * in the new content.
 */
export function SlideOverPanel({ eyebrow, title, onClose, besideWeightsPanel = false, children }: Props) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    heading.current?.focus();
    if (body.current) body.current.scrollTop = 0;
  }, [title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return; // an open modal dialog handles its own Escape
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-labelledby={`${id}-title`} data-testid="slide-over"
      className={`fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-slate-200 bg-white shadow-[-12px_0_32px_-16px_rgb(16_24_40/0.25)] motion-safe:animate-panel-in sm:w-[34rem] ${besideWeightsPanel ? "lg:right-80" : ""}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{eyebrow}</p>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="truncate text-lg font-semibold text-charcoal">{title}</h2>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={onClose}>Close</button>
      </div>
      <div ref={body} className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </div>
  );
}
