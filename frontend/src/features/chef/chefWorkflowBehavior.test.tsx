import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KitchenIssueRow } from '@/features/workflow'
import type { ProductionPlan } from '@/lib/types'
import type { ChefMaterial } from './chefDashboardTypes'
import type { ChefShiftScope } from './production/useChefProductionPlan'

const mocks = vi.hoisted(() => ({
  confirmReceipt: vi.fn(),
  createReturn: vi.fn(),
  createSupplemental: vi.fn(),
  getCatalog: vi.fn(),
  getDailyPlan: vi.fn(),
  getKitchenIssues: vi.fn(),
  sendDailyPlan: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({
    coordination: { orders: [], menuPrice: 35000, lossRate: 0 },
  }),
}))

vi.mock('@/features/projects/dishCatalogApi', () => ({
  useGetDishesCatalogQuery: mocks.getCatalog,
}))

vi.mock('@/features/workflow', () => ({
  useConfirmInventoryIssueReceiptMutation: () => [mocks.confirmReceipt, { isLoading: false }],
  useCreateInventoryReturnMutation: () => [mocks.createReturn, { isLoading: false }],
  useCreateSupplementalMaterialRequestMutation: () => [mocks.createSupplemental, { isLoading: false }],
  useGetDailyProductionPlanQuery: mocks.getDailyPlan,
  useGetKitchenIssuesQuery: mocks.getKitchenIssues,
  useSendDailyProductionPlanToKitchenMutation: () => [mocks.sendDailyPlan, { isLoading: false }],
}))

import { useChefExceptions } from './exceptions/useChefExceptions'
import { useChefProductionPlan } from './production/useChefProductionPlan'
import { useKitchenReceipts } from './receipts/useKitchenReceipts'

const scope: ChefShiftScope = {
  activeDay: 't2',
  activeShift: 'Ca Sáng',
  serviceDate: '2026-07-20',
  apiShiftName: 'MORNING',
  isLocked: true,
}

const issue = (overrides: Partial<KitchenIssueRow> = {}): KitchenIssueRow => ({
  id: 'issue-1-line-1',
  issueId: 'issue-1',
  issueCode: 'PX-001',
  issueDate: '2026-07-20',
  shiftName: 'MORNING',
  warehouseId: 'warehouse-1',
  warehouse: 'Kho chính',
  ingredientId: 'ingredient-1',
  ingredient: 'Gạo',
  unitId: 'unit-1',
  unit: 'kg',
  requestedQty: 10,
  issuedQty: 9,
  isReceivedByKitchen: true,
  receiptStatus: 'RECEIVED',
  ...overrides,
})

describe('chef workflow service-date behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCatalog.mockReturnValue({ data: [], isLoading: false, isError: false })
    mocks.getDailyPlan.mockReturnValue({ data: undefined, isLoading: false, isError: false })
    mocks.getKitchenIssues.mockReturnValue({ data: [], isLoading: false, isError: false })
  })

  it('queries receipts by service date and shift and cannot confirm a non-matching issue', async () => {
    const unrelatedIssue = issue({ issueDate: '2026-07-19', shiftName: 'AFTERNOON' })
    mocks.getKitchenIssues.mockReturnValue({ data: [unrelatedIssue], isLoading: false, isError: false })
    const { result } = renderHook(() => useKitchenReceipts(scope, vi.fn()))

    expect(mocks.getKitchenIssues).toHaveBeenCalledWith({
      dateFrom: '2026-07-20',
      dateTo: '2026-07-20',
      shiftName: 'MORNING',
      limit: 100,
    })
    expect(result.current.rows).toEqual([])

    await act(() => result.current.signOff({
      id: unrelatedIssue.id,
      name: unrelatedIssue.ingredient,
      unit: unrelatedIssue.unit,
      quantity: unrelatedIssue.issuedQty,
      status: 'Đã nhận',
      signed: false,
      issueId: unrelatedIssue.issueId,
    }, true))
    expect(mocks.confirmReceipt).not.toHaveBeenCalled()
  })

  it('does not expose supplemental or return mutations when the selected scope has no issue', async () => {
    const emptyPlan: ProductionPlan = {
      date: scope.serviceDate,
      shift: scope.activeShift,
      kitchenAssignment: { kitchenName: 'Bếp', kitchenCode: 'B01', responsibleChefs: [] },
      totalMeals: 0,
      activeDishes: [],
      receivedMaterials: [],
    }
    const { result } = renderHook(() => useChefExceptions(scope, emptyPlan, [], vi.fn()))
    let supplementalResult = true

    await act(async () => {
      supplementalResult = await result.current.requestSupplemental({
        ingredientId: 'unrelated-line',
        ingredientName: 'Gạo',
        unit: 'kg',
        requestedQty: 1,
      })
      await result.current.recordReturn({
        ingredientId: 'unrelated-line',
        ingredientName: 'Gạo',
        unit: 'kg',
        returnedQty: 1,
      })
    })

    expect(supplementalResult).toBe(false)
    expect(mocks.createSupplemental).not.toHaveBeenCalled()
    expect(mocks.createReturn).not.toHaveBeenCalled()
  })

  it('uses the selected service date for daily-plan reads and sends', async () => {
    mocks.sendDailyPlan.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ sentPlans: 1, totalPlans: 1 }),
    })
    const { result, rerender } = renderHook(
      ({ currentScope }) => useChefProductionPlan(currentScope, [], {}, vi.fn()),
      { initialProps: { currentScope: scope } },
    )

    expect(mocks.getDailyPlan).toHaveBeenCalledWith({ serviceDate: '2026-07-20', shiftName: 'MORNING' })
    rerender({ currentScope: { ...scope, activeDay: 't6', serviceDate: '2026-07-24' } })
    expect(mocks.getDailyPlan).toHaveBeenLastCalledWith({ serviceDate: '2026-07-24', shiftName: 'MORNING' })
    await act(() => result.current.receiveDailyPlan())
    expect(mocks.sendDailyPlan).toHaveBeenCalledWith(expect.objectContaining({
      serviceDate: '2026-07-24',
      shiftName: 'MORNING',
    }))
  })

  it('uses the selected service date when creating an inventory return', async () => {
    mocks.createReturn.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ data: { returnCode: 'PT-001' } }),
    })
    const issueRow = issue()
    const productionPlan: ProductionPlan = {
      date: scope.serviceDate,
      shift: scope.activeShift,
      kitchenAssignment: { kitchenName: 'Bếp', kitchenCode: 'B01', responsibleChefs: [] },
      totalMeals: 1,
      activeDishes: [],
      receivedMaterials: [{
        id: issueRow.id,
        name: issueRow.ingredient,
        unit: issueRow.unit,
        quantity: issueRow.issuedQty,
        status: 'Đã nhận',
        signed: true,
        issueId: issueRow.issueId,
        issueCode: issueRow.issueCode,
        warehouseId: issueRow.warehouseId,
        ingredientId: issueRow.ingredientId,
        unitId: issueRow.unitId,
        isReceivedByKitchen: true,
      } as ChefMaterial],
    }
    const { result } = renderHook(() => useChefExceptions(scope, productionPlan, [issueRow], vi.fn()))

    await act(() => result.current.recordReturn({
      ingredientId: issueRow.id,
      ingredientName: issueRow.ingredient,
      unit: issueRow.unit,
      returnedQty: 1,
      returnedAt: '2026-07-19T23:30:00.000Z',
    }))
    expect(mocks.createReturn).toHaveBeenCalledWith(expect.objectContaining({
      returnDate: '2026-07-20',
      shiftName: 'MORNING',
      issueId: issueRow.issueId,
    }))
  })
})
