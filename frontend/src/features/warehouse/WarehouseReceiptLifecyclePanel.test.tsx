import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WarehouseReceiptLifecyclePanel } from './WarehouseReceiptLifecyclePanel'

const lifecycleMocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  userRole: 'thukho',
}))

vi.mock('@/lib/useHasRole', () => ({
  useHasRole: (allowedRoles: string[]) => allowedRoles.includes(lifecycleMocks.userRole),
}))

vi.mock('@/api/warehouseApi', () => ({
  useGetInventoryReceiptsQuery: lifecycleMocks.list,
  useGetInventoryReceiptByIdQuery: lifecycleMocks.detail,
  useAcceptReceiptQualityMutation: () => [vi.fn(), { isLoading: false }],
  usePostWarehousePurchaseReceiptMutation: () => [vi.fn(), { isLoading: false }],
  useCreateReceiptCorrectionMutation: () => [vi.fn(), { isLoading: false }],
  useReworkWarehousePurchaseReceiptMutation: () => [vi.fn(), { isLoading: false }],
  useVoidWarehousePurchaseReceiptMutation: () => [vi.fn(), { isLoading: false }],
}))

const sampleReceiptItem = {
  receiptId: 'rc-1',
  receiptCode: 'PN-20260901-01',
  purchaseOrderId: 'po-1',
  supplierName: 'Nhà cung cấp An Phát',
  status: 'DRAFT',
  qualityStatus: 'PENDING_INSPECTION',
}

const sampleReceiptDetail = {
  receiptId: 'rc-1',
  receiptCode: 'PN-20260901-01',
  purchaseOrderId: 'po-1',
  concurrencyVersion: 1,
  status: 'DRAFT',
  qualityStatus: 'PENDING_INSPECTION',
  lines: [
    {
      receiptLineId: 'line-1',
      ingredientName: 'Thịt heo',
      receivedQuantity: 50,
      unitName: 'kg',
      acceptedQuantity: 50,
      rejectedQuantity: 0,
    },
  ],
}

describe('WarehouseReceiptLifecyclePanel behavioral contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lifecycleMocks.userRole = 'thukho'
    lifecycleMocks.detail.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('mounts the bounded workflow shell for loading and ready-empty states', () => {
    const refetch = vi.fn()
    lifecycleMocks.list.mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: true,
      refetch,
    })

    const { rerender } = render(
      <WarehouseReceiptLifecyclePanel purchaseOrderId="po-1" onSelectReceipt={vi.fn()} />,
    )

    const loadingPanel = screen.getByTestId('receipt-lifecycle-panel')
    expect(loadingPanel).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Đang tải phiếu nhập…')).toBeInTheDocument()

    // Ready empty state
    lifecycleMocks.list.mockReturnValue({
      data: { items: [], pageNumber: 1, pageSize: 20, totalCount: 0 },
      isError: false,
      isFetching: false,
      refetch,
    })

    rerender(<WarehouseReceiptLifecyclePanel purchaseOrderId="po-1" onSelectReceipt={vi.fn()} />)

    const readyPanel = screen.getByTestId('receipt-lifecycle-panel')
    expect(readyPanel).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByText('Chưa có phiếu nhập cần xử lý trong trang này.')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
  })

  it('renders domain instructions, section title, and business table caption', () => {
    lifecycleMocks.list.mockReturnValue({
      data: { items: [], pageNumber: 1, pageSize: 20, totalCount: 0 },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    render(<WarehouseReceiptLifecyclePanel purchaseOrderId="po-1" onSelectReceipt={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Xử lý phiếu nhập' })).toBeInTheDocument()
    expect(
      screen.getByText(/kiểm tra chất lượng từng dòng nguyên liệu → Quản lý duyệt → Quản trị viên ghi sổ kho/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Mỗi dòng là một phiếu nhập thuộc đơn mua đang chọn')).toBeInTheDocument()
  })

  it('renders receipt rows and invokes onSelectReceipt upon clicking "Xem trạng thái"', () => {
    const onSelectReceipt = vi.fn()
    lifecycleMocks.list.mockReturnValue({
      data: { items: [sampleReceiptItem], pageNumber: 1, pageSize: 20, totalCount: 1 },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    render(<WarehouseReceiptLifecyclePanel purchaseOrderId="po-1" onSelectReceipt={onSelectReceipt} />)

    expect(screen.getByText('PN-20260901-01')).toBeInTheDocument()
    expect(screen.getByText('Nhà cung cấp An Phát')).toBeInTheDocument()

    const viewStatusBtn = screen.getByRole('button', { name: 'Xem trạng thái' })
    fireEvent.click(viewStatusBtn)

    expect(onSelectReceipt).toHaveBeenCalledWith('rc-1')
  })

  it('displays role-guarded action buttons when viewing receipt details', () => {
    lifecycleMocks.userRole = 'thukho'
    lifecycleMocks.list.mockReturnValue({
      data: { items: [sampleReceiptItem], pageNumber: 1, pageSize: 20, totalCount: 1 },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
    lifecycleMocks.detail.mockReturnValue({
      data: sampleReceiptDetail,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    })

    const { rerender } = render(
      <WarehouseReceiptLifecyclePanel
        purchaseOrderId="po-1"
        selectedReceiptId="rc-1"
        onSelectReceipt={vi.fn()}
      />,
    )

    // Under thukho role, quality check is available
    expect(screen.getByRole('button', { name: /Kiểm tra chất lượng/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ghi sổ kho/i })).toBeNull()

    // Under admin role with posted receipt
    lifecycleMocks.userRole = 'admin'
    lifecycleMocks.detail.mockReturnValue({
      data: {
        ...sampleReceiptDetail,
        status: 'POSTED',
        qualityStatus: 'ACCEPTED',
      },
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    })

    rerender(
      <WarehouseReceiptLifecyclePanel
        purchaseOrderId="po-1"
        selectedReceiptId="rc-1"
        onSelectReceipt={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Điều chỉnh sau nhập/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kiểm tra chất lượng/i })).toBeNull()
  })
})
