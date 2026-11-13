import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

/** GET an API path; refetches when the path changes. `null` path = don't fetch. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    const ac = new AbortController();
    setLoading(true);
    api<T>(path, { signal: ac.signal })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return;
        setError(e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Could not reach the server'));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
