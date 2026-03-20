"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch } from "./api";

const POLL_INTERVAL = 10_000; // 10 seconds

export function usePollingFetch<T>(
  url: string,
  opts?: { enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirst = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch<T>(url);
      setData(res);
      setError(null);
    } catch (e: any) {
      if (isFirst.current) setError(e?.message || "Failed to fetch");
    } finally {
      if (isFirst.current) {
        setLoading(false);
        isFirst.current = false;
      }
    }
  }, [url]);

  useEffect(() => {
    if (opts?.enabled === false) return;
    isFirst.current = true;
    setLoading(true);
    fetchData();

    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData, opts?.enabled]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
