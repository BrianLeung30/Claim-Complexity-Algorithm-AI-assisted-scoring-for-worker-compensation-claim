import { useCallback, useMemo, useState, type ReactNode } from "react";
import { SettingsContext, type SettingsContextValue } from "../lib/settingsContext";
import { useApi } from "../lib/useApi";
import { normalise, sameWeights, savedWeights } from "../lib/weights";
import { api } from "../services/api";
import type { WeightKey, Weights, WeightsUpdate } from "../types/api";

interface Overrides {
  weights?: Weights;
  inflation?: number;
}

/** Holds saved settings, the unsaved draft and the preview shared by all dashboards. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const weights = useApi((s) => api.getWeights(s), `weights#${dataVersion}`);
  const saved = weights.data;

  const base = useMemo(() => (saved ? savedWeights(saved) : null), [saved]);
  const draftWeights = overrides.weights ?? base;
  const draftInflation = overrides.inflation ?? saved?.annual_inflation_rate.value ?? null;

  const normDraft = draftWeights ? normalise(draftWeights) : null;
  const normSaved = base ? normalise(base) : null;
  const weightsChanged = Boolean(draftWeights && normSaved && !sameWeights(normDraft, normSaved));
  const inflationChanged = Boolean(saved && draftInflation !== null && Math.abs(draftInflation - saved.annual_inflation_rate.value) > 1e-9);
  const invalid = draftWeights && !normDraft ? "Weights cannot all be zero." : null;
  const previewWeights = weightsChanged && normDraft ? normDraft : null;

  const setWeight = useCallback((key: WeightKey, value: number) => {
    setOverrides((o) => {
      const current = o.weights ?? base;
      return current ? { ...o, weights: { ...current, [key]: value } } : o;
    });
  }, [base]);
  const setInflation = useCallback((value: number) => setOverrides((o) => ({ ...o, inflation: value })), []);
  const reset = useCallback(() => setOverrides({}), []);

  const save = useCallback(async () => {
    const body: WeightsUpdate = {};
    if (weightsChanged && draftWeights) Object.assign(body, draftWeights);
    if (inflationChanged && draftInflation !== null) body.annual_inflation_rate = draftInflation;
    const res = await api.putWeights(body);
    setOverrides({});
    setDataVersion((v) => v + 1);
    return res;
  }, [weightsChanged, inflationChanged, draftWeights, draftInflation]);

  const value: SettingsContextValue = useMemo(() => ({
    saved, loading: weights.loading, error: weights.error, reloadSaved: weights.reload,
    draftWeights, draftInflation, setWeight, setInflation, reset, previewWeights,
    weightsChanged, inflationChanged, invalid, save, dataVersion, panelOpen, setPanelOpen,
  }), [saved, weights.loading, weights.error, weights.reload, draftWeights, draftInflation, setWeight, setInflation,
    reset, previewWeights, weightsChanged, inflationChanged, invalid, save, dataVersion, panelOpen]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
