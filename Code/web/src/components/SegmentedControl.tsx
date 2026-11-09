import { useRef } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A small single-choice control (ARIA radio group: Tab to enter, arrow keys to change). */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: {
  label: string; options: Option<T>[]; value: T; onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (to: number) => {
    const i = (to + options.length) % options.length;
    onChange(options[i]!.value);
    refs.current[i]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-slate-300 bg-white p-0.5">
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={checked}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
            }}
            className={`rounded-sm px-3 py-1 text-sm ${checked ? "bg-navy-700 font-medium text-white" : "text-charcoal hover:bg-slate-100"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
