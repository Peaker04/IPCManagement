import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkbenchQuery } from '../hooks/useWorkbenchQuery';
import { serverStateCache } from '../store/serverStateCache';

describe('useWorkbenchQuery — Canonical 5-Layer State Engine Unit Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverStateCache.clearAll();
  });

  it('pauses I/O during a debounced criterion without declaring an empty dataset', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 'ready' });
    const { result, rerender } = renderHook(({ enabled }) => useWorkbenchQuery({
      scopeKey: 'paused-search', cacheKey: 'paused-search', enabled, queryFn,
    }), { initialProps: { enabled: false } });
    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.stateProps.isEmpty).toBe(false);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual({ id: 'ready' }));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('aborts obsolete transport while preserving new criteria against delayed publication', async () => {
    const signals: Array<AbortSignal | undefined> = [];
    let resolveOld!: (data: { id: string }) => void;
    const old = new Promise<{ id: string }>(resolve => { resolveOld = resolve; });
    const { result, rerender } = renderHook(({ key }) => useWorkbenchQuery({
      scopeKey: 'transport-race', cacheKey: key,
      queryFn: (_params, signal) => { signals.push(signal); return key === 'old' ? old : Promise.resolve({ id: 'new' }); },
    }), { initialProps: { key: 'old' } });
    rerender({ key: 'new' });
    expect(signals[0]?.aborted).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ id: 'new' }));
    await act(async () => { resolveOld({ id: 'late-old' }); });
    expect(result.current.data).toEqual({ id: 'new' });
    expect(signals[1]?.aborted).toBe(false);
  });

  it('does not publish an old manual refresh into a new scope or its snapshot', async () => {
    let resolveOld!: (data: { id: string }) => void;
    const oldRefresh = new Promise<{ id: string }>((resolve) => { resolveOld = resolve; });
    let callsA = 0;
    const { result, rerender } = renderHook(({ key }) => useWorkbenchQuery({
      scopeKey: 'refresh-race', cacheKey: key, snapshotKey: 'snapshot:refresh-race', scopeId: key,
      queryFn: () => key === 'a' && ++callsA > 1 ? oldRefresh : Promise.resolve({ id: key }),
    }), { initialProps: { key: 'a' } });
    await waitFor(() => expect(result.current.data).toEqual({ id: 'a' }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.refetch(true); });
    rerender({ key: 'b' });
    await waitFor(() => expect(result.current.data).toEqual({ id: 'b' }));
    await act(async () => { resolveOld({ id: 'old-a' }); await pending; });
    expect(result.current.data).toEqual({ id: 'b' });
    expect(serverStateCache.get('snapshot:refresh-race')?.data).toMatchObject({ data: { id: 'b' } });
  });

  // --------------------------------------------------------------------------
  // TEST 1: L1 HYDRATED READY (0ms Synchronous Hydration from SWR Cache)
  // --------------------------------------------------------------------------
  it('L1 Hydrated Ready: Synchronously resolves data from SWR cache with isLoading=false, hasExistingData=true', () => {
    const mockData = { id: 'd-1', name: 'Authoritative Item' };
    serverStateCache.set('mrx_test_1', { data: mockData, isCompatibilityBlocked: false });

    const queryFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useWorkbenchQuery({
        scopeKey: 'test_scope',
        cacheKey: 'mrx_test_1',
        queryFn,
        scopeId: '1',
      })
    );

    // Synchronous assertions on initial render tick:
    expect(result.current.layer).toBe('L1_HYDRATED_READY');
    expect(result.current.data).toEqual(mockData);
    expect(result.current.stateProps.isLoading).toBe(false);
    expect(result.current.stateProps.hasExistingData).toBe(true);
    expect(result.current.stateProps.isEmpty).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 2: L2 COMPATIBILITY BLOCKED (409 Legacy Cache Surfaces Instantly)
  // --------------------------------------------------------------------------
  it('L2 Compatibility Blocked: Cached 409 legacy state surfaces blocked error with 0 skeleton', () => {
    serverStateCache.set('mrx_test_blocked', { data: null, isCompatibilityBlocked: true });

    const queryFn = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() =>
      useWorkbenchQuery({
        scopeKey: 'test_scope',
        cacheKey: 'mrx_test_blocked',
        queryFn,
        scopeId: 'blocked',
      })
    );

    expect(result.current.layer).toBe('L2_ERROR_OR_BLOCKED');
    expect(result.current.stateProps.isLoading).toBe(false);
    expect(result.current.stateProps.isPartial).toBe(true);
    expect(result.current.stateProps.error).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // TEST 3: L3 BOOTSTRAPPING (Empty cache + catalog pending => SKELETON, never EMPTY)
  // --------------------------------------------------------------------------
  it('L3 Bootstrapping: While catalog is loading, isLoading=true, and isEmpty is strictly FALSE', () => {
    const queryFn = vi.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useWorkbenchQuery({
        scopeKey: 'test_scope',
        cacheKey: 'mrx_test_empty',
        queryFn,
        scopeId: '', // catalog not resolved yet
        isCatalogLoading: true,
      })
    );

    expect(result.current.layer).toBe('L3_BOOTSTRAPPING_OR_LOADING');
    expect(result.current.stateProps.isLoading).toBe(true);
    expect(result.current.stateProps.hasExistingData).toBe(false);
    expect(result.current.stateProps.isEmpty).toBe(false); // MUST NOT BE EMPTY!
  });

  // --------------------------------------------------------------------------
  // TEST 4: L4 NO SCOPE AVAILABLE (Catalog loaded but 0 items in system)
  // --------------------------------------------------------------------------
  it('L4 No Scope Available: When catalog finished with 0 items, cleanly transitions to isEmpty=true with 0 skeleton', () => {
    const queryFn = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() =>
      useWorkbenchQuery({
        scopeKey: 'test_scope',
        cacheKey: 'mrx_test_noscope',
        queryFn,
        scopeId: '', // empty entity scope
        isCatalogLoading: false,
        emptyTitle: 'Chưa có lô đối soát',
      })
    );

    expect(result.current.layer).toBe('L4_NO_SCOPE_AVAILABLE');
    expect(result.current.stateProps.isLoading).toBe(false);
    expect(result.current.stateProps.isEmpty).toBe(true);
    expect(result.current.stateProps.emptyTitle).toBe('Chưa có lô đối soát');
  });

  // --------------------------------------------------------------------------
  // TEST 5: L5 EMPTY DATASET (Entity exists, loaded, but dataset has 0 lines)
  // --------------------------------------------------------------------------
  it('L5 Empty Dataset: Entity exists but has 0 lines, surfaces honest empty state with hasExistingData=true', async () => {
    const mockEmptyData = { lines: [] };
    const queryFn = vi.fn().mockResolvedValue(mockEmptyData);

    const { result } = renderHook(() =>
      useWorkbenchQuery({
        scopeKey: 'test_scope',
        cacheKey: 'mrx_test_empty_lines',
        queryFn,
        scopeId: 'b-empty',
        isCatalogLoading: false,
        isDatasetEmpty: (d: { lines: unknown[] }) => d.lines.length === 0,
      })
    );

    await waitFor(() => {
      expect(result.current.stateProps.isLoading).toBe(false);
    });

    expect(result.current.layer).toBe('L1_HYDRATED_READY');
    expect(result.current.stateProps.hasExistingData).toBe(true);
    expect(result.current.stateProps.isEmpty).toBe(true); // honest empty state inside layer 1
  });

  // --------------------------------------------------------------------------
  // TEST 6: PARAMETER TRANSITION (keepPreviousData during async parameter shift)
  // --------------------------------------------------------------------------
  it('Transition keepPreviousData: Changing cacheKey preserves previous data with isFetching=true until resolution', async () => {
    const dataA = { id: 'a', title: 'Data A' };
    const dataB = { id: 'b', title: 'Data B' };

    serverStateCache.set('cache_A', { data: dataA, isCompatibilityBlocked: false });

    let resolveQueryB!: (data: typeof dataB) => void;
    const queryB = new Promise<typeof dataB>((resolve) => {
      resolveQueryB = resolve;
    });

    const queryFn = vi.fn().mockImplementation((key) => {
      if (key === 'cache_B') return queryB;
      return Promise.resolve(dataA);
    });

    const { result, rerender } = renderHook(
      ({ currentKey }) =>
        useWorkbenchQuery({
          scopeKey: 'test_scope',
          cacheKey: currentKey,
          queryFn: () => queryFn(currentKey),
          scopeId: currentKey,
        }),
      { initialProps: { currentKey: 'cache_A' } }
    );

    expect(result.current.data).toEqual(dataA);
    expect(result.current.stateProps.isLoading).toBe(false);

    // Transition to cache_B
    act(() => {
      rerender({ currentKey: 'cache_B' });
    });

    // During transition: dataA is KEPT on screen!
    expect(result.current.data).toEqual(dataA);
    expect(result.current.stateProps.isFetching).toBe(true);
    expect(result.current.stateProps.isLoading).toBe(false);

    // Resolve B
    await act(async () => {
      resolveQueryB(dataB);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(dataB);
      expect(result.current.stateProps.isFetching).toBe(false);
    });
  });

  it('C4: hydrates warm cache entry on cacheKey transition without firing network queryFn and respects cache TTL on visibilitychange', async () => {
    const dataA = { id: 'a', title: 'Warm A' };
    const dataB = { id: 'b', title: 'Warm B' };
    serverStateCache.set('mrx_warm_A', { data: dataA, isCompatibilityBlocked: false });
    serverStateCache.set('mrx_warm_B', { data: dataB, isCompatibilityBlocked: false });

    const queryFn = vi.fn().mockImplementation((key: string) =>
      Promise.resolve(key === 'mrx_warm_B' ? dataB : dataA)
    );

    const { result, rerender } = renderHook(
      ({ currentKey }) =>
        useWorkbenchQuery({
          scopeKey: 'mrx_warm',
          cacheKey: currentKey,
          queryFn: () => queryFn(currentKey),
          scopeId: currentKey,
        }),
      { initialProps: { currentKey: 'mrx_warm_A' } }
    );

    expect(result.current.data).toEqual(dataA);
    expect(queryFn).not.toHaveBeenCalled();

    // Switch to warm B -> must hydrate immediately from serverStateCache with zero network calls
    act(() => {
      rerender({ currentKey: 'mrx_warm_B' });
    });
    expect(result.current.data).toEqual(dataB);
    expect(result.current.stateProps.isPreviousData).toBe(false);
    expect(result.current.stateProps.isFetching).toBe(false);
    expect(queryFn).not.toHaveBeenCalled();

    // Trigger visibilitychange while cache is still fresh (< TTL) -> must NOT force network refetch
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(queryFn).not.toHaveBeenCalled();
  });
});
