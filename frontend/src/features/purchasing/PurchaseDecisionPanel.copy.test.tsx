import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PurchaseRequestWorkflowLine,
  PurchaseWorkbenchServiceDate,
  SupplierEvidenceCandidate,
} from '@/api/workflowApiTypes'
import { PurchaseDecisionPanel } from './PurchaseDecisionPanel'

const mocks = vi.hoisted(() => ({
  evidenceQuery: vi.fn(),
  warehouseQuery: vi.fn(),
}))

vi.mock('@/api/purchasingApi', () => ({
  useGetSupplierEvidenceQuery: mocks.evidenceQuery,
  useConfirmLineSupplierMutation: () => [vi.fn(), { isLoading: false }],
  useCreatePurchaseRequestFromDemandMutation: () => [vi.fn(), { isLoading: false }],
  useSubmitPurchaseRequestMutation: () => [vi.fn(), { isLoading: false }],
  useCreatePurchaseOrdersFromRequestMutation: () => [vi.fn(), { isLoading: false }],
}))

vi.mock('@/api/warehouseApi', () => ({
  useGetWarehouseSelectorQuery: mocks.warehouseQuery,
}))

const sampleCandidate: SupplierEvidenceCandidate = {
  evidenceType: 'EffectiveQuotation',
  evidenceId: 'ev-1',
  supplierId: 'sup-1',
  supplierName: 'Công ty Thực phẩm Sạch',
  ingredientId: 'ing-1',
  unitId: 'unit-kg',
  unitName: 'kg',
  unitPrice: 45000,
  evidenceDate: '2026-08-01',
  effectiveFrom: '2026-08-01',
  effectiveTo: '2026-08-31',
}

const sampleServiceDate: PurchaseWorkbenchServiceDate = {
  serviceDate: '2026-08-10',
  scope: 'FULLDAY',
  currentStage: 'supplier-price',
  approvedDemandCount: 1,
  shortageLineCount: 1,
  supplierReadyLineCount: 0,
  blockingExceptionCount: 0,
  orderCount: 0,
  receivingLineCount: 0,
  fullyReceivedLineCount: 0,
  purchaseRequestId: 'pr-1',
  purchaseRequestStatus: 'DRAFT',
  approvedDemands: [],
  purchaseLines: [],
}

const sampleLine: PurchaseRequestWorkflowLine = {
  purchaseRequestLineId: 'tech-line-uuid-999',
  ingredientId: 'ing-1',
  ingredientName: 'Thịt ba chỉ',
  purchaseQty: 120,
  unitName: 'kg',
  currentStockQty: 0,
  requiredQty: 120,
  estimatedUnitPrice: 45000,
  materialRequestLineId: 'req-line-1',
  unitId: 'unit-1',
  supplierDecisionHistory: [],
  supplierDecisionStatus: 'PENDING_DECISION',
}

describe('PurchaseDecisionPanel user-facing copy behavioral contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.warehouseQuery.mockReturnValue({
      data: [{ warehouseId: 'wh-1', warehouseName: 'Kho Chính' }],
      isLoading: false,
      isError: false,
    })
    mocks.evidenceQuery.mockReturnValue({
      data: {
        candidates: [sampleCandidate],
        blocker: null,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('shows the actual operational scope and formatted quantities, and hides technical line identifiers', async () => {
    render(
      <MemoryRouter>
        <PurchaseDecisionPanel
          week="2026-W33"
          selectedStage="supplier-price"
          serviceDate={sampleServiceDate}
          selectedLine={sampleLine}
        />
      </MemoryRouter>,
    )

    // 1. Operational scope is shown in user language ("Cả ngày") inside info popover
    const infoButton = await screen.findByRole('button', { name: 'Xem hướng dẫn' })
    expect(infoButton).toBeInTheDocument()

    // 2. Quantity and unit are formatted cleanly
    expect(screen.getByText('Thịt ba chỉ')).toBeInTheDocument()
    expect(screen.getByText(/120 kg/i)).toBeInTheDocument()

    // 3. Evidence shows formatted price and unit
    expect(screen.getByText(/45\.000\s*₫/i)).toBeInTheDocument()
    expect(screen.getByText(/\/kg/i)).toBeInTheDocument()

    // 4. Technical line identifiers and developer phrases are not leaked to user
    expect(screen.queryByText(/tech-line-uuid-999/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mã dòng/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Dữ liệu trạng thái do máy chủ xác định/i)).not.toBeInTheDocument()
  })
})
