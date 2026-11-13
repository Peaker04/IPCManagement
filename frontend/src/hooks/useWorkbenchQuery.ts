import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { serverStateCache } from '../store/serverStateCache';
import type { StateBoundaryProps } from '../components/workbench/StateBoundary';

export interface UseWorkbenchQueryOptions<TData, TParams = Record<string, unknown>> {
  scopeKey: string;
  cacheKey: string;
  snapshotKey?: string;
  queryFn: (params?: TParams, signal?: AbortSignal) => Promise<TData>;
  enabled?: boolean;
  scopeId?: string | null;
  isCatalogLoading?: boolean;
  isDatasetEmpty?: (data: TData) => boolean;
  isCompatibilityBlocked?: (error: unknown, cached?: unknown) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyScenario?: StateBoundaryProps['emptyScenario'];
}

export type WorkbenchLayer =
  | 'L1_HYDRATED_READY'
  | 'L2_ERROR_OR_BLOCKED'
  | 'L3_BOOTSTRAPPING_OR_LOADING'
  | 'L4_NO_SCOPE_AVAILABLE'
  | 'L5_EMPTY_DATASET';

export interface UseWorkbenchQueryResult<TData> {
  data: TData | null;
  layer: WorkbenchLayer;
  stateProps: {
    isLoading: boolean;
    isFetching: boolean;
    isPreviousData: boolean;
    hasExistingData: boolean;
    error: Error | null;
    isEmpty: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyScenario?: StateBoundaryProps['emptyScenario'];
    isPartial?: boolean;
    partialMessage?: string;
  };
  refetch: (force?: boolean) => Promise<void>;
  setData: (updater: TData | null | ((prev: TData | null) => TData | null)) => void;
}

interface CacheWrapper<T> {
  data: T | null;
  isCompatibilityBlocked?: boolean;
}

function isCacheWrapper<T>(entry: unknown): entry is CacheWrapper<T> {
  if (entry === null || typeof entry !== 'object' || !('data' in entry)) return false;
  if ('isCompatibilityBlocked' in entry) return true;
  const keys = Object.keys(entry as object);
  // Legacy daily snapshots kept navigation metadata next to the query payload.
  return keys.every(key => key === 'data' || key === 'activeBatchId' || key === 'activeDate');
}

function hasCompatibilityFlag(entry: unknown): entry is { isCompatibilityBlocked?: boolean } {
  return entry !== null && typeof entry === 'object' && 'isCompatibilityBlocked' in entry;
}

function resolveCachePayload<T>(entry: unknown): T | null {
  if (entry === null || entry === undefined) return null;
  return isCacheWrapper<T>(entry) ? entry.data : entry as T;
}

const inFlightWorkbenchQueries = new Map<string, {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: number;
}>();

/**
 * Canonical 5-Layer State & SWR Query Engine for Enterprise Workbenches
 * Enforces L1–L5 disjoint state precedence, 0ms synchronous Render #1 hydration,
 * atomic parameter transitions with keepPreviousData, and zero-strobe StateBoundary props.
 */
