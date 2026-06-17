/**
 * 服务端内存缓存 —— 轻量 TTL 缓存，避免高频查询重复打 DB
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export const cache = new Map<string, CacheEntry<unknown>>();

/**
 * 获取缓存或执行 fetcher 并缓存结果
 * @param key 缓存键
 * @param ttlMs 缓存时间（毫秒）
 * @param fetcher 数据获取函数
 */
export function cached<T>(key: string, ttlMs: number, fetcher: () => T): T {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  const data = fetcher();
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** 清除指定 key 的缓存 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/** 清除所有缓存 */
export function clearAllCache(): void {
  cache.clear();
}
