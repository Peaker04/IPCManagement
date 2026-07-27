import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApi'

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

vi.mock('@/api/dishCatalogApi', () => ({
  useGetIngredientsQuery: mocks.getIngredients,
}))

vi.mock('@/api/workflowApi', () => ({
  useCancelPurchaseOrderMutation: () => [vi.fn(), { isLoading: false }],
  useCreatePurchaseOrdersFromRequestMutation: () => [mocks.createOrders, { isLoading: false }],
  useCreatePurchaseRequestFromDemandMutation: () => [mocks.createFromDemand, { isLoading: false }],
  useCreateSupplierQuotationMutation: () => [vi.fn(), { isLoading: false }],
  useDeactivateSupplierQuotationMutation: () => [vi.fn(), { isLoading: false }],
  useGetMaterialRequestCandidatePageQuery: mocks.getCandidates,
  useGetPurchaseOrdersPageQuery: mocks.getOrders,
  useGetPurchasePlanPageQuery: mocks.getPlan,
  useGetPurchaseRequestsPageQuery: mocks.getRequests,
  useGetStockMovementPageQuery: mocks.getStockMovements,
  useGetSupplierQuotationsByIngredientPageQuery: mocks.getQuotations,
  useGetSuppliersQuery: mocks.getSuppliers,
  useGetWarehouseSelectorQuery: mocks.getWarehouses,
  useGetSupplierEvidenceQuery: mocks.getSupplierEvidence,
  useConfirmLineSupplierMutation: () => [mocks.confirmLineSupplier, { isLoading: false }],
  useRecordWarehousePurchaseReceiptMutation: () => [mocks.recordWarehouseReceipt, { isLoading: false }],
  useRecordPurchaseOrderReceiptMutation: () => [vi.fn(), { isLoading: false }],
  useSubmitPurchaseRequestMutation: () => [mocks.submitRequest, { isLoading: false }],
  useUpdatePurchaseRequestLineSupplierMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateSupplierQuotationMutation: () => [vi.fn(), { isLoading: false }],
}))

import { useSupplierQuotations } from '@/features/purchasing/quotation/useSupplierQuotations'
import { PurchaseDecisionPanel } from '@/features/purchasing/PurchaseDecisionPanel'
import { WarehousePurchaseReceiptDialog } from '@/features/workflow/warehouse/WarehousePurchaseReceiptDialog'

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

  // Trước 27/07 khối này còn kiểm cả usePurchaseSupplier/usePurchaseOrders/usePurchaseHandoff.
  // Ba hook đó đã bị xoá cùng 4 sub-module chết (không page nào import), nên phần còn lại chỉ
  // kiểm hook đang sống. Query gating vẫn là hạng mục GIỮ NGUYÊN — xem CONTRIBUTING.md.
  it('skips every inactive purchasing-tab query', () => {
    renderHook(() => useSupplierQuotations(false))
    expect(mocks.getIngredients).toHaveBeenCalledWith(undefined, { skip: true })
    expect(mocks.getQuotations).toHaveBeenCalledWith(
      { ingredientId: '', pageNumber: 1, pageSize: 8 },
      { skip: true },
    )
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

  it('exposes purchase request submission when every supplier decision is ready', async () => {
    const unwrap = vi.fn().mockResolvedValue({})
    mocks.submitRequest.mockReturnValue({ unwrap })
    const serviceDate: PurchaseWorkbenchServiceDate = {
      serviceDate: '2026-07-20',
      scope: 'FULLDAY',
      currentStage: 'supplier-price',
      approvedDemandCount: 1,
      shortageLineCount: 1,
      supplierReadyLineCount: 1,
      blockingExceptionCount: 0,
      purchaseRequestId: 'request-ready',
      purchaseRequestCode: 'PR-READY',
      purchaseRequestStatus: 'DRAFT',
      orderCount: 0,
      receivingLineCount: 0,
      fullyReceivedLineCount: 0,
      approvedDemands: [],
      purchaseLines: [],
    }

    render(
      <PurchaseDecisionPanel
        week="2026-07-20"
        selectedStage="supplier-price"
        serviceDate={serviceDate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất mua' }))
    const dialog = screen.getByRole('dialog', { name: 'Gửi đề xuất mua' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi đề xuất mua' }))

    await waitFor(() => expect(mocks.submitRequest).toHaveBeenCalledWith('request-ready'))
    expect(unwrap).toHaveBeenCalled()
  })

  it('replaces order creation with warehouse tracking after an order exists', () => {
    const serviceDate: PurchaseWorkbenchServiceDate = {
      serviceDate: '2026-07-20',
      scope: 'FULLDAY',
      currentStage: 'receiving',
      approvedDemandCount: 1,
      shortageLineCount: 1,
      supplierReadyLineCount: 1,
      blockingExceptionCount: 0,
      purchaseRequestId: 'request-approved',
      purchaseRequestCode: 'PR-APPROVED',
      purchaseRequestStatus: 'APPROVED',
      orderCount: 1,
      receivingLineCount: 1,
      fullyReceivedLineCount: 0,
      approvedDemands: [],
      purchaseLines: [],
    }

    render(
      <MemoryRouter>
        <PurchaseDecisionPanel
          week="2026-07-20"
          selectedStage="approved-order"
          serviceDate={serviceDate}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: 'Tạo đơn đặt hàng' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở màn hình nhập kho' })).toHaveAttribute(
      'href',
      '/warehouse?week=2026-07-20&purchaseRequestId=request-approved',
    )
    expect(screen.getByText('0/1 dòng đã nhận đủ trên 1 đơn đặt hàng.')).toBeInTheDocument()
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

  it('preselects and locks the warehouse linked to a supplemental request', () => {
    render(
      <WarehousePurchaseReceiptDialog
        open
        preferredWarehouseId="warehouse-supplemental"
        warehouses={[
          { warehouseId: 'warehouse-default', warehouseCode: 'KHO-01', warehouseName: 'Kho trung tâm' },
          { warehouseId: 'warehouse-supplemental', warehouseCode: 'KHO-02', warehouseName: 'Kho xử lý yêu cầu bổ sung' },
        ]}
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
          receivedQty: 0,
          unitPrice: 80_000,
          lotNumberRequired: false,
          manufactureDateRequired: false,
          expiryDateRequired: false,
        }}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Kho nhận *')).toHaveValue('warehouse-supplemental')
    expect(screen.getByLabelText('Kho nhận *')).toBeDisabled()
    expect(screen.getByText('Kho đích được khóa theo yêu cầu cấp bổ sung liên kết.')).toBeInTheDocument()
  })
})
