import { api } from "../lib/api";
import { useState, useCallback, useEffect } from "react";

export function useLoad<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(!!path),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }
    let live = true;
    setLoading(true);
    api<T>(path)
      .then((x) => {
        if (live) {
          setData(x);
          setError("");
        }
      })
      .catch((e) => {
        if (live)
          setError(e instanceof Error ? e.message : "Unable to load data");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, tick, ...deps]);
  return { data, loading, error, reload };
}
