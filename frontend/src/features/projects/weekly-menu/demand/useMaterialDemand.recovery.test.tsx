import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const snapshots = vi.hoisted(() => ({ demand: {} as Record<string, unknown>, documents: {} as Record<string, unknown>, aggregate: {} as Record<string, unknown> }))
vi.mock('@/lib/reduxHooks', () => ({ useAppDispatch: () => vi.fn() }))
vi.mock('@/api/reportsApi', () => ({
  useGetIngredientDemandQuery: () => snapshots.demand,
  useGetIngredientDemandAggregatePageQuery: () => snapshots.aggregate,
}))
vi.mock('@/api/workflowDocumentsApi', () => ({ useGetWorkflowDocumentsQuery: () => snapshots.documents }))
vi.mock('@/api/approvalsApi', () => ({ useGetApprovalHistoryQuery: () => ({}) }))
vi.mock('@/api/coordinationApi', () => ({ useUpsertQuickServingsMutation: () => [vi.fn(), {}] }))
vi.mock('@/api/purchasingApi', () => ({
  useGenerateMaterialDemandMutation: () => [vi.fn(), {}],
  useGetMaterialDemandStalenessQuery: () => ({}),
}))
import { useMaterialDemand } from './useMaterialDemand'

const options = {
  scope: { customerId: 'customer', weekStartDate: '2026-09-21', displayDays: [], menuPrice: 30000 },
  sourceMenuValue: 'KH', customerCode: 'KH', customerLabel: 'Khách hàng', materialSummaryCount: 0,
  weeklyPlanRows: [], invalidScheduleMenuPrices: [], quickServingRows: [],
} as unknown as Parameters<typeof useMaterialDemand>[0]

beforeEach(() => {
  snapshots.demand = { currentData: [], isSuccess: true }
  snapshots.documents = { currentData: [], isSuccess: true }
  snapshots.aggregate = { currentData: { items: [], totalCount: 0 }, isError: true, error: { status: 'FETCH_ERROR' } }
})

it('retains active-key recoverable read data only in the opted-in preview while keeping error state', () => {
  const { result, rerender } = renderHook(({ enabled }) => useMaterialDemand({ ...options, retainRecoverableData: enabled }), { initialProps: { enabled: true } })
  expect(result.current.dataState.phase).toBe('error')
  expect(result.current.status.hasRetainedDemand).toBe(true)
  expect(result.current.presentation.aggregatePage).toEqual({ items: [], totalCount: 0 })
  rerender({ enabled: false })
  expect(result.current.presentation.aggregatePage).toBeUndefined()
})

it.each([401, 403])('does not retain data when a sibling source denies access (%s)', status => {
  snapshots.documents = { currentData: [], isError: true, error: { status } }
  const { result } = renderHook(() => useMaterialDemand({ ...options, retainRecoverableData: true }))
  expect(result.current.status.hasRetainedDemand).toBe(false)
  expect(result.current.presentation.aggregatePage).toBeUndefined()
})

it('does not use previous-key data when active-key currentData is missing', () => {
  snapshots.aggregate = { data: { items: [], totalCount: 99 }, isError: true, error: { status: 'FETCH_ERROR' } }
  const { result } = renderHook(() => useMaterialDemand({ ...options, retainRecoverableData: true }))
  expect(result.current.status.hasRetainedDemand).toBe(false)
  expect(result.current.presentation.aggregatePage).toBeUndefined()
})
