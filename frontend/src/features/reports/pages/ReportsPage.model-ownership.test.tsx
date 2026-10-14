import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  movementTypeLabel,
  priceSubViewTabs,
  readPageSize,
  readPositiveInteger,
  reportTabs,
  toReportView,
  validReportViews,
} from './reportsPageModelShared'

const mocks = vi.hoisted(() => ({
  priceVarianceLines: vi.fn(),
  priceVarianceSupplier: vi.fn(),
  priceVariancePeriod: vi.fn(),
  priceVarianceDishGroup: vi.fn(),
}))

vi.mock('@/api/reportsApi', () => ({
  useGetPriceVariancePageQuery: mocks.priceVarianceLines,
  useGetPriceVarianceBySupplierPageQuery: mocks.priceVarianceSupplier,
  useGetPriceVarianceByPeriodPageQuery: mocks.priceVariancePeriod,
  useGetPriceVarianceByDishGroupPageQuery: mocks.priceVarianceDishGroup,
}))

import { useReportsPriceViewModel } from './useReportsPriceViewModel'

const makeQuerySnapshot = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  currentData: undefined,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
  ...overrides,
})

describe('Reports page-model ownership and shared adapter contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.priceVarianceLines.mockReturnValue(makeQuerySnapshot({ isSuccess: true, data: { items: [], totalCount: 0 } }))
    mocks.priceVarianceSupplier.mockReturnValue(makeQuerySnapshot({ isSuccess: true, data: { items: [], totalCount: 0 } }))
    mocks.priceVariancePeriod.mockReturnValue(makeQuerySnapshot({ isSuccess: true, data: { items: [], totalCount: 0 } }))
    mocks.priceVarianceDishGroup.mockReturnValue(makeQuerySnapshot({ isSuccess: true, data: { items: [], totalCount: 0 } }))
  })

  it('toReportView transforms query snapshots into standard QueryView with domain messaging', () => {
    // 1. Uninitialized
    const uninit = toReportView(makeQuerySnapshot({ isUninitialized: true }), 'Biến động giá')
    expect(uninit).toEqual({
      phase: 'uninitialized',
      instruction: 'Mở báo cáo Biến động giá để tải dữ liệu.',
    })

    // 2. Forbidden (403)
    const forbidden = toReportView(
      makeQuerySnapshot({ isError: true, error: { status: 403 } }),
      'Sổ luân chuyển kho',
    )
    expect(forbidden).toEqual({
      phase: 'forbidden',
      message: 'Bạn không có quyền xem báo cáo Sổ luân chuyển kho.',
    })

    // 3. Error
    const errorView = toReportView(
      makeQuerySnapshot({ isError: true, error: { status: 500 } }),
      'Kế hoạch thu mua',
    )
    expect(errorView.phase).toBe('error')
    if (errorView.phase === 'error') {
      expect(errorView.message).toBe('Không tải được báo cáo Kế hoạch thu mua.')
      expect(errorView.isRetrying).toBe(false)
    }

    // 4. Ready
    const readyView = toReportView(
      makeQuerySnapshot({ isSuccess: true, data: [{ id: 'row-1' }] }),
      'Biến động giá',
    )
    expect(readyView.phase).toBe('ready')
    if (readyView.phase === 'ready') {
      expect(readyView.data).toEqual([{ id: 'row-1' }])
      expect(readyView.isRefreshing).toBe(false)
    }
  })

  it('declares the 9 canonical report views and domain labels', () => {
    expect(validReportViews).toEqual([
      'price',
      'demand',
      'purchase',
      'stock',
      'movement',
      'kitchen',
      'usage',
      'audit',
      'data-quality',
    ])

    expect(reportTabs).toHaveLength(9)
    expect(movementTypeLabel.receipt).toBe('Nhập kho')
    expect(movementTypeLabel.issue).toBe('Xuất kho')
    expect(movementTypeLabel.supplemental).toBe('Xuất bổ sung')
    expect(movementTypeLabel.return).toBe('Trả kho')
    expect(movementTypeLabel.adjustment).toBe('Điều chỉnh')

    expect(priceSubViewTabs.map((t) => t.id)).toEqual(['lines', 'supplier', 'period', 'dishGroup'])
  })

  it('safely parses positive integers and constrained page sizes', () => {
    expect(readPositiveInteger('15', 1)).toBe(15)
    expect(readPositiveInteger('0', 1)).toBe(1)
    expect(readPositiveInteger('-5', 1)).toBe(1)
    expect(readPositiveInteger('abc', 1)).toBe(1)
    expect(readPositiveInteger(null, 1)).toBe(1)

    expect(readPageSize('20', 8, [8, 20, 50])).toBe(20)
    expect(readPageSize('99', 8, [8, 20, 50])).toBe(8)
    expect(readPageSize(null, 8, [8, 20, 50])).toBe(8)
  })

  it('skips inactive view and subview queries in useReportsPriceViewModel', () => {
    // When activeView is 'demand' (not 'price'), price queries are skipped
    renderHook(() =>
      useReportsPriceViewModel({
        activeView: 'demand',
        initialPage: 1,
        priceSubView: 'lines',
        reportQuery: {},
        searchParams: new URLSearchParams(),
      }),
    )

    expect(mocks.priceVarianceLines).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    )
    expect(mocks.priceVarianceSupplier).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    )

    // When activeView is 'price' and priceSubView is 'lines', lines query is active
    mocks.priceVarianceLines.mockClear()
    mocks.priceVarianceSupplier.mockClear()

    renderHook(() =>
      useReportsPriceViewModel({
        activeView: 'price',
        initialPage: 1,
        priceSubView: 'lines',
        reportQuery: {},
        searchParams: new URLSearchParams(),
      }),
    )

    expect(mocks.priceVarianceLines).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: false }),
    )
    expect(mocks.priceVarianceSupplier).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    )
  })
})
