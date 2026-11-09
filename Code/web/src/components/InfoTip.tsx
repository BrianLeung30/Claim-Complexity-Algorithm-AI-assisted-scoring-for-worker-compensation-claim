import { useId } from "react";
import { InfoIcon } from "./Icons";

// The tooltip box starts flush with the trigger (padding, not margin, makes the gap) so the
// pointer can move onto it without it disappearing.
const PLACEMENT = {
  /** Below the icon, extending right. */
  start: { wrap: "relative", tip: "left-0 top-full w-64" },
  /** Below the icon, extending left. */
  end: { wrap: "relative", tip: "right-0 top-full w-64" },
  /** Inside the nearest positioned ancestor (a metric card), just under its label row. */
  card: { wrap: "", tip: "inset-x-3 top-8" },
} as const;

/**
 * A short definition behind a small "i" button. Shown on hover and on keyboard focus;
 * Escape hides it. Screen readers get the text as the button's description.
 * Not for use inside scrolling tables (they would clip it): use a ``title`` there.
 */
export function InfoTip({ label, text, placement = "start" }: {
  label: string; text: string; placement?: keyof typeof PLACEMENT;
}) {
  const id = useId();
  const p = PLACEMENT[placement];
  return (
    <span className={`group inline-flex ${p.wrap}`}>
      <button type="button" aria-label={label} aria-describedby={id}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();          // only this tooltip closes, not a surrounding panel
          e.currentTarget.blur();
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-600">
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      <span role="tooltip" id={id} className={`absolute z-30 hidden pt-1 group-focus-within:block group-hover:block ${p.tip}`}>
        <span className="block rounded bg-slate-800 px-2.5 py-1.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-tremor-dropdown">
          {text}
        </span>
      </span>
    </span>
  );
}
