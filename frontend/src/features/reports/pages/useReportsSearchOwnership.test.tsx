import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  dataQuality: vi.fn(),
  price: vi.fn(),
  priceBySupplier: vi.fn(),
  priceByPeriod: vi.fn(),
  priceByDishGroup: vi.fn(),
}));

vi.mock('@/features/reports/reportsApi', () => ({
  useGetAuditChangePageQuery: mocks.audit,
  useGetDataQualityPageQuery: mocks.dataQuality,
  useGetPriceVariancePageQuery: mocks.price,
  useGetPriceVarianceBySupplierPageQuery: mocks.priceBySupplier,
  useGetPriceVarianceByPeriodPageQuery: mocks.priceByPeriod,
  useGetPriceVarianceByDishGroupPageQuery: mocks.priceByDishGroup,
}));

import { useReportsAuditQualityViewModel } from './useReportsAuditQualityViewModel';
import { useReportsPriceViewModel } from './useReportsPriceViewModel';

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

describe('Reports server-search ownership', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.audit.mockReturnValue(readyQuery({ items: [], hasNext: false }));
    mocks.dataQuality.mockReturnValue(readyQuery({ page: { items: [], totalCount: 0 } }));
    mocks.price.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceBySupplier.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceByPeriod.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceByDishGroup.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
  });

  it('sends the trimmed data-quality search on the owned first page', async () => {
    const { result } = renderHook(() => useReportsAuditQualityViewModel({
      activeView: 'data-quality',
      initialPage: 3,
      operationalPageSize: 8,
      reportPageSize: 8,
      reportQuery: { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
      sortDirection: 'desc',
    }));

    act(() => result.current.setDataQualitySearch('  sai lệch  '));

    await waitFor(() => expect(mocks.dataQuality).toHaveBeenLastCalledWith(expect.objectContaining({
      pageNumber: 1,
      searchKeyword: 'sai lệch',
    }), { skip: false }));
  });

  it('sends the trimmed price search on the owned first page', async () => {
    const { result } = renderHook(() => useReportsPriceViewModel({
      activeView: 'price',
      initialPage: 4,
      priceSubView: 'lines',
      reportQuery: { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
      searchParams: new URLSearchParams(),
    }));

    act(() => result.current.setPriceSearch('  Bún  '));

    await waitFor(() => expect(mocks.price).toHaveBeenLastCalledWith(expect.objectContaining({
      pageNumber: 1,
      searchKeyword: 'Bún',
    }), { skip: false }));
  });
});
