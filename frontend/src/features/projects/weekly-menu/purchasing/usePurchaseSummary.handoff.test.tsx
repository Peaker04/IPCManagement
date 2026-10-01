import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { usePurchaseSummary } from './usePurchaseSummary'

const query = vi.hoisted(() => ({ result: {} as Record<string, unknown>, call: vi.fn() }))
vi.mock('@/api/reportsApi', () => ({ useGetIngredientDemandAggregatePageQuery: (args: unknown) => { query.call(args); return query.result } }))

it('uses whole-filter issue and pending counts on every page, never legacy shortage or local fallback', () => {
  query.result = { currentData: { items: [], totalCount: 42, totalPages: 5, pageNumber: 3, pageSize: 10,
    shortageCount: 0, remainingToIssueCount: 17, pendingKitchenReceiptCount: 11 }, isSuccess: true }
  const { result, rerender } = renderHook(() => usePurchaseSummary({
    scopeKey: 'customer:week', customerId: 'customer-a', customerCode: 'A', customerLabel: 'A',
    weekStartDate: '2026-08-10', weekLabel: 'Tuần', materialSummary: {}, demandLines: [], aggregatedDemandLines: [],
  }))
  expect(result.current.presentation.shortageCount).toBe(17)
  expect(result.current.presentation.pendingKitchenCount).toBe(11)
  expect(result.current.presentation.totalItems).toBe(42)
  expect(query.call).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer-a', dateFrom: '2026-08-10', dateTo: '2026-08-16' }))
  query.result = { currentData: { items: [], totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 10,
    shortageCount: 99, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 }, isSuccess: true }
  rerender()
  expect(result.current.presentation.usesDemand).toBe(true)
  expect(result.current.presentation.totalItems).toBe(0)
  expect(result.current.presentation.shortageCount).toBe(0)
  expect(result.current.presentation.pendingKitchenCount).toBe(0)
})


it('suppresses previous-key rows while paging, then accepts current-key ready and denies cached data', () => {
  const options = { scopeKey: 'customer:week', customerId: 'customer-a', customerCode: 'A', customerLabel: 'A', weekStartDate: '2026-08-10', weekLabel: 'Tuần', materialSummary: {}, demandLines: [], aggregatedDemandLines: [] }
  const previous = { items: [{ id: 'previous' }], totalCount: 42, totalPages: 5, pageNumber: 1, remainingToIssueCount: 17, pendingKitchenReceiptCount: 11 }
  query.result = { data: previous, currentData: undefined, isFetching: true, isSuccess: true }
  const { result, rerender } = renderHook(() => usePurchaseSummary(options))
  expect(result.current.queryView?.phase).toBe('loading')
  expect(result.current.presentation.demandRows).toEqual([])
  query.result = { currentData: { ...previous, items: [{ id: 'current' }], pageNumber: 2 }, isSuccess: true, isFetching: true }
  rerender()
  expect(result.current.queryView).toMatchObject({ phase: 'ready', isRefreshing: true })
  expect(result.current.presentation.demandRows).toEqual([{ id: 'current' }])
  query.result = { currentData: previous, isError: true, error: { status: 403 } }
  rerender()
  expect(result.current.queryView?.phase).toBe('forbidden')
  expect(result.current.presentation.demandRows).toEqual([])
})
