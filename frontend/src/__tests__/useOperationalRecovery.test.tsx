// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOperationalRecovery, executeSafeMutation } from '../hooks/useOperationalRecovery';
import { serverStateCache } from '../store/serverStateCache';
import { ApiError } from '../api/client';

describe('useOperationalRecovery', () => {
  beforeEach(() => {
    serverStateCache.clearAll();
    vi.clearAllMocks();
  });

  interface SampleItem {
    id: string;
    name: string;
  }

  interface SampleFilter {
    search: string;
    status: string;
  }

  const defaultFilters: SampleFilter = { search: '', status: 'ALL' };

  it('keeps filtered pages out of the default-filter cache when filter-scoped caching is requested', async () => {
    const filtered = { search: 'AMANN', status: 'PENDING' };
    const rows = [{ id: 'filtered', name: 'AMANN request' }];
    const view = renderHook(() => useOperationalRecovery({ queryKey: 'actor:mode:1',
      cacheByFilters: true, initialFilters: filtered, defaultFilters,
      fetcher: async () => rows }));
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.data).toEqual(rows);
    view.unmount();
    const reopened = renderHook(() => useOperationalRecovery<SampleItem[], SampleFilter>({
      queryKey: 'actor:mode:1', cacheByFilters: true, initialFilters: defaultFilters, defaultFilters,
      fetcher: () => new Promise(() => {}) }));
    expect(reopened.result.current.data).toBeNull();
    expect(reopened.result.current.isLoading).toBe(true);
  });

  it('provides SWR cache hit immediately when available in serverStateCache', async () => {
    const cachedData: SampleItem[] = [{ id: '1', name: 'Item 1' }];
    serverStateCache.set('test_key', cachedData);

    const freshData: SampleItem[] = [{ id: '1', name: 'Item 1 Updated' }];
    const fetcher = vi.fn().mockResolvedValue(freshData);

    const { result } = renderHook(() =>
      useOperationalRecovery<SampleItem[], SampleFilter>({
        queryKey: 'test_key',
        fetcher,
        initialFilters: defaultFilters,
        defaultFilters,
      })
    );

    // Initial state has cached data
    expect(result.current.data).toEqual(cachedData);
    expect(result.current.isLoading).toBe(false);

    // Wait for fresh data fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(freshData);
    expect(result.current.isFetching).toBe(false);
  });

  it('computes emptyScenario as filter-empty when result is empty and filters differ from default', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const activeFilters: SampleFilter = { search: 'unknown', status: 'PENDING' };

    const { result } = renderHook(() =>
      useOperationalRecovery<SampleItem[], SampleFilter>({
        queryKey: 'empty_filter_key',
        fetcher,
        initialFilters: activeFilters,
        defaultFilters,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.emptyScenario).toBe('filter-empty');

    // Calling handleResetFilters resets to defaultFilters
    act(() => {
      result.current.handleResetFilters();
    });

    expect(result.current.filters).toEqual(defaultFilters);
  });

  it('captures fetch error and provides handleRetry', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([{ id: '2', name: 'Item 2' }]);

    const { result } = renderHook(() =>
      useOperationalRecovery<SampleItem[], SampleFilter>({
        queryKey: 'error_retry_key',
        fetcher,
        initialFilters: defaultFilters,
        defaultFilters,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');

    // Retry
    await act(async () => {
      await result.current.handleRetry();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([{ id: '2', name: 'Item 2' }]);
  });

  it('keeps the current result during a transient refresh failure and clears it on denial', async () => {
    const data = [{ id: '1', name: 'Dữ liệu đã tải' }];
    const fetcher = vi.fn().mockResolvedValueOnce(data)
      .mockRejectedValueOnce(new ApiError(500, 'Lỗi tải lại'))
      .mockRejectedValueOnce(new ApiError(403, 'Quyền đã thay đổi'));
    const { result } = renderHook(() => useOperationalRecovery({
      queryKey: 'refresh_scope', fetcher, initialFilters: defaultFilters, defaultFilters,
    }));

    await act(async () => {});
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error?.message).toBe('Lỗi tải lại');
    expect(result.current.data).toEqual(data);

    await act(async () => { await result.current.refetch(); });
    expect(result.current.error?.message).toBe('Quyền đã thay đổi');
    expect(result.current.data).toBeNull();
    expect(serverStateCache.get('refresh_scope')).toBeNull();
  });
});

describe('executeSafeMutation', () => {
  it('returns success result and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const mutationFn = vi.fn().mockResolvedValue({ success: true, id: '123' });

    const result = await executeSafeMutation({
      mutationFn,
      payload: { name: 'New Item' },
      onSuccess,
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ success: true, id: '123' });
    expect(onSuccess).toHaveBeenCalledWith({ success: true, id: '123' });
    expect(result.preservedPayload).toEqual({ name: 'New Item' });
  });

  it('preserves payload and detects 409 conflict when mutation fails with ApiError(409)', async () => {
    const conflictError = new ApiError(409, 'Hồ sơ đã được duyệt bởi người dùng khác.');
    const mutationFn = vi.fn().mockRejectedValue(conflictError);
    const onConflict = vi.fn();

    const result = await executeSafeMutation({
      mutationFn,
      payload: { decisionReason: 'Chưa đủ chứng từ', version: 1 },
      onConflict,
    });

    expect(result.ok).toBe(false);
    expect(result.isConflict).toBe(true);
    expect(result.error).toBe(conflictError);
    expect(result.preservedPayload).toEqual({ decisionReason: 'Chưa đủ chứng từ', version: 1 });
    expect(onConflict).toHaveBeenCalledWith(conflictError);
  });

  it('preserves payload on general Error without crashing', async () => {
    const generalError = new Error('500 Server Error');
    const mutationFn = vi.fn().mockRejectedValue(generalError);

    const result = await executeSafeMutation({
      mutationFn,
      payload: { quantity: 15 },
    });

    expect(result.ok).toBe(false);
    expect(result.isConflict).toBe(false);
    expect(result.error?.message).toBe('500 Server Error');
    expect(result.preservedPayload).toEqual({ quantity: 15 });
  });
});
