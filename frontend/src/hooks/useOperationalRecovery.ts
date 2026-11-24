import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { serverStateCache } from '../store/serverStateCache';
import { ApiError } from '../api/client';
import type { EmptyScenario } from '../components/workbench/StateBoundary';

export interface OperationalRecoveryOptions<TData, TFilter> {
  queryKey: string;
  fetcher: (filters: TFilter, signal: AbortSignal) => Promise<TData>;
  initialFilters: TFilter;
  activeFilters?: TFilter;
  defaultFilters: TFilter;
  isEqualFilters?: (a: TFilter, b: TFilter) => boolean;
  onResetFilters?: () => void;
  prerequisiteRoute?: string;
  prerequisiteLabel?: string;
}

export interface OperationalRecoveryResult<TData, TFilter> {
  data: TData | null;
  filters: TFilter;
  setFilters: React.Dispatch<React.SetStateAction<TFilter>>;
  updateFilter: <K extends keyof TFilter>(key: K, value: TFilter[K]) => void;
  isLoading: boolean;
  isFetching: boolean;
  isPreviousData: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyScenario: EmptyScenario;
  prerequisiteRoute?: string;
  prerequisiteLabel?: string;
  handleResetFilters: () => void;
  handleRetry: () => Promise<void>;
  refetch: () => Promise<void>;
}

export interface SafeMutationOptions<TPayload, TResult> {
  mutationFn: (payload: TPayload) => Promise<TResult>;
  payload: TPayload;
  successMessage?: string;
  onSuccess?: (result: TResult) => void;
  onConflict?: (error: ApiError) => void;
  onError?: (error: Error) => void;
}

export interface SafeMutationResult<TPayload, TResult> {
  ok: boolean;
  data?: TResult;
  error?: Error;
  isConflict: boolean;
  preservedPayload: TPayload;
}

/**
 * Safely executes an async mutation while preserving the user's input payload on failure.
 * Catches 409 Concurrency conflicts, 400 Bad Requests, network issues, and triggers appropriate callbacks.
 */
export async function executeSafeMutation<TPayload, TResult>({
  mutationFn,
  payload,
  onSuccess,
  onConflict,
  onError,
}: SafeMutationOptions<TPayload, TResult>): Promise<SafeMutationResult<TPayload, TResult>> {
  try {
    const data = await mutationFn(payload);
    onSuccess?.(data);
    return { ok: true, data, isConflict: false, preservedPayload: payload };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const isConflict = (err instanceof ApiError && err.status === 409) ||
      error.message.includes('409') ||
      error.message.includes('xung đột') ||
      error.message.includes('conflict');

    if (isConflict && err instanceof ApiError) {
      onConflict?.(err);
    } else {
      onError?.(error);
    }

    return {
      ok: false,
      error,
      isConflict,
      preservedPayload: payload,
    };
  }
}

/**
 * Default comparator for filter objects (shallow compare).
 */
function defaultIsEqualFilters<TFilter>(a: TFilter, b: TFilter): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Unified hook managing SWR state, zero dead-ends escape hatches, and error recovery across all routes.
 */
export function useOperationalRecovery<TData, TFilter>({
  queryKey,
  fetcher,
  initialFilters,
  activeFilters,
  defaultFilters,
  isEqualFilters = defaultIsEqualFilters,
  onResetFilters,
  prerequisiteRoute,
  prerequisiteLabel,
}: OperationalRecoveryOptions<TData, TFilter>): OperationalRecoveryResult<TData, TFilter> {
  const cached = serverStateCache.get<TData>(queryKey)?.data;
  const [data, setData] = useState<TData | null>(() => cached ?? null);
  const [dataKey, setDataKey] = useState(queryKey);
  const [localFilters, setFilters] = useState<TFilter>(() => initialFilters);
  const filters = activeFilters ?? localFilters;
  const [isLoading, setIsLoading] = useState<boolean>(() => !cached);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const setFiltersSafe = useCallback(
    (newFiltersOrFn: React.SetStateAction<TFilter>) => {
      setFilters((prev) => {
        const next = typeof newFiltersOrFn === 'function'
          ? (newFiltersOrFn as (p: TFilter) => TFilter)(prev)
          : newFiltersOrFn;
        if (isEqualFilters(prev, next)) return prev;
        return next;
      });
    },
    [isEqualFilters]
  );

  const read = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const latest = useRef({ fetcher, key: queryKey, filters });
  useLayoutEffect(() => {
    latest.current = { fetcher, key: queryKey, filters };
  }, [fetcher, queryKey, filters]);

  const executeFetch = useCallback(
    async () => {
      if (!mounted.current) return;
      read.current?.abort();
      const controller = new AbortController();
      read.current = controller;
      const { key, fetcher: fetchCurrent, filters: currentFilters } = latest.current;
      const isCurrent = () => !controller.signal.aborted && latest.current.key === key
        && latest.current.filters === currentFilters;
      setIsFetching(true);
      setError(null);

      try {
        const result = await fetchCurrent(currentFilters, controller.signal);
        if (isCurrent()) {
          setData(result);
          setDataKey(key);
          serverStateCache.set(key, result);
        }
      } catch (err: unknown) {
        if (isCurrent()) {
          const formattedErr = err instanceof Error ? err : new Error(String(err));
          setError(formattedErr);
          if (formattedErr instanceof ApiError && (formattedErr.status === 401 || formattedErr.status === 403)) {
            setData(null);
            serverStateCache.delete(key);
          }
        }
      } finally {
        if (read.current === controller) {
          read.current = null;
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void executeFetch(); });
    return () => {
      active = false;
      read.current?.abort();
      read.current = null;
    };
  }, [executeFetch, filters, queryKey]);

  const updateFilter = useCallback(<K extends keyof TFilter>(key: K, value: TFilter[K]) => {
    setIsFetching(true);
    setError(null);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setIsFetching(true);
    setError(null);
    setFilters(defaultFilters);
    onResetFilters?.();
  }, [defaultFilters, onResetFilters]);

  const handleRetry = executeFetch;

  // Compute empty state and escape scenario
  const isDataEmpty = !data || (Array.isArray(data) && data.length === 0);
  const isFilterActive = !isEqualFilters(filters, defaultFilters);

  let emptyScenario: EmptyScenario = 'true-empty';
  if (isDataEmpty) {
    if (isFilterActive) {
      emptyScenario = 'filter-empty';
    } else if (prerequisiteRoute) {
      emptyScenario = 'prerequisite-blocked';
    } else {
      emptyScenario = 'empty-first-use';
    }
  }

  const isPreviousData = data !== null && dataKey !== queryKey;
  return {
    data,
    filters,
    setFilters: setFiltersSafe,
    updateFilter,
    isLoading,
    isFetching: isFetching || (isPreviousData && !error),
    isPreviousData,
    error,
    isEmpty: isDataEmpty,
    emptyScenario,
    prerequisiteRoute,
    prerequisiteLabel,
    handleResetFilters,
    handleRetry,
    refetch: handleRetry,
  };
}
