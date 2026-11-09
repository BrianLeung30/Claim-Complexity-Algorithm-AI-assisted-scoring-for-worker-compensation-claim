import { useSettings } from "../lib/settingsContext";
import { formatScore } from "../lib/format";
import { complexityFromSubscores } from "../lib/weights";
import type { Subscores } from "../types/api";
import { ComplexityBadge } from "./Badges";

/** Saved complexity, or the unsaved-weights preview (from the four sub-scores) beside the saved value. */
export function ComplexityCell({ saved, subscores }: { saved: number | null; subscores: Subscores | null | undefined }) {
  const { previewWeights } = useSettings();
  const preview = previewWeights ? complexityFromSubscores(subscores, previewWeights) : null;
  if (preview === null) return <ComplexityBadge score={saved} />;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="complexity-preview">
      <ComplexityBadge score={preview} />
      <span className="text-xs text-slate-500">saved {formatScore(saved)}</span>
    </span>
  );
}
