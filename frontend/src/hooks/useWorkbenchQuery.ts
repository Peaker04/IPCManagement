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
  return typeof entry === 'object' && entry !== null && 'data' in entry;
}

function hasCompatibilityFlag(entry: unknown): entry is { isCompatibilityBlocked?: boolean } {
  return typeof entry === 'object' && entry !== null && 'isCompatibilityBlocked' in entry;
}

function resolveCachePayload<T>(entry: unknown): T | null {
  if (!entry) return null;
  return isCacheWrapper<T>(entry) ? entry.data : entry as T;
}

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

  const initialData = resolveCachePayload<TData>(rawSnapshot) ?? resolveCachePayload<TData>(rawCached);
  const initialBlocked = Boolean(
    (hasCompatibilityFlag(rawSnapshot) && rawSnapshot.isCompatibilityBlocked)
      || (hasCompatibilityFlag(rawCached) && rawCached.isCompatibilityBlocked)
  );

  const [stateData, setDataState] = useState<TData | null>(() => initialData);
  const [error, setError] = useState<Error | null>(() =>
    initialBlocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null
  );
  const [isFetching, setIsFetching] = useState(false);
  const [resolvedCacheKey, setResolvedCacheKey] = useState(cacheKey);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(initialData !== null || initialBlocked));

  const effectiveResolvedKey = hasWarmCache ? cacheKey : resolvedCacheKey;
  const data = effectiveResolvedKey === cacheKey && hasWarmCache && resolvedCacheKey !== cacheKey
    ? warmPayload
    : stateData;

  const queryFnRef = useRef(queryFn);
  const requestGeneration = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const isCompatibilityBlockedRef = useRef(isCompatibilityBlocked);
  useEffect(() => {
    queryFnRef.current = queryFn;
    isCompatibilityBlockedRef.current = isCompatibilityBlocked;
  }, [isCompatibilityBlocked, queryFn]);

  const isScopeProvided = scopeId !== undefined ? Boolean(scopeId) : true;
  const hasHydratedData = Boolean(data !== null || initialBlocked);
  const isCatalogBusy = Boolean(isCatalogLoading && !hasHydratedData);
  const currentError = useMemo(() => (
    effectiveResolvedKey === cacheKey
      ? (hasWarmCache && resolvedCacheKey !== cacheKey
          ? (warmBlocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null)
          : error)
      : null
  ), [cacheKey, effectiveResolvedKey, error, hasWarmCache, resolvedCacheKey, warmBlocked]);
  const isQueryLoading = !hasHydratedData && isScopeProvided && (isFetching || !hasLoadedOnce || effectiveResolvedKey !== cacheKey);

  const refetch = useCallback(async (force = false) => {
    if (!isScopeProvided || !enabled) return;
    const generation = ++requestGeneration.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;

    const currentCached = !force ? serverStateCache.get<unknown>(cacheKey)?.data : null;
    if (currentCached) {
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
    setError(null);

    try {
      const result = await queryFnRef.current(undefined, controller.signal);
      if (generation !== requestGeneration.current) return;
      setDataState(result);
      setHasLoadedOnce(true);
      setResolvedCacheKey(cacheKey);
      const entry: CacheWrapper<TData> = { data: result, isCompatibilityBlocked: false };
      serverStateCache.set(cacheKey, entry);
      if (snapshotKey) {
        serverStateCache.set(snapshotKey, entry);
      }
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setResolvedCacheKey(cacheKey);
      setHasLoadedOnce(true);
      const blocked = isCompatibilityBlockedRef.current ? isCompatibilityBlockedRef.current(cause, currentCached) : false;
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
    if (!isScopeProvided || !enabled) return;
    const entryOnMount = serverStateCache.get<unknown>(cacheKey);
    if (entryOnMount && !entryOnMount.isStale) {
      if (snapshotKey) {
        const payload = resolveCachePayload<TData>(entryOnMount.data);
        const blocked = hasCompatibilityFlag(entryOnMount.data) && Boolean(entryOnMount.data.isCompatibilityBlocked);
        serverStateCache.set(snapshotKey, { data: payload, isCompatibilityBlocked: blocked });
      }
      return;
    }
    let ignore = false;
    const generation = ++requestGeneration.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    queryFnRef.current(undefined, controller.signal)
      .then((result) => {
        if (ignore || generation !== requestGeneration.current) return;
        setDataState(result);
        setIsFetching(false);
        setHasLoadedOnce(true);
        setResolvedCacheKey(cacheKey);
        const entry: CacheWrapper<TData> = { data: result, isCompatibilityBlocked: false };
        serverStateCache.set(cacheKey, entry);
        if (snapshotKey) serverStateCache.set(snapshotKey, entry);
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
    return () => { ignore = true; requestGeneration.current += 1; activeController.current?.abort(); };
  }, [cacheKey, enabled, isScopeProvided, snapshotKey]);

  useEffect(() => {
    if (!cacheKey.startsWith('mrx_')) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refetch(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cacheKey, refetch]);

  const setData = useCallback((updater: TData | null | ((prev: TData | null) => TData | null)) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: TData | null) => TData | null)(prev) : updater;
      const entry: CacheWrapper<TData> = { data: next, isCompatibilityBlocked: false };
      serverStateCache.set(cacheKey, entry);
      if (snapshotKey) {
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

  const isRowsEmpty = Boolean(hasHydratedData && data && isDatasetEmpty ? isDatasetEmpty(data) : false);

  const effectiveIsFetching = isFetching || (data !== null && effectiveResolvedKey !== cacheKey);

  const isEmpty =
    (!hasHydratedData && !isCatalogBusy && !isQueryLoading && !isScopeProvided) ||
    (hasHydratedData && !isCatalogBusy && !isQueryLoading && !effectiveIsFetching && !currentError && isRowsEmpty);

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
