import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { serverStateCache } from '../store/serverStateCache';
import type { StateBoundaryProps } from '../components/workbench/StateBoundary';

export interface UseWorkbenchQueryOptions<TData, TParams = Record<string, unknown>> {
  scopeKey: string;
  cacheKey: string;
  snapshotKey?: string;
  queryFn: (params?: TParams) => Promise<TData>;
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
  scopeId,
  isCatalogLoading = false,
  isDatasetEmpty,
  isCompatibilityBlocked,
  emptyTitle,
  emptyDescription,
  emptyScenario = 'filter-empty',
}: UseWorkbenchQueryOptions<TData, TParams>): UseWorkbenchQueryResult<TData> {
  const rawSnapshot = snapshotKey ? serverStateCache.get<any>(snapshotKey)?.data : null;
  const rawCached = serverStateCache.get<any>(cacheKey)?.data;

  const resolvePayload = (entry: any): TData | null => {
    if (!entry) return null;
    if (entry.data !== undefined) return entry.data as TData;
    return entry as TData;
  };

  const initialData = resolvePayload(rawSnapshot) ?? resolvePayload(rawCached);
  const initialBlocked = Boolean(rawSnapshot?.isCompatibilityBlocked || rawCached?.isCompatibilityBlocked);

  const [data, setDataState] = useState<TData | null>(() => initialData);
  const [error, setError] = useState<Error | null>(() =>
    initialBlocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null
  );
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(initialData !== null || initialBlocked));

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const dataRef = useRef(data);
  dataRef.current = data;

  const isCompatibilityBlockedRef = useRef(isCompatibilityBlocked);
  isCompatibilityBlockedRef.current = isCompatibilityBlocked;

  const isScopeProvided = scopeId !== undefined ? Boolean(scopeId) : true;
  const hasHydratedData = Boolean(data !== null || initialBlocked);
  const isCatalogBusy = Boolean(isCatalogLoading && !hasHydratedData);
  const isQueryLoading = !hasHydratedData && isScopeProvided && !hasLoadedOnce;

  const refetch = useCallback(async (force = false) => {
    if (!isScopeProvided) return;

    const currentCached = !force ? serverStateCache.get<any>(cacheKey)?.data : null;
    if (currentCached) {
      const payload = resolvePayload(currentCached);
      setDataState(payload);
      if (currentCached.isCompatibilityBlocked) {
        setError(new Error('LEGACY_DAILY_LINEAGE_MISSING'));
      } else {
        setError(null);
      }
      setHasLoadedOnce(true);
      setIsFetching(false);
      if (snapshotKey) {
        serverStateCache.set(snapshotKey, { data: payload, isCompatibilityBlocked: currentCached.isCompatibilityBlocked });
      }
      return;
    }

    if (dataRef.current !== null) {
      setIsFetching(true);
    }
    setError(null);

    try {
      const result = await queryFnRef.current();
      setDataState(result);
      setHasLoadedOnce(true);
      const entry: CacheWrapper<TData> = { data: result, isCompatibilityBlocked: false };
      serverStateCache.set(cacheKey, entry);
      if (snapshotKey) {
        serverStateCache.set(snapshotKey, entry);
      }
    } catch (cause) {
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
      setIsFetching(false);
    }
  }, [cacheKey, isScopeProvided, snapshotKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

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
    if (hasHydratedData && !error) return 'L1_HYDRATED_READY';
    if (error !== null || initialBlocked) return 'L2_ERROR_OR_BLOCKED';
    if (isCatalogBusy || (isScopeProvided && isQueryLoading)) return 'L3_BOOTSTRAPPING_OR_LOADING';
    if (!isScopeProvided) return 'L4_NO_SCOPE_AVAILABLE';
    return 'L5_EMPTY_DATASET';
  }, [error, hasHydratedData, initialBlocked, isCatalogBusy, isQueryLoading, isScopeProvided]);

  const isRowsEmpty = Boolean(hasHydratedData && data && isDatasetEmpty ? isDatasetEmpty(data) : false);

  const isEmpty =
    (!hasHydratedData && !isCatalogBusy && !isQueryLoading && !isScopeProvided) ||
    (hasHydratedData && !isCatalogBusy && !isQueryLoading && !isFetching && !error && isRowsEmpty);

  const isLoading = !hasHydratedData && (isCatalogBusy || (isScopeProvided && isQueryLoading));

  const stateProps = useMemo(() => ({
    isLoading,
    isFetching,
    hasExistingData: hasHydratedData,
    error,
    isEmpty,
    emptyTitle: !isScopeProvided ? (emptyTitle || 'Chưa có phạm vi dữ liệu') : emptyTitle,
    emptyDescription,
    emptyScenario,
    isPartial: initialBlocked,
  }), [emptyDescription, emptyScenario, emptyTitle, error, hasHydratedData, initialBlocked, isCatalogBusy, isEmpty, isFetching, isLoading, isScopeProvided]);

  return {
    data,
    layer,
    stateProps,
    refetch,
    setData,
  };
}
