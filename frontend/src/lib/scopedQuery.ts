/**
 * Scoped Query & Mutation Engine (Zero-Dependency)
 *
 * Implements in-memory caching, request deduplication, stale-while-revalidate,
 * keepPreviousData, and strict operational mode partitioning (DOM-MODE-1).
 * Uses React 19 useSyncExternalStore for 100% purity and zero layout jitter.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { OperationalMode } from '../types';

export interface QueryRecord<TData = unknown, TError = Error> {
  data: TData | undefined;
  previousData: TData | undefined;
  error: TError | null;
  isFetching: boolean;
  isRefetching: boolean;
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

const DEFAULT_RECORD: QueryRecord = {
  data: undefined,
  previousData: undefined,
  error: null,
  isFetching: false,
  isRefetching: false,
  timestamp: 0,
  mode: 'DEFAULT',
  scope: 'GLOBAL',
};

// Global In-Memory Query Store
class ScopedQueryClientStore {
  private records = new Map<string, QueryRecord>();
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

  public getRecord<TData, TError = Error>(normalizedKey: string): QueryRecord<TData, TError> {
    const existing = this.records.get(normalizedKey);
    if (!existing) {
      return DEFAULT_RECORD as QueryRecord<TData, TError>;
    }
    return existing as QueryRecord<TData, TError>;
  }

  public get<T>(normalizedKey: string): { data: T; mode: OperationalMode; timestamp: number } | undefined {
    const record = this.records.get(normalizedKey);
    if (!record || record.data === undefined) return undefined;
    return { data: record.data as T, mode: record.mode, timestamp: record.timestamp };
  }

  public set<T>(normalizedKey: string, data: T, mode: OperationalMode, scope = 'GLOBAL'): void {
    const current = this.getRecord(normalizedKey);
    this.records.set(normalizedKey, {
      ...current,
      data,
      previousData: current.data ?? data,
      error: null,
      isFetching: false,
      isRefetching: false,
      timestamp: Date.now(),
      mode,
      scope,
    });
    this.notify();
  }

  public setFetching(normalizedKey: string, isRefetch: boolean, mode: OperationalMode, scope = 'GLOBAL'): void {
    const current = this.getRecord(normalizedKey);
    this.records.set(normalizedKey, {
      ...current,
      isFetching: true,
      isRefetching: isRefetch,
      previousData: current.data,
      mode,
      scope,
    });
    this.notify();
  }

  public setError<TError>(normalizedKey: string, error: TError): void {
    const current = this.getRecord(normalizedKey);
    this.records.set(normalizedKey, {
      ...current,
      error: error as Error,
      isFetching: false,
      isRefetching: false,
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
    for (const key of this.records.keys()) {
      if (key.includes(pattern)) {
        this.records.delete(key);
      }
    }
    this.notify();
  }

  public flushMode(modeToFlush: OperationalMode): void {
    for (const [key, entry] of this.records.entries()) {
      if (entry.mode === modeToFlush) {
        this.records.delete(key);
      }
    }
    this.notify();
  }

  public clearAll(): void {
    this.records.clear();
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
  staleTime = 30000,
  keepPreviousData = false,
  mode = 'DEFAULT',
  userRole = 'USER',
  scopeKey = 'GLOBAL',
}: ScopedQueryOptions<TData>): ScopedQueryResult<TData, TError> {
  const normalizedKey = queryClient.normalizeKey(queryKey, mode, userRole, scopeKey);

  // Subscribe to store updates via pure useSyncExternalStore
  const record = useSyncExternalStore(
    (cb) => queryClient.subscribe(cb),
    () => queryClient.getRecord<TData, TError>(normalizedKey)
  );

  const executeFetch = useCallback(
    async (isManual = false): Promise<TData | undefined> => {
      if (!enabled) return undefined;

      queryClient.setFetching(normalizedKey, isManual, mode, scopeKey);

      let fetchPromise = queryClient.getInFlight<TData>(normalizedKey);
      if (!fetchPromise || isManual) {
        fetchPromise = queryFn();
        queryClient.setInFlight(normalizedKey, fetchPromise);
      }

      try {
        const result = await fetchPromise;
        queryClient.set(normalizedKey, result, mode, scopeKey);
        return result;
      } catch (err) {
        const failure = err instanceof Error ? (err as TError) : (new Error(String(err)) as TError);
        queryClient.setError(normalizedKey, failure);
      } finally {
        queryClient.clearInFlight(normalizedKey);
      }
      return undefined;
    },
    [enabled, normalizedKey, queryFn, mode, scopeKey]
  );

  useEffect(() => {
    if (!enabled) return;
    const isStale = record.timestamp === 0 || Date.now() - record.timestamp > staleTime;
    if (record.data === undefined || isStale) {
      void executeFetch();
    }
  }, [enabled, executeFetch, record.data, record.timestamp, staleTime]);

  const isInitialLoading = enabled && record.data === undefined && (record.isFetching || record.timestamp === 0);
  const displayData = keepPreviousData && record.data === undefined ? record.previousData : record.data;
  const isPreviousData = Boolean(keepPreviousData && record.data === undefined && record.previousData !== undefined);
  const status = record.error ? 'error' : isInitialLoading ? 'loading' : 'success';

  return {
    data: displayData,
    error: record.error,
    status,
    isInitialLoading,
    isFetching: record.isFetching,
    isRefetching: record.isRefetching,
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
