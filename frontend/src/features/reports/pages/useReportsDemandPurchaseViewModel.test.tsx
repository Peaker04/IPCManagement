import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  demand: vi.fn(),
  purchase: vi.fn(),
}));

vi.mock('@/api/workflowApi', () => ({
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
