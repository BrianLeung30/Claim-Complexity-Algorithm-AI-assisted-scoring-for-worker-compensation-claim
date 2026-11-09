import { createContext, useContext } from "react";
import type { Weights, WeightKey, WeightsResponse, WeightsUpdateResponse } from "../types/api";

export interface SettingsContextValue {
  saved: WeightsResponse | null;
  loading: boolean;
  error: Error | null;
  reloadSaved: () => void;
  /** Raw slider positions (unsaved). */
  draftWeights: Weights | null;
  draftInflation: number | null;
  setWeight: (key: WeightKey, value: number) => void;
  setInflation: (value: number) => void;
  reset: () => void;
  /** Normalised unsaved weights when they differ from the saved ones; null otherwise. */
  previewWeights: Weights | null;
  weightsChanged: boolean;
  inflationChanged: boolean;
  invalid: string | null;
  save: () => Promise<WeightsUpdateResponse>;
  /** Increments after a successful save so dashboards refetch. */
  dataVersion: number;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
