/**
 * Scoped Query & Mutation Engine (Zero-Dependency)
 *
 * Implements in-memory caching, request deduplication, stale-while-revalidate,
 * keepPreviousData, and strict operational mode partitioning (DOM-MODE-1).
 */

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import type { OperationalMode } from '../types';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  mode: OperationalMode;
  scope: string;
}

export interface ScopedQueryOptions<TData> {
  queryKey: (string | number | boolean | null | undefined)[];
  queryFn: (signal?: AbortSignal) => Promise<TData>;
  enabled?: boolean;
  staleTime?: number; // ms, default 30,000ms
  keepPreviousData?: boolean;
  mode?: OperationalMode;
  userRole?: string;
  scopeKey?: string;
}

export interface ScopedQueryResult<TData, TError = Error> {
  data: TData | undefined;
  error: TError | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  isInitialLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isPreviousData: boolean;
  refetch: () => Promise<TData | undefined>;
}

export interface ScopedMutationOptions<TData, TVariables, TError = Error> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  invalidateKeys?: (string | number | boolean | null | undefined)[][];
}

export interface ScopedMutationResult<TData, TVariables, TError = Error> {
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
  error: TError | null;
  reset: () => void;
}

// Global In-Memory Query Store
class ScopedQueryClientStore {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<unknown>>();
  private listeners = new Set<() => void>();

  public normalizeKey(
    keyParts: (string | number | boolean | null | undefined)[],
    mode: OperationalMode = 'DEFAULT',
    role = 'ALL',
    scope = 'GLOBAL'
  ): string {
    const rawParts = keyParts.map((p) => String(p ?? '')).join('::');
    return `${mode}#${role}#${scope}#${rawParts}`;
  }

  public get<T>(normalizedKey: string): CacheEntry<T> | undefined {
    return this.cache.get(normalizedKey) as CacheEntry<T> | undefined;
  }

  public set<T>(normalizedKey: string, data: T, mode: OperationalMode, scope = 'GLOBAL'): void {
    this.cache.set(normalizedKey, {
      data,
      timestamp: Date.now(),
      mode,
      scope,
    });
    this.notify();
  }

  public getInFlight<T>(normalizedKey: string): Promise<T> | undefined {
    return this.inFlight.get(normalizedKey) as Promise<T> | undefined;
  }

  public setInFlight<T>(normalizedKey: string, promise: Promise<T>): void {
    this.inFlight.set(normalizedKey, promise);
  }

  public clearInFlight(normalizedKey: string): void {
    this.inFlight.delete(normalizedKey);
  }

  public invalidateQueries(keyPatternParts: (string | number | boolean | null | undefined)[]): void {
    const pattern = keyPatternParts.map((p) => String(p ?? '')).join('::');
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
    this.notify();
  }

  public flushMode(modeToFlush: OperationalMode): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.mode === modeToFlush) {
        this.cache.delete(key);
      }
    }
    this.notify();
  }

  public clearAll(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Safe listener dispatch
      }
    });
  }
}

export const queryClient = new ScopedQueryClientStore();

/**
 * useScopedQuery — Standardized in-memory cached query hook
 * Solves cold/warm navigation, keepPreviousData, background refetch, and layout jitter.
 */
