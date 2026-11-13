import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  apiClient: vi.fn().mockResolvedValue({}),
}));

import { apiClient } from '../api/client';
import { invalidateMrxCaches } from '../api/mrxCacheInvalidation';
import { toMrxErrorMessage } from '../api/mrxErrors';
import { mrxApi } from '../api/mrxApi';
import { getMrxShiftLabel } from '../constants/mrxConstants';
import { useWorkbenchQuery } from '../hooks/useWorkbenchQuery';
import { serverStateCache } from '../store/serverStateCache';

describe('MRX source edit frontend foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverStateCache.clearAll();
  });

  it.each([
    ['EVENING', 'Tối'], ['Ca tối', 'Tối'],
    ['FULLDAY', 'Cả ngày'], ['Cả ngày', 'Cả ngày'],
  ])('labels backend cooking shift %s as %s', (shift, label) => {
    expect(getMrxShiftLabel(shift)).toBe(label);
  });

  it('deletePrefix removes matching memory and session entries and notifies listeners', () => {
    const listener = vi.fn();
    serverStateCache.set('mrx_batch_1', { id: 'batch-1' });
    serverStateCache.set('mrx_batch_2', { id: 'batch-2' });
    serverStateCache.set('catalog_customers', [{ id: 'customer-1' }]);
    const unsubscribe = serverStateCache.subscribe('mrx_batch_1', listener);

    serverStateCache.deletePrefix('mrx_');

    expect(serverStateCache.get('mrx_batch_1')).toBeNull();
    expect(serverStateCache.get('mrx_batch_2')).toBeNull();
    expect(serverStateCache.get('catalog_customers')?.data).toEqual([{ id: 'customer-1' }]);
    expect(sessionStorage.getItem('ipc_l2_cache:mrx_batch_1')).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('invalidateMrxCaches clears only MRX cache and snapshot keys', () => {
    serverStateCache.set('mrx_daily_batch-1', { id: 'daily' });
    serverStateCache.set('snapshot:mrx_daily', { id: 'snapshot' });
    serverStateCache.set('catalog_customers', [{ id: 'customer-1' }]);

    invalidateMrxCaches();

    expect(serverStateCache.get('mrx_daily_batch-1')).toBeNull();
    expect(serverStateCache.get('snapshot:mrx_daily')).toBeNull();
    expect(serverStateCache.get('catalog_customers')).not.toBeNull();
  });

  it('visibility change force-refetches an active MRX query', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 'batch-1' });

    renderHook(() => useWorkbenchQuery({
      scopeKey: 'mrx_test',
      cacheKey: 'mrx_test_batch-1',
      scopeId: 'batch-1',
      queryFn,
    }));

    await waitFor(() => expect(queryFn).toHaveBeenCalledOnce());

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it('formats locked dates from a typed MRX conflict', () => {
    expect(toMrxErrorMessage({
      code: 'MRX_DAY_LOCKED',
      message: 'locked',
      lockedDates: ['2026-06-15'],
    })).toEqual({
      code: 'MRX_DAY_LOCKED',
      message: 'Các ngày đã xuất kho không thể sửa: 15/06',
      lockedDates: ['2026-06-15'],
    });
  });

  it('successful MRX mutations invalidate cached MRX data', async () => {
    const sourceChange = {
      customerId: 'customer-1',
      weekStartDate: '2026-06-15',
      expectedBaseMenuVersionId: 'menu-v1',
      expectedBatchVersion: 2,
      reason: 'Điều chỉnh nguồn',
      lines: [{ serviceDate: '2026-06-15', shiftName: 'MORNING', dishSlot: 'savory-main', newDishId: 'dish-2' }],
    };

    serverStateCache.set('mrx_source_customer-1', { id: 'cached' });
    await mrxApi.applySourceChange(sourceChange);
    expect(serverStateCache.get('mrx_source_customer-1')).toBeNull();

    serverStateCache.set('mrx_daily_batch-1', { id: 'cached' });
    await mrxApi.createIssue({
      commandId: 'command-1',
      expectedVersion: 1,
      issueDate: '2026-06-15',
      reconciliationBatchId: 'batch-1',
      isSupplemental: false,
      lines: [{
        reconciliationBatchLineId: 'line-1',
        reconciliationBatchDailyLineId: 'daily-1',
        ingredientId: 'ingredient-1',
        unitId: 'unit-1',
        requestedQty: 1,
        issuedQty: 1,
      }],
    });
    expect(serverStateCache.get('mrx_daily_batch-1')).toBeNull();
    expect(apiClient).toHaveBeenCalledTimes(2);
  });
});