export function useWorkbenchQuery<TData, TParams = Record<string, unknown>>({
  scopeKey,
  cacheKey,
  snapshotKey = `snapshot:${scopeKey}`,
  queryFn,
  enabled = true,
  scopeId,
  isCatalogLoading = false,
  isDatasetEmpty,
  isCompatibilityBlocked,
  emptyTitle,
  emptyDescription,
  emptyScenario = 'filter-empty',
}: UseWorkbenchQueryOptions<TData, TParams>): UseWorkbenchQueryResult<TData> {
  const rawSnapshot = snapshotKey ? serverStateCache.get<unknown>(snapshotKey)?.data : null;
  const cachedEntry = serverStateCache.get<unknown>(cacheKey);
  const rawCached = cachedEntry?.data;
  const hasWarmCache = Boolean(cachedEntry && !cachedEntry.isStale);
  const warmPayload = hasWarmCache ? resolveCachePayload<TData>(rawCached) : null;
  const warmBlocked = hasWarmCache && hasCompatibilityFlag(rawCached) && Boolean(rawCached.isCompatibilityBlocked);

  const initialData = hasWarmCache
    ? warmPayload
    : resolveCachePayload<TData>(rawSnapshot) ?? resolveCachePayload<TData>(rawCached);
  const initialBlocked = hasWarmCache ? warmBlocked : Boolean(
    (hasCompatibilityFlag(rawSnapshot) && rawSnapshot.isCompatibilityBlocked)
      || (hasCompatibilityFlag(rawCached) && rawCached.isCompatibilityBlocked)
  );

  const [stateData, setDataState] = useState<TData | null>(() => initialData);
  const [error, setError] = useState<Error | null>(() =>
    initialBlocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null
  );
  const [isFetching, setIsFetching] = useState(false);
  const [resolvedCacheKey, setResolvedCacheKey] = useState(() =>
    !hasWarmCache && !initialBlocked && rawSnapshot != null ? '' : cacheKey
  );
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(hasWarmCache || initialData !== null || initialBlocked));

  const isScopeProvided = scopeId !== undefined ? Boolean(scopeId) : true;
  const effectiveResolvedKey = hasWarmCache ? cacheKey : resolvedCacheKey;
  if (hasWarmCache && (resolvedCacheKey !== cacheKey || !hasLoadedOnce) && isScopeProvided && enabled) {
    setDataState(warmPayload);
    setResolvedCacheKey(cacheKey);
    setHasLoadedOnce(true);
    setError(warmBlocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null);
  }
  const data = effectiveResolvedKey === cacheKey && hasWarmCache && resolvedCacheKey !== cacheKey
    ? warmPayload
    : stateData;

  const queryFnRef = useRef(queryFn);
  const requestGeneration = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const isCompatibilityBlockedRef = useRef(isCompatibilityBlocked);
  const pendingCleanupAbortRef = useRef<{ cacheKey: string; abort: () => void } | null>(null);
  useEffect(() => {
    queryFnRef.current = queryFn;
    isCompatibilityBlockedRef.current = isCompatibilityBlocked;
  }, [isCompatibilityBlocked, queryFn]);

  const hasHydratedData = Boolean(data !== null || initialBlocked);
  const hasResolvedKey = Boolean(hasWarmCache || (hasLoadedOnce && effectiveResolvedKey === cacheKey));
  const isCatalogBusy = Boolean(isCatalogLoading && !hasHydratedData && !hasResolvedKey);
  const currentError = useMemo(() => (
    effectiveResolvedKey === cacheKey
      ? (hasWarmCache && resolvedCacheKey !== cacheKey
          ? (warmBlocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null)
          : error)
      : null
  ), [cacheKey, effectiveResolvedKey, error, hasWarmCache, resolvedCacheKey, warmBlocked]);
  const isQueryLoading = !hasHydratedData && isScopeProvided && (isFetching || !hasResolvedKey);

  const refetch = useCallback(async (force = false) => {
    if (!isScopeProvided || !enabled) return;
    const generation = ++requestGeneration.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;

    const cachedEntry = !force ? serverStateCache.get<unknown>(cacheKey) : null;
    if (cachedEntry && !cachedEntry.isStale) {
      const currentCached = cachedEntry.data;
      const payload = resolveCachePayload<TData>(currentCached);
      setDataState(payload);
      if (hasCompatibilityFlag(currentCached) && currentCached.isCompatibilityBlocked) {
        setError(new Error('LEGACY_DAILY_LINEAGE_MISSING'));
      } else {
        setError(null);
      }
      setHasLoadedOnce(true);
      setResolvedCacheKey(cacheKey);
      setIsFetching(false);
      if (snapshotKey) {
        serverStateCache.set(snapshotKey, {
          data: payload,
          isCompatibilityBlocked: hasCompatibilityFlag(currentCached)
            ? currentCached.isCompatibilityBlocked
            : false,
        });
      }
      return;
    }

    setIsFetching(true);

    try {
      const result = await queryFnRef.current(undefined, controller.signal);
      if (generation !== requestGeneration.current) return;
      setError(null);
      setDataState(result);
      setHasLoadedOnce(true);
      setResolvedCacheKey(cacheKey);
      serverStateCache.set(cacheKey, result);
      if (snapshotKey) {
        const entry: CacheWrapper<TData> = { data: result, isCompatibilityBlocked: false };
        serverStateCache.set(snapshotKey, entry);
      }
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setResolvedCacheKey(cacheKey);
      setHasLoadedOnce(true);
      const blocked = isCompatibilityBlockedRef.current ? isCompatibilityBlockedRef.current(cause, cachedEntry?.data) : false;
      if (blocked) {
        setError(new Error('LEGACY_DAILY_LINEAGE_MISSING'));
        const entry: CacheWrapper<TData> = { data: null, isCompatibilityBlocked: true };
        serverStateCache.set(cacheKey, entry);
        if (snapshotKey) {
          serverStateCache.set(snapshotKey, entry);
        }
      } else {
        setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu trạm vận hành.'));
      }
    } finally {
      if (generation === requestGeneration.current) setIsFetching(false);
    }
  }, [cacheKey, enabled, isScopeProvided, snapshotKey]);

  useEffect(() => {
    if (pendingCleanupAbortRef.current) {
      const pending = pendingCleanupAbortRef.current;
      pendingCleanupAbortRef.current = null;
      if (pending.cacheKey !== cacheKey || !isScopeProvided || !enabled) {
        pending.abort();
      }
    }
    if (!isScopeProvided || !enabled) return;
    const entryOnMount = serverStateCache.get<unknown>(cacheKey);
    if (entryOnMount && !entryOnMount.isStale && cacheKey.startsWith('mrx_')) {
      if (snapshotKey) {
        const payload = resolveCachePayload<TData>(entryOnMount.data);
        const blocked = hasCompatibilityFlag(entryOnMount.data) && Boolean(entryOnMount.data.isCompatibilityBlocked);
        serverStateCache.set(snapshotKey, { data: payload, isCompatibilityBlocked: blocked });
      }
      return;
    }
    let ignore = false;
    const generation = ++requestGeneration.current;
    let inFlight = inFlightWorkbenchQueries.get(cacheKey);
    if (!inFlight || inFlight.controller.signal.aborted) {
      const controller = new AbortController();
      activeController.current = controller;
      const promise = queryFnRef.current(undefined, controller.signal).finally(() => {
        const current = inFlightWorkbenchQueries.get(cacheKey);
        if (current?.promise === promise) {
          inFlightWorkbenchQueries.delete(cacheKey);
        }
      });
      inFlight = { promise, controller, subscribers: 1 };
      inFlightWorkbenchQueries.set(cacheKey, inFlight);
    } else {
      inFlight.subscribers += 1;
      activeController.current = inFlight.controller;
    }
    const sharedPromise = inFlight.promise as Promise<TData>;
    sharedPromise
      .then((result) => {
        if (ignore || generation !== requestGeneration.current) return;
        setDataState(result);
        setIsFetching(false);
        setHasLoadedOnce(true);
        setResolvedCacheKey(cacheKey);
        serverStateCache.set(cacheKey, result);
        if (snapshotKey) {
          const entry: CacheWrapper<TData> = { data: result, isCompatibilityBlocked: false };
          serverStateCache.set(snapshotKey, entry);
        }
        setError(null);
      })
      .catch((cause: unknown) => {
        if (ignore || generation !== requestGeneration.current) return;
        setIsFetching(false);
        setHasLoadedOnce(true);
        setResolvedCacheKey(cacheKey);
        const blocked = isCompatibilityBlockedRef.current
          ? isCompatibilityBlockedRef.current(cause)
          : false;
        if (blocked) {
          setError(new Error('LEGACY_DAILY_LINEAGE_MISSING'));
          const entry: CacheWrapper<TData> = { data: null, isCompatibilityBlocked: true };
          serverStateCache.set(cacheKey, entry);
          if (snapshotKey) serverStateCache.set(snapshotKey, entry);
        } else {
          setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu trạm vận hành.'));
        }
      });
    return () => {
      ignore = true;
      requestGeneration.current += 1;
      const current = inFlightWorkbenchQueries.get(cacheKey);
      if (current && current.promise === sharedPromise) {
        current.subscribers -= 1;
        const maybeAbort = () => {
          const latest = inFlightWorkbenchQueries.get(cacheKey);
          if (latest && latest.promise === sharedPromise && latest.subscribers <= 0) {
            latest.controller.abort();
            inFlightWorkbenchQueries.delete(cacheKey);
          }
        };
        const pendingEntry = { cacheKey, abort: maybeAbort };
        pendingCleanupAbortRef.current = pendingEntry;
        queueMicrotask(() => {
          if (pendingCleanupAbortRef.current === pendingEntry) {
            pendingCleanupAbortRef.current = null;
          }
          maybeAbort();
        });
      }
    };
  }, [cacheKey, enabled, isScopeProvided, snapshotKey]);

  useEffect(() => {
    if (!cacheKey.startsWith('mrx_')) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refetch(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cacheKey, refetch]);

  const setData = useCallback((updater: TData | null | ((prev: TData | null) => TData | null)) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: TData | null) => TData | null)(prev) : updater;
      serverStateCache.set(cacheKey, next);
      if (snapshotKey) {
        const entry: CacheWrapper<TData> = { data: next, isCompatibilityBlocked: false };
        serverStateCache.set(snapshotKey, entry);
      }
      return next;
    });
  }, [cacheKey, snapshotKey]);

  // Derive mathematical 5-Layer State
  const layer: WorkbenchLayer = useMemo(() => {
    if (hasHydratedData && !currentError) return 'L1_HYDRATED_READY';
    if (currentError !== null || initialBlocked) return 'L2_ERROR_OR_BLOCKED';
    if (isCatalogBusy || (isScopeProvided && isQueryLoading)) return 'L3_BOOTSTRAPPING_OR_LOADING';
    if (!isScopeProvided) return 'L4_NO_SCOPE_AVAILABLE';
    return 'L5_EMPTY_DATASET';
  }, [currentError, hasHydratedData, initialBlocked, isCatalogBusy, isQueryLoading, isScopeProvided]);

  const isRowsEmpty = Boolean(
    hasHydratedData && data && isDatasetEmpty
      ? isDatasetEmpty(data)
      : (!hasHydratedData && hasResolvedKey && isScopeProvided && enabled && !currentError)
  );

  const effectiveIsFetching = isFetching || (data !== null && effectiveResolvedKey !== cacheKey);

  const isEmpty =
    (!hasHydratedData && !isCatalogBusy && !isQueryLoading && !isScopeProvided) ||
    ((hasHydratedData || hasResolvedKey) && !isCatalogBusy && !isQueryLoading && !effectiveIsFetching && !currentError && isRowsEmpty);

  const isLoading = !hasHydratedData && (isCatalogBusy || (isScopeProvided && isQueryLoading));

  const stateProps = useMemo(() => ({
    isLoading,
    isFetching: effectiveIsFetching,
    isPreviousData: data !== null && effectiveResolvedKey !== cacheKey,
    hasExistingData: hasHydratedData,
    error: currentError,
    isEmpty,
    emptyTitle: !isScopeProvided ? (emptyTitle || 'Chưa có phạm vi dữ liệu') : emptyTitle,
    emptyDescription,
    emptyScenario,
    isPartial: initialBlocked,
  }), [cacheKey, data, effectiveResolvedKey, emptyDescription, emptyScenario, emptyTitle, currentError, hasHydratedData, initialBlocked, isEmpty, effectiveIsFetching, isLoading, isScopeProvided]);

  return {
    data,
    layer,
    stateProps,
    refetch,
    setData,
  };
}