export function useScopedQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 30_000,
  keepPreviousData = false,
  mode = 'DEFAULT',
  userRole = 'USER',
  scopeKey = 'GLOBAL',
}: ScopedQueryOptions<TData>): ScopedQueryResult<TData, TError> {
  const normalizedKey = queryClient.normalizeKey(queryKey, mode, userRole, scopeKey);

  // Subscribe to cache updates
  useSyncExternalStore(
    (cb) => queryClient.subscribe(cb),
    () => queryClient.get(normalizedKey)?.timestamp ?? 0
  );

  const cachedEntry = queryClient.get<TData>(normalizedKey);
  const hasCachedData = cachedEntry !== undefined;
  const isStale = !cachedEntry || Date.now() - cachedEntry.timestamp > staleTime;

  const [data, setData] = useState<TData | undefined>(cachedEntry?.data);
  const [error, setError] = useState<TError | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(!hasCachedData || isStale);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const previousDataRef = useRef<TData | undefined>(cachedEntry?.data);
  const isPreviousData = Boolean(keepPreviousData && isFetching && data === previousDataRef.current && data !== undefined);

  // Track active request ID to prevent race conditions
  const activeRequestId = useRef(0);

  const executeFetch = useCallback(
    async (isManualRefetch = false): Promise<TData | undefined> => {
      if (!enabled) return undefined;
      const currentId = ++activeRequestId.current;

      const cached = queryClient.get<TData>(normalizedKey);
      if (cached) {
        if (!keepPreviousData) {
          setData(cached.data);
        }
        previousDataRef.current = cached.data;
      }

      if (isManualRefetch) {
        setIsRefetching(true);
      }
      setIsFetching(true);

      // Check existing in-flight request to deduplicate
      let fetchPromise = queryClient.getInFlight<TData>(normalizedKey);
      if (!fetchPromise) {
        fetchPromise = queryFn();
        queryClient.setInFlight(normalizedKey, fetchPromise);
      }

      try {
        const result = await fetchPromise;
        if (currentId === activeRequestId.current) {
          queryClient.set(normalizedKey, result, mode, scopeKey);
          setData(result);
          previousDataRef.current = result;
          setError(null);
          return result;
        }
      } catch (err) {
        if (currentId === activeRequestId.current) {
          const failure = err instanceof Error ? (err as TError) : (new Error(String(err)) as TError);
          setError(failure);
          // Non-destructive: if we already have data, KEEP it visible!
          if (!previousDataRef.current) {
            setData(undefined);
          }
        }
      } finally {
        queryClient.clearInFlight(normalizedKey);
        if (currentId === activeRequestId.current) {
          setIsFetching(false);
          setIsRefetching(false);
        }
      }
      return undefined;
    },
    [enabled, normalizedKey, queryFn, mode, scopeKey, keepPreviousData]
  );

  useEffect(() => {
    if (!enabled) return;
    const entry = queryClient.get<TData>(normalizedKey);
    if (!entry || Date.now() - entry.timestamp > staleTime) {
      executeFetch(false);
    } else {
      setData(entry.data);
      previousDataRef.current = entry.data;
      setIsFetching(false);
    }
  }, [normalizedKey, enabled, staleTime, executeFetch]);

  const isInitialLoading = !hasCachedData && isFetching && data === undefined;
  const status = error ? 'error' : isInitialLoading ? 'loading' : 'success';

  return {
    data,
    error,
    status,
    isInitialLoading,
    isFetching,
    isRefetching,
    isPreviousData,
    refetch: () => executeFetch(true),
  };
}

/**
 * useScopedMutation — Standardized mutation hook with pending isolation and automatic cache invalidation
 */
export function useScopedMutation<TData, TVariables, TError = Error>({
  mutationFn,
  onSuccess,
  onError,
  invalidateKeys = [],
}: ScopedMutationOptions<TData, TVariables, TError>): ScopedMutationResult<TData, TVariables, TError> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<TError | null>(null);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsPending(true);
      setError(null);
      try {
        const result = await mutationFn(variables);
        // Automatically invalidate target queries
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries(key);
        }
        if (onSuccess) {
          await onSuccess(result, variables);
        }
        return result;
      } catch (err) {
        const failure = err instanceof Error ? (err as TError) : (new Error(String(err)) as TError);
        setError(failure);
        if (onError) {
          await onError(failure, variables);
        }
        throw failure;
      } finally {
        setIsPending(false);
      }
    },
    [mutationFn, onSuccess, onError, invalidateKeys]
  );

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      try {
        return await mutateAsync(variables);
      } catch {
        return undefined;
      }
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsPending(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending,
    error,
    reset,
  };
}
