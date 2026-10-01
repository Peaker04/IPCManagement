import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ generate: vi.fn(), dispatch: vi.fn() }))
vi.mock('@/lib/reduxHooks', () => ({ useAppDispatch: () => api.dispatch }))
vi.mock('@/api/reportsApi', () => ({
  useGetIngredientDemandQuery: () => ({ currentData: [], isSuccess: true }),
  useGetIngredientDemandAggregatePageQuery: () => ({ currentData: { items: [], totalCount: 0, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 }, isSuccess: true }),
}))
vi.mock('@/api/workflowDocumentsApi', () => ({ useGetWorkflowDocumentsQuery: () => ({ currentData: [], isSuccess: true }) }))
vi.mock('@/api/approvalsApi', () => ({ useGetApprovalHistoryQuery: () => ({}) }))
vi.mock('@/api/coordinationApi', () => ({ useUpsertQuickServingsMutation: () => [vi.fn(), { isLoading: false }] }))
vi.mock('@/api/purchasingApi', () => ({
  useGenerateMaterialDemandMutation: () => [api.generate, { isLoading: false }],
  useGetMaterialDemandStalenessQuery: ({ serviceDate }: { serviceDate: string }) => ({ data: { data: { hasExistingPlan: true, canRegenerate: serviceDate !== '2026-09-23', regenerationBlockReason: serviceDate === '2026-09-23' ? 'Đã phát sinh đơn mua' : undefined } } }),
}))
import { useMaterialDemand } from './useMaterialDemand'

it.each([true, false])('reports per-date lineage without whole-week success when dates are locked (failed request=%s)', async (failSecondDate) => {
  api.generate.mockClear()
  api.generate.mockImplementation(({ serviceDate }) => ({ unwrap: () => failSecondDate && serviceDate === '2026-09-22'
    ? Promise.reject(new Error('Conflict'))
    : Promise.resolve({ success: true, data: { lines: [], missingBomDishes: [], productionPlanLineCount: 1 } }) }))
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23']
  const { result } = renderHook(() => useMaterialDemand({
    scope: { customerId: 'customer', customerLabel: 'Khách hàng', weekStartDate: dates[0], weekLabel: 'Tuần đã chọn', fixedBomRatePercent: 100, activeServiceLabel: 'Tuần', displayDays: [], menuPrice: 30000 },
    sourceMenuValue: 'KH', customerCode: 'KH', customerLabel: 'Khách hàng', materialSummaryCount: 0,
    weeklyPlanRows: dates.map(serviceDate => ({ serviceDate, portions: 100, hasCatalogBom: true })) as Parameters<typeof useMaterialDemand>[0]['weeklyPlanRows'],
    invalidScheduleMenuPrices: [], quickServingRows: [],
  }))
  await act(async () => { await result.current.actions.generate() })
  expect(api.generate.mock.calls.map(([request]) => request.serviceDate)).toEqual(dates.slice(0, 2))
  expect(result.current.state.generationResults).toMatchObject([
    { serviceDate: dates[0], status: 'success' },
    { serviceDate: dates[1], status: failSecondDate ? 'failed' : 'success' },
    { serviceDate: dates[2], status: 'unchanged', reason: 'Đã phát sinh đơn mua' },
  ])
  expect(result.current.state.feedback?.variant).toBe('warning')
  expect(result.current.state.feedback?.title).not.toBe('Đã tạo nhu cầu cho tuần')
  expect(result.current.state.feedback?.message).toContain(`${failSecondDate ? 1 : 2}/3 ngày`)
})
