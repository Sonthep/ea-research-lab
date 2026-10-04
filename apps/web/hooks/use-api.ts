"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
export function useApi<T>(path: string | null, revision = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setData(undefined);
    if (!path) { setLoading(false); setError(""); return; }
    setLoading(true); setError("");
    api<T>(path).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);
  return { data, error, loading };
}
