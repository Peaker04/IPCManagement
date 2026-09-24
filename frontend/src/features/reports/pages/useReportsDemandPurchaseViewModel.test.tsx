import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  demand: vi.fn(),
  purchase: vi.fn(),
}));

vi.mock('@/api/reportsApi', () => ({
  useGetIngredientDemandAggregatePageQuery: mocks.demand,
  useGetPurchasePlanPageQuery: mocks.purchase,
}));

import { useReportsDemandPurchaseViewModel } from './useReportsDemandPurchaseViewModel';

const readyQuery = (data: unknown) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
});

describe('useReportsDemandPurchaseViewModel', () => {
  beforeEach(() => {
    mocks.demand.mockReset();
    mocks.purchase.mockReset();
    mocks.demand.mockReturnValue(readyQuery({ items: [], totalCount: 0, shortageCount: 0 }));
    mocks.purchase.mockReturnValue(readyQuery({
      items: [],
      totalCount: 0,
      totalShortageQty: 0,
      totalEstimatedAmount: 0,
    }));
  });

  it('exports gross handoff rather than historical allocation or suggested buying and uses filtered server counts', () => {
    const row = { serviceDate: '2026-08-15', material: 'Gạo', source: 'Khách A · 25k', required: 200,
      available: 200, issuedQty: 80, receivedByKitchenQty: 30, remainingToIssueQty: 120,
      pendingKitchenReceiptQty: 50, unit: 'kg', status: 'Chưa xuất' };
    mocks.demand.mockReturnValue(readyQuery({ items: [row], totalCount: 42, shortageCount: 0, remainingToIssueCount: 17 }));
    const { result } = renderHook(() => useReportsDemandPurchaseViewModel({
      activeView: 'demand', initialPage: 3, reportQuery: { customerId: 'customer-a', dateFrom: '2026-08-15', dateTo: '2026-08-15' }, searchParams: new URLSearchParams(),
    }));
    const columns = result.current.exportConfigs.demand.columns;
    expect(Object.fromEntries(columns.map(([label, value]) => [label, value(row)]))).toMatchObject({
      'Đã xuất': 80, 'Chưa xuất': 120, 'Bếp đã nhận': 30, 'Chờ Bếp nhận': 50,
    });
    expect(columns.map(([label]) => label)).not.toContain('Tồn hiện có');
    expect(columns.map(([label]) => label)).not.toContain('Thiếu/mua');
    expect(result.current.shortageCount).toBe(17);
    expect(mocks.demand).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer-a', dateFrom: '2026-08-15', pageNumber: 3 }), { skip: false });
  });

  it('sends the trimmed purchase search and resets pagination before querying', async () => {
    const { result } = renderHook(() => useReportsDemandPurchaseViewModel({
      activeView: 'purchase',
      initialPage: 3,
      reportQuery: { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
      searchParams: new URLSearchParams(),
    }));

    expect(mocks.purchase).toHaveBeenLastCalledWith(expect.objectContaining({
      pageNumber: 3,
      searchKeyword: undefined,
    }), { skip: false });

    act(() => result.current.setPurchaseSearch('  Bột nở  '));

    await waitFor(() => expect(mocks.purchase).toHaveBeenLastCalledWith(expect.objectContaining({
      pageNumber: 1,
      searchKeyword: 'Bột nở',
    }), { skip: false }));
  });
});
