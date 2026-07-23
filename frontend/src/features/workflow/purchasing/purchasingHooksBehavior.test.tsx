import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PurchaseRequestResult, PurchaseWorkbenchServiceDate } from '../workflowApi'

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
  getSupplierEvidence: vi.fn(),
  confirmLineSupplier: vi.fn(),
  recordWarehouseReceipt: vi.fn(),
  createFromDemand: vi.fn(),
  createOrders: vi.fn(),
}))

vi.mock('@/components/common', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/common')>(),
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
  useGetSupplierEvidenceQuery: mocks.getSupplierEvidence,
  useConfirmLineSupplierMutation: () => [mocks.confirmLineSupplier, { isLoading: false }],
  useRecordWarehousePurchaseReceiptMutation: () => [mocks.recordWarehouseReceipt, { isLoading: false }],
  useCreatePurchaseRequestFromDemandMutation: () => [mocks.createFromDemand, { isLoading: false }],
  useSubmitPurchaseRequestMutation: () => [mocks.submitRequest, { isLoading: false }],
  useCreatePurchaseOrdersFromRequestMutation: () => [mocks.createOrders, { isLoading: false }],
}))

import { usePurchaseDemand } from './demand/usePurchaseDemand'
import { usePurchaseHandoff } from './handoff/usePurchaseHandoff'
import { usePurchaseOrders } from './orders/usePurchaseOrders'
import { useSupplierQuotations } from './quotation/useSupplierQuotations'
import { usePurchaseSupplier } from './supplier/usePurchaseSupplier'
import { PurchaseDecisionPanel } from './PurchaseDecisionPanel'
import { WarehousePurchaseReceiptDialog } from '../warehouse/WarehousePurchaseReceiptDialog'

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
    mocks.getSupplierEvidence.mockReturnValue({ data: { candidates: [], diagnostics: [] }, isFetching: false })
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

  it('keeps supplier evidence visible and requires an explicit confirmation', async () => {
    const serviceDate: PurchaseWorkbenchServiceDate = {
      serviceDate: '2026-07-20',
      scope: 'FULLDAY',
      currentStage: 'supplier-price',
      approvedDemandCount: 1,
      shortageLineCount: 1,
      supplierReadyLineCount: 0,
      blockingExceptionCount: 0,
      purchaseRequestId: 'request-1',
      purchaseRequestCode: 'PR-001',
      purchaseRequestStatus: 'DRAFT',
      orderCount: 0,
      receivingLineCount: 0,
      fullyReceivedLineCount: 0,
      approvedDemands: [],
      purchaseLines: [{
        purchaseRequestLineId: 'line-1',
        materialRequestLineId: 'material-line-1',
        ingredientId: 'ingredient-1',
        ingredientName: 'Gạo',
        unitId: 'unit-1',
        unitName: 'kg',
        requiredQty: 10,
        currentStockQty: 2,
        purchaseQty: 8,
        estimatedUnitPrice: 20_000,
        supplierDecisionStatus: 'UNCONFIRMED',
        supplierDecisionHistory: [],
      }],
    }
    mocks.getSupplierEvidence.mockReturnValue({
      data: {
        candidates: [{
          evidenceType: 'EffectiveQuotation',
          evidenceId: 'quote-1',
          evidenceDate: '2026-07-18',
          supplierId: 'supplier-1',
          supplierName: 'Nhà cung cấp Minh An',
          ingredientId: 'ingredient-1',
          unitId: 'unit-1',
          unitName: 'kg',
          unitPrice: 20_000,
          effectiveFrom: '2026-07-18',
          effectiveTo: '2026-07-30',
        }],
        diagnostics: [],
      },
      isFetching: false,
    })

    render(
      <PurchaseDecisionPanel
        week="2026-07-20"
        selectedStage="supplier-price"
        serviceDate={serviceDate}
        selectedLine={serviceDate.purchaseLines[0]}
      />,
    )

    expect(screen.getByText('Nhà cung cấp Minh An')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận nhà cung cấp' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Chọn Nhà cung cấp Minh An/i }))
    fireEvent.change(screen.getByLabelText('Ngày giao'), { target: { value: '2026-07-21' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhà cung cấp' }))

    expect(screen.getByRole('dialog', { name: 'Xác nhận nhà cung cấp' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quay lại chọn nhà cung cấp' })).toHaveFocus())
    expect(mocks.confirmLineSupplier).not.toHaveBeenCalled()
  })

  it('keeps receipt evidence and idempotency key stable after a conflict', async () => {
    mocks.recordWarehouseReceipt.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue({ data: { message: 'Phiếu nhập đã được xử lý với dữ liệu khác.' } }),
    })

    render(
      <WarehousePurchaseReceiptDialog
        open
        week="2026-07-20"
        warehouses={[{
          warehouseId: 'warehouse-1',
          warehouseCode: 'KHO-01',
          warehouseName: 'Kho trung tâm',
        }]}
        order={{
          purchaseOrderId: 'order-1',
          purchaseOrderCode: 'PO-001',
          purchaseRequestId: 'request-1',
          purchaseRequestCode: 'PR-001',
          supplierId: 'supplier-1',
          supplierName: 'Nhà cung cấp Minh An',
          orderDate: '2026-07-20',
          status: 'ORDERED',
          lines: [],
        }}
        line={{
          purchaseOrderLineId: 'order-line-1',
          purchaseRequestLineId: 'request-line-1',
          ingredientId: 'ingredient-1',
          ingredientName: 'Thịt heo',
          unitId: 'unit-1',
          unitName: 'kg',
          orderedQty: 10,
          receivedQty: 2,
          unitPrice: 80_000,
          lotNumberRequired: true,
          manufactureDateRequired: true,
          expiryDateRequired: true,
        }}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Kho nhận *'), { target: { value: 'warehouse-1' } })
    fireEvent.change(screen.getByLabelText('Ngày nhận *'), { target: { value: '2026-07-22' } })
    fireEvent.change(screen.getByLabelText('Số lượng thực nhận *'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Số lô *'), { target: { value: 'LOT-2207' } })
    fireEvent.change(screen.getByLabelText('Ngày sản xuất *'), { target: { value: '2026-07-21' } })
    fireEvent.change(screen.getByLabelText('Hạn sử dụng *'), { target: { value: '2026-07-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xác nhận' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Quay lại chỉnh sửa' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhập kho' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Phiếu nhập đã được xử lý với dữ liệu khác.'))

    const firstRequest = mocks.recordWarehouseReceipt.mock.calls[0][0]
    expect(firstRequest.data.lines[0]).toMatchObject({
      purchaseOrderLineId: 'order-line-1',
      actualQuantity: 3,
      actualUnitId: 'unit-1',
      lotNumber: 'LOT-2207',
      manufactureDate: '2026-07-21',
      expiryDate: '2026-07-25',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhập kho' }))
    await waitFor(() => expect(mocks.recordWarehouseReceipt).toHaveBeenCalledTimes(2))
    expect(mocks.recordWarehouseReceipt.mock.calls[1][0].data.idempotencyKey).toBe(firstRequest.data.idempotencyKey)

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại chỉnh sửa' }))
    expect(screen.getByLabelText('Số lượng thực nhận *')).toHaveValue(3)
    expect(screen.getByLabelText('Số lô *')).toHaveValue('LOT-2207')
  })
})
