import { useCallback, useEffect, useState } from "react";

export interface ApiState<T> {
  /** Latest successful data; kept while a newer request is loading. */
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

interface Result<T> {
  requestKey: string | null;
  data: T | null;
  error: Error | null;
}

/** Runs ``load`` whenever ``key`` changes; aborts stale requests. */
export function useApi<T>(load: (signal: AbortSignal) => Promise<T>, key: string): ApiState<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T>>({ requestKey: null, data: null, error: null });
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const requestKey = `${key}#${attempt}`;

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setResult({ requestKey, data, error: null });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({ requestKey, data: null, error: e instanceof Error ? e : new Error("Unexpected error") });
      });
    return () => ctrl.abort();
    // ``load`` is recreated each render; ``requestKey`` captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const current = result.requestKey === requestKey;
  return { data: result.data, error: current ? result.error : null, loading: !current, reload };
}
