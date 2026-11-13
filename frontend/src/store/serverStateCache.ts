export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  isStale: boolean;
  ttlMs: number;
}

type CacheListener = () => void;

const L2_CACHE_PREFIX = 'ipc_l2_cache:';
const SNAPSHOT_STORAGE_PREFIX = 'ipc_snapshot:';

function isL2Persistable(key: string): boolean {
  return (
    key.startsWith('snapshot:') ||
    key.startsWith('mrx_') ||
    key.startsWith('catalog_') ||
    key.startsWith('admin_data_') ||
    key.startsWith('system_operation_')
  );
}

function unwrapLegacyCachePayload(cacheKey: string, payload: unknown): unknown {
  if (
    !cacheKey.startsWith('snapshot:') &&
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    'isCompatibilityBlocked' in payload &&
    !(payload as { isCompatibilityBlocked?: boolean }).isCompatibilityBlocked
  ) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

/**
 * Enterprise In-Memory Stale-While-Revalidate (SWR) Cache Store (Rule L4-DATA-01, S-DATA-01, S-DATA-03)
 * Dual-tier caching: L1 (In-Memory Map) backed by L2 (sessionStorage) for 0ms cold reload hydration.
 */
class ServerStateCache {
  private store = new Map<string, CacheEntry>();
  private listeners = new Map<string, Set<CacheListener>>();

  constructor() {
    this.hydrateFromSession();
  }

  private hydrateFromSession(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const fullKey = sessionStorage.key(i);
        if (!fullKey) continue;
        if (fullKey.startsWith(L2_CACHE_PREFIX)) {
          const cacheKey = fullKey.slice(L2_CACHE_PREFIX.length);
          const raw = sessionStorage.getItem(fullKey);
          if (raw) {
            const entry = JSON.parse(raw) as CacheEntry;
            entry.data = unwrapLegacyCachePayload(cacheKey, entry.data);
            this.store.set(cacheKey, entry);
          }
        } else if (fullKey.startsWith(SNAPSHOT_STORAGE_PREFIX)) {
          const cacheKey = fullKey.slice(SNAPSHOT_STORAGE_PREFIX.length);
          const raw = sessionStorage.getItem(fullKey);
          if (raw) {
            const entry = JSON.parse(raw) as CacheEntry;
            this.store.set(cacheKey, entry);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    entry.data = unwrapLegacyCachePayload(key, entry.data);
    const isExpired = Date.now() - entry.timestamp > entry.ttlMs;
    if (isExpired) {
      entry.isStale = true;
    }
    return entry as CacheEntry<T>;
  }

  set<T>(key: string, data: T, ttlMs = 60000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      isStale: false,
      ttlMs,
    };
    this.store.set(key, entry as CacheEntry);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (isL2Persistable(key)) {
        try {
          sessionStorage.setItem(`${L2_CACHE_PREFIX}${key}`, JSON.stringify(entry));
        } catch {
          // Ignore quota errors
        }
      }
      if (key.startsWith('snapshot:')) {
        try {
          sessionStorage.setItem(`${SNAPSHOT_STORAGE_PREFIX}${key}`, JSON.stringify(entry));
        } catch {
          // Ignore quota
        }
      }
    }
    this.notify(key);
  }

  mutateLocal<T>(key: string, updater: (prev: T | null) => T): void {
    const current = this.get<T>(key);
    const updated = updater(current ? current.data : null);
    this.set(key, updated, current?.ttlMs ?? 60000);
  }

  /**
   * Invalidates a specific key or all keys matching a prefix.
   */
  delete(key: string): void {
    this.store.delete(key);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`${L2_CACHE_PREFIX}${key}`);
        sessionStorage.removeItem(`${SNAPSHOT_STORAGE_PREFIX}${key}`);
      } catch {
        // In-memory invalidation remains authoritative when session storage is unavailable.
      }
    }
    this.notify(key);
  }

  deletePrefix(prefix: string): void {
    const keys = new Set([...this.store.keys()].filter((key) => key.startsWith(prefix)));
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const fullKey = sessionStorage.key(i);
          if (fullKey?.startsWith(L2_CACHE_PREFIX)) {
            const key = fullKey.slice(L2_CACHE_PREFIX.length);
            if (key.startsWith(prefix)) keys.add(key);
          } else if (fullKey?.startsWith(SNAPSHOT_STORAGE_PREFIX)) {
            const key = fullKey.slice(SNAPSHOT_STORAGE_PREFIX.length);
            if (key.startsWith(prefix)) keys.add(key);
          }
        }
      } catch {
        // Ignore storage access errors; in-memory entries are still removed.
      }
    }
    keys.forEach((key) => this.delete(key));
  }

  invalidate(keyOrPrefix: string): void {
    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        const entry = this.store.get(key);
        if (entry) {
          entry.isStale = true;
          if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
              sessionStorage.removeItem(`${L2_CACHE_PREFIX}${key}`);
              sessionStorage.removeItem(`${SNAPSHOT_STORAGE_PREFIX}${key}`);
            } catch {
              // In-memory invalidation remains authoritative when session storage is unavailable.
            }
          }
          this.notify(key);
        }
      }
    }
  }

  /**
   * Targeted Cache Invalidation across 3 dependent scopes (Rule L4-DATA-03):
   * 1. Detailed item row, 2. Top-level summary KPI, 3. Related charts / aggregation.
   */
  invalidateScopes(scopes: string[]): void {
    for (const scope of scopes) {
      this.invalidate(scope);
    }
  }

  subscribe(key: string, listener: CacheListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach((fn) => fn());
  }

  clearAll(): void {
    this.store.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith(L2_CACHE_PREFIX) || k.startsWith(SNAPSHOT_STORAGE_PREFIX))) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) sessionStorage.removeItem(k);
      } catch {
        // In-memory cache is already cleared when session storage is unavailable.
      }
    }
    this.listeners.forEach((set) => set.forEach((fn) => fn()));
  }
}

export const serverStateCache = new ServerStateCache();

/**
 * Safely unwraps an array from serverStateCache (even if a legacy CacheWrapper `{ data: T[] }` was persisted in sessionStorage).
 */
export function getCachedArray<T>(key: string): T[] | undefined {
  const entry = serverStateCache.get<unknown>(key);
  if (!entry) return undefined;
  const raw = entry.data;
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'object' && raw !== null && 'data' in raw) {
    const inner = (raw as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return undefined;
}

/**
 * Global Session Teardown Cache Purge (Rule NFR-03)
 */
export function clearAllServerCache(): void {
  serverStateCache.clearAll();
}
