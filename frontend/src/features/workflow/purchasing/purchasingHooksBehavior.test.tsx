import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PurchaseRequestResult } from '../workflowApi'

const mocks = vi.hoisted(() => ({
  getIngredients: vi.fn(),
  getOrders: vi.fn(),
  getCandidates: vi.fn(),
  getPlan: vi.fn(),
  getRequests: vi.fn(),
  getStockMovements: vi.fn(),
  getQuotations: vi.fn(),
  getSuppliers: vi.fn(),
  getWarehouses: vi.fn(),
  submitRequest: vi.fn(),
}))

vi.mock('@/components/common', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/features/projects/dishCatalogApi', () => ({
  useGetIngredientsQuery: mocks.getIngredients,
}))

vi.mock('@/features/workflow', () => ({
  useCancelPurchaseOrderMutation: () => [vi.fn(), { isLoading: false }],
  useCreatePurchaseOrdersFromRequestMutation: () => [vi.fn(), { isLoading: false }],
  useCreatePurchaseRequestFromDemandMutation: () => [vi.fn(), { isLoading: false }],
  useCreateSupplierQuotationMutation: () => [vi.fn(), { isLoading: false }],
  useDeactivateSupplierQuotationMutation: () => [vi.fn(), { isLoading: false }],
  useGetMaterialRequestCandidatePageQuery: mocks.getCandidates,
  useGetPurchaseOrdersPageQuery: mocks.getOrders,
  useGetPurchasePlanPageQuery: mocks.getPlan,
  useGetPurchaseRequestsPageQuery: mocks.getRequests,
  useGetStockMovementPageQuery: mocks.getStockMovements,
  useGetSupplierQuotationsByIngredientPageQuery: mocks.getQuotations,
  useGetSuppliersQuery: mocks.getSuppliers,
  useRecordPurchaseOrderReceiptMutation: () => [vi.fn(), { isLoading: false }],
  useSubmitPurchaseRequestMutation: () => [mocks.submitRequest, { isLoading: false }],
  useUpdatePurchaseRequestLineSupplierMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateSupplierQuotationMutation: () => [vi.fn(), { isLoading: false }],
}))

vi.mock('../workflowApi', () => ({
  useGetWarehouseSelectorQuery: mocks.getWarehouses,
}))

import { usePurchaseDemand } from './demand/usePurchaseDemand'
import { usePurchaseHandoff } from './handoff/usePurchaseHandoff'
import { usePurchaseOrders } from './orders/usePurchaseOrders'
import { useSupplierQuotations } from './quotation/useSupplierQuotations'
import { usePurchaseSupplier } from './supplier/usePurchaseSupplier'

const makeRequest = (status: string, id: string): PurchaseRequestResult => ({
  purchaseRequestId: id,
  purchaseRequestCode: `PR-${id}`,
  materialRequestId: `MR-${id}`,
  purchaseForDate: '2026-07-20',
  status,
  lines: [{
    purchaseRequestLineId: `line-${id}`,
    materialRequestLineId: `material-line-${id}`,
    ingredientId: 'ingredient-1',
    ingredientName: 'Gạo',
    supplierId: '',
    supplierName: '',
    unitId: 'unit-1',
    unitName: 'kg',
    requiredQty: 10,
    currentStockQty: 2,
    purchaseQty: 8,
    estimatedUnitPrice: 20_000,
  }],
})

describe('purchasing hook behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getIngredients.mockReturnValue({ data: [] })
    mocks.getOrders.mockReturnValue({ data: undefined })
    mocks.getCandidates.mockReturnValue({ data: undefined, isFetching: false })
    mocks.getPlan.mockReturnValue({ data: undefined })
    mocks.getRequests.mockReturnValue({ data: undefined })
    mocks.getStockMovements.mockReturnValue({ data: undefined })
    mocks.getQuotations.mockReturnValue({ data: undefined, isFetching: false })
    mocks.getSuppliers.mockReturnValue({ data: [] })
    mocks.getWarehouses.mockReturnValue({ data: undefined })
  })

  it('skips every inactive purchasing-tab query', () => {
    renderHook(() => usePurchaseSupplier(false))
    expect(mocks.getRequests).toHaveBeenCalledWith(
      { status: 'DRAFT', pageNumber: 1, pageSize: 8 },
      { skip: true },
    )
    expect(mocks.getSuppliers).toHaveBeenCalledWith(undefined, { skip: true })

    renderHook(() => useSupplierQuotations(false))
    expect(mocks.getIngredients).toHaveBeenCalledWith(undefined, { skip: true })
    expect(mocks.getQuotations).toHaveBeenCalledWith(
      { ingredientId: '', pageNumber: 1, pageSize: 8 },
      { skip: true },
    )

    renderHook(() => usePurchaseOrders(false))
    expect(mocks.getOrders).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: 6 },
      { skip: true },
    )
    expect(mocks.getWarehouses).toHaveBeenCalledWith(
      undefined,
      { skip: true },
    )

    renderHook(() => usePurchaseHandoff(false))
    expect(mocks.getStockMovements).toHaveBeenCalledWith(
      {
        movementType: 'receipt',
        cursorDate: undefined,
        cursorId: undefined,
        limit: 8,
        sortDirection: 'desc',
      },
      { skip: true },
    )
  })

  it('requires explicit selection and submits the selected request when two drafts exist', async () => {
    mocks.getRequests.mockReturnValue({
      data: { items: [makeRequest('DRAFT', 'draft-a'), makeRequest('DRAFT', 'draft-b')] },
    })
    mocks.submitRequest.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) })

    const { result } = renderHook(() => usePurchaseDemand(vi.fn()))

    expect(mocks.getRequests).toHaveBeenCalledWith({ status: 'DRAFT', pageNumber: 1, pageSize: 8 })
    expect(result.current.command.submitTargetId).toBeUndefined()

    act(() => result.current.command.setSelectedPurchaseRequestId('draft-b'))
    expect(result.current.command.submitTargetId).toBe('draft-b')
    await act(() => result.current.command.submitPurchaseRequest())
    expect(mocks.submitRequest).toHaveBeenLastCalledWith('draft-b')

    act(() => result.current.command.setSelectedPurchaseRequestId('draft-a'))
    await act(() => result.current.command.submitPurchaseRequest())
    expect(mocks.submitRequest).toHaveBeenLastCalledWith('draft-a')
  })
})
