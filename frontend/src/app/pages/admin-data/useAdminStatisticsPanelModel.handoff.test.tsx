import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAdminStatisticsPanelModel } from './useAdminStatisticsPanelModel'

const calls = vi.hoisted(() => ({ demand: vi.fn() }))
const ready = (data: unknown) => ({ data, currentData: data, isSuccess: true, refetch: vi.fn() })
vi.mock('@/api/dashboardApi', () => ({ useGetOperationalKpisQuery: () => ready({}) }))
vi.mock('@/features/reports/reportsApi', () => ({
  useGetIngredientDemandAggregatePageQuery: (args: unknown) => {
    calls.demand(args)
    return ready({ items: [], totalCount: 42, shortageCount: 0, remainingToIssueCount: 17 })
  },
  useGetPriceVariancePageQuery: () => ready({ items: [], totalCount: 0 }),
  useGetPurchasePlanPageQuery: () => ready({ totalShortageQty: 5 }),
}))

it('counts whole-day issue backlog separately from purchase plan quantities and historical shortage', () => {
  const { result } = renderHook(() => useAdminStatisticsPanelModel('statistics', '2026-08-15'))
  expect(result.current.shortageCount).toBe(17)
  expect(result.current.totalPurchaseQty).toBe(5)
  expect(calls.demand).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: '2026-08-15', dateTo: '2026-08-15', pageSize: 8 }))
})
