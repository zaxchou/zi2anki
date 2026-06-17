/**
 * 轻量内存缓存 hook —— 替代 SWR/React Query
 * 缓存 API 响应 30 秒，避免短时间重复请求
 */

import { useEffect, useState, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 30_000; // 30 秒

/** 带缓存的 fetcher */
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; enabled?: boolean }
): { data: T | undefined; loading: boolean; error: Error | null; refresh: () => void } {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | undefined>(() => {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) {
      return entry.data as T;
    }
    return undefined;
  });
  const [loading, setLoading] = useState(!data && enabled);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    if (!enabled) return;
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) {
      setData(entry.data as T);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetcherRef.current()
      .then((result) => {
        cache.set(key, { data: result, timestamp: Date.now() });
        setData(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setLoading(false));
  }, [key, ttl, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    cache.delete(key);
    load();
  }, [key, load]);

  return { data, loading, error, refresh };
}

/** 清除所有缓存（登出时调用） */
export function clearAllCache(): void {
  cache.clear();
}

/** 清除指定 key 的缓存 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}
