import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fulfill: vi.fn(),
  route: vi.fn(),
  reject: vi.fn(),
  confirmReturn: vi.fn(),
  createAllocationDisposition: vi.fn(),
  recordReceipt: vi.fn(),
  refetchSupplemental: vi.fn(),
  refetchReturns: vi.fn(),
  refetchReturnDetail: vi.fn(),
  supplementalQuery: vi.fn(),
  returnsQuery: vi.fn(),
  returnDetailQuery: vi.fn(),
  allocationQuery: vi.fn(),
}));

const supplemental = {
  requestId: 'supplemental-1',
  requestCode: 'SUP-001',
  issueId: 'issue-1',
  issueCode: 'ISS-001',
  issueLineId: 'issue-line-1',
  warehouseId: 'warehouse-1',
  ingredientId: 'ingredient-1',
  ingredientName: 'Gạo',
  unitId: 'unit-1',
  unitName: 'kg',
  requestedQty: 5,
  fulfilledQty: 0,
  remainingQty: 5,
  availableQty: 3,
  reason: 'Phát sinh thêm suất',
  status: 'PENDING_WAREHOUSE_REVIEW',
  requestedAt: '2026-07-20T08:00:00Z',
  concurrencyVersion: 1,
  canFulfill: true,
  canRouteToPurchasing: true,
  canReject: true,
  actionDisabledReason: 'Kho chỉ đủ cấp một phần 3; phần còn lại cần chuyển thu mua.',
};

const inventoryReturn = {
  returnId: 'return-1',
  returnCode: 'RET-001',
  returnDate: '2026-07-20',
  shiftName: 'MORNING',
  returnType: 'RETURN' as const,
  warehouseId: 'warehouse-1',
  warehouseName: 'Kho chính',
  issueId: 'issue-1',
  issueCode: 'ISS-001',
  reason: 'Dư sau ca',
  createdBy: 'chef-1',
  createdByName: 'Bếp trưởng',
  createdAt: '2026-07-20T12:00:00Z',
  status: 'PENDING_RECEIPT',
  concurrencyVersion: 0,
  lines: [{ returnLineId: 'return-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', quantity: 2, unitId: 'unit-1', unitName: 'Kilogram' }],
};

const allocationRow = {
  sourceIssueLineId: 'source-line-a', materialRequestLineId: 'material-line-a', customerId: 'customer-a', customerCode: 'ANV', customerName: 'An Vui', serviceDate: '2026-07-20', shiftName: 'MORNING', priceTierAmount: 25000,
  ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'unit-1', unitName: 'kg', issuedQuantity: 5, kitchenAcknowledgedQuantity: 5,
  returnedQuantity: 1, wastedQuantity: 1, disposedQuantity: 0, incomingDispositionQuantity: 0, excessQuantity: 3, version: 0,
  decisionId: 'return-allocation:source-line-a', allowedActions: ['CROSS_CUSTOMER_DISPOSITION'],
};

vi.mock('@/api/warehouseApi', () => ({
  useGetSupplementalMaterialRequestsQuery: mocks.supplementalQuery,
  useGetInventoryReturnsQuery: mocks.returnsQuery,
  useGetInventoryReturnByIdQuery: mocks.returnDetailQuery,
  useFulfillSupplementalMaterialRequestMutation: () => [mocks.fulfill, { isLoading: false }],
  useRouteSupplementalMaterialRequestToPurchasingMutation: () => [mocks.route, { isLoading: false }],
  useRejectSupplementalMaterialRequestMutation: () => [mocks.reject, { isLoading: false }],
  useConfirmInventoryReturnReceiptMutation: () => [mocks.confirmReturn, { isLoading: false }],
  useGetReturnAllocationBalancesQuery: mocks.allocationQuery,
  useCreateReturnAllocationDispositionMutation: () => [mocks.createAllocationDisposition, { isLoading: false }],
  useRecordWarehousePurchaseReceiptMutation: () => [mocks.recordReceipt, { isLoading: false }],
}));

import { WarehouseExceptionsWorkbench } from './WarehouseExceptionsWorkbench';
import { WarehousePurchaseReceiptDialog } from './WarehousePurchaseReceiptDialog';
import warehouseSource from './WarehouseExceptionsWorkbench.tsx?raw';
import warehouseApiSource from '@/api/warehouseApi.ts?raw';
import type { PurchaseOrderDto, PurchaseOrderLineDto } from '@/api/workflowApi';

const readyQuery = <T,>(data: T, refetch: () => unknown = vi.fn(), overrides: Record<string, unknown> = {}) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch,
  ...overrides,
});

const uninitializedQuery = () => ({
  data: undefined,
  currentData: undefined,
  isUninitialized: true,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
});

const failedQuery = (status: number, refetch: () => unknown = vi.fn()) => ({
  ...uninitializedQuery(),
  isUninitialized: false,
  isError: true,
  error: { status },
  refetch,
});

describe('WarehouseExceptionsWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supplementalQuery.mockImplementation(({ pageNumber }: { pageNumber: number }) => readyQuery(
      { items: [supplemental], totalCount: 16, pageNumber, pageSize: 8, totalPages: 2, hasPrev: pageNumber > 1, hasNext: pageNumber < 2 },
      mocks.refetchSupplemental,
    ));
    mocks.returnsQuery.mockImplementation(({ pageNumber }: { pageNumber: number }) => readyQuery(
      { items: [inventoryReturn], totalCount: 16, pageNumber, pageSize: 8, totalPages: 2, hasPrev: pageNumber > 1, hasNext: pageNumber < 2 },
      mocks.refetchReturns,
    ));
    mocks.returnDetailQuery.mockImplementation((id: string) => id
      ? readyQuery(inventoryReturn, mocks.refetchReturnDetail)
      : uninitializedQuery());
    mocks.allocationQuery.mockReturnValue(readyQuery([allocationRow, { ...allocationRow, sourceIssueLineId: 'source-line-b', customerId: 'customer-b', customerCode: 'DAV', customerName: 'Dịch vụ An Vui', excessQuantity: 0, decisionId: undefined, allowedActions: [] }]));
    mocks.fulfill.mockReturnValue({ unwrap: () => Promise.resolve({ data: { ...supplemental, fulfilledQty: 3, remainingQty: 2 } }) });
    mocks.route.mockReturnValue({ unwrap: () => Promise.resolve({ data: { ...supplemental, purchaseRequestCode: 'PR-SUP-001' } }) });
    mocks.reject.mockReturnValue({ unwrap: () => Promise.resolve({ data: { ...supplemental, status: 'REJECTED' } }) });
    mocks.confirmReturn.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) });
    mocks.createAllocationDisposition.mockReturnValue({ unwrap: () => Promise.resolve({ allocationDispositionId: 'allocation-1' }) });
    mocks.recordReceipt.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) });
  });

  it('renders the operational warehouse as passive receipt context', () => {
    render(<WarehousePurchaseReceiptDialog
      open
      order={{ purchaseOrderId: 'po-1', purchaseOrderCode: 'PO-001', supplierName: 'Nhà cung cấp Minh An' } as PurchaseOrderDto}
      line={{
        purchaseOrderLineId: 'line-1',
        ingredientName: 'Gạo',
        orderedQty: 5,
        receivedQty: 0,
        unitPrice: 20_000,
        unitName: 'kg',
        unitId: 'unit-1',
        lotNumberRequired: false,
        manufactureDateRequired: false,
        expiryDateRequired: false,
      } as PurchaseOrderLineDto}
      warehouses={[{ warehouseId: 'warehouse-1', warehouseCode: 'KHO-01', warehouseName: 'Kho chính' }]}
      onOpenChange={vi.fn()}
      onSuccess={vi.fn()}
    />);

    expect(screen.queryByRole('combobox', { name: /Kho nhận/ })).not.toBeInTheDocument();
    expect(screen.getByText('Kho chính')).toBeInTheDocument();
  });

  it('shows server-authoritative actions and creates a partial supplemental issue', async () => {
    render(<WarehouseExceptionsWorkbench canManage />);

    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText(/Kho chỉ đủ cấp một phần 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cấp bổ sung' }));
    expect(screen.getByLabelText('Số lượng cấp (kg)')).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cấp' }));

    await waitFor(() => expect(mocks.fulfill).toHaveBeenCalledWith({
      requestId: 'supplemental-1', commandId: expect.any(String), expectedVersion: 1, quantity: 3,
    }));
    expect(await screen.findByText(/đã cấp 3 kg, còn 2 kg/)).toBeInTheDocument();
  });

  it('keeps supplemental lifecycle identity in the generated request contract', () => {
    expect(warehouseApiSource).toContain('query: ({ requestId, commandId, expectedVersion, quantity })')
    expect(warehouseApiSource).toContain('body: { commandId, expectedVersion, quantity }')
  })

  it('keeps small partial quantities visible instead of rounding them to zero or full', () => {
    expect(warehouseSource).toContain('formatQuantityWithUnit(item.fulfilledQty, item.unitName, { maximumFractionDigits: 6 })')
    expect(warehouseSource).toContain('formatQuantityWithUnit(selectedSupplemental.remainingQty, selectedSupplemental.unitName, { maximumFractionDigits: 6 })')
    expect(warehouseSource).toContain('Còn thiếu {formatQuantityWithUnit(item.remainingQty, item.unitName, { maximumFractionDigits: 6 })}')
  })

  it('routes only the remaining supplemental quantity with lifecycle identity', async () => {
    render(<WarehouseExceptionsWorkbench canManage />)
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển thu mua' }))
    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith({
      requestId: 'supplemental-1', commandId: expect.any(String), expectedVersion: 1,
    }))
  })

  it('rejects a supplemental request with lifecycle concurrency identity', async () => {
    render(<WarehouseExceptionsWorkbench canManage />)
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }))
    fireEvent.change(screen.getByLabelText('Lý do từ chối'), { target: { value: 'Không đúng nhu cầu thực tế' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }))

    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith({
      requestId: 'supplemental-1',
      commandId: expect.any(String),
      expectedVersion: 1,
      reason: 'Không đúng nhu cầu thực tế',
    }))
  })

  it('lets warehouse confirm actual return quantity and discrepancy semantics', async () => {
    render(<WarehouseExceptionsWorkbench canManage />);

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByLabelText('Số thực nhận (kg)')).toHaveValue(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Có chênh lệch so với bếp khai báo' }));
    fireEvent.change(screen.getByLabelText('Mô tả chênh lệch'), { target: { value: 'Chỉ nhận 1.5 kg còn sử dụng được' } });
    fireEvent.change(screen.getByLabelText('Số thực nhận (kg)'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tiếp nhận' }));

    await waitFor(() => expect(mocks.confirmReturn).toHaveBeenCalledWith(expect.objectContaining({
      returnId: 'return-1',
      commandId: expect.any(String),
      expectedVersion: 0,
      hasDiscrepancy: true,
      discrepancyNote: 'Chỉ nhận 1.5 kg còn sử dụng được',
      adjustedLines: [{ returnLineId: 'return-line-1', newQuantity: 1.5 }],
    })));
  });

  it('renders exact allocation scope and submits only a backend-authorized disposition', async () => {
    render(<WarehouseExceptionsWorkbench canManage canDisposition />);

    expect(screen.getByText('An Vui (ANV)')).toBeInTheDocument();
    expect(screen.queryByText('customer-a')).toBeNull();
    expect(screen.queryByText('source-line-a')).toBeNull();
    expect(screen.queryByText('return-allocation:source-line-a')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Điều phối phần dư' }));
    fireEvent.change(screen.getByLabelText('Chuyển sang phạm vi'), { target: { value: 'source-line-b' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Điều phối dư đã được phê duyệt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận điều phối' }));

    await waitFor(() => expect(mocks.createAllocationDisposition).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: 'return-allocation:source-line-a', sourceIssueLineId: 'source-line-a', destinationSourceLineId: 'source-line-b', quantity: 3,
      reason: 'Điều phối dư đã được phê duyệt', expectedVersion: 0,
    })));
  });

  it('blocks false supplemental empty content and retries its failed owner', () => {
    mocks.supplementalQuery.mockReturnValue(failedQuery(500, mocks.refetchSupplemental));

    render(<WarehouseExceptionsWorkbench canManage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được yêu cầu cấp bổ sung');
    expect(screen.queryByText('Không có yêu cầu bổ sung trong phạm vi kho.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    expect(mocks.refetchSupplemental).toHaveBeenCalledOnce();
  });

  it('renders supplemental forbidden without retry or false empty content', () => {
    mocks.supplementalQuery.mockReturnValue(failedQuery(403));

    render(<WarehouseExceptionsWorkbench canManage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền xem yêu cầu cấp bổ sung.');
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Không có yêu cầu bổ sung trong phạm vi kho.')).toBeNull();
  });

  it('keeps supplemental rows visible while refreshing', () => {
    mocks.supplementalQuery.mockReturnValue(readyQuery(
      { items: [supplemental], totalCount: 1, pageNumber: 1, pageSize: 8, totalPages: 1, hasPrev: false, hasNext: false },
      mocks.refetchSupplemental,
      { isFetching: true },
    ));

    render(<WarehouseExceptionsWorkbench canManage />);

    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật yêu cầu cấp bổ sung');
  });

  it('blocks false return-list empty content when its owner fails', () => {
    mocks.returnsQuery.mockReturnValue(failedQuery(500, mocks.refetchReturns));

    render(<WarehouseExceptionsWorkbench canManage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được phiếu trả');
    expect(screen.queryByText('Không có phiếu trả hoặc hao hụt đang chờ kho.')).toBeNull();
  });

  it('keeps return-detail forbidden distinct from an empty receipt form', () => {
    mocks.returnDetailQuery.mockImplementation((id: string) => id ? failedQuery(403) : uninitializedQuery());

    render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    const dialog = screen.getByRole('dialog', { name: 'Tiếp nhận nguyên liệu trả' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bạn không có quyền xem chi tiết phiếu trả.');
    expect(within(dialog).queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Xác nhận tiếp nhận' })).toBeDisabled();
  });

  it('defers both server searches and resets each owned page', async () => {
    expect(warehouseSource).toContain('searchKeyword: deferredSupplementalSearch || undefined');
    expect(warehouseSource).toContain('searchKeyword: deferredReturnSearch || undefined');

    render(<WarehouseExceptionsWorkbench canManage />);
    const paginations = screen.getAllByRole('navigation', { name: 'Phân trang danh sách' });

    fireEvent.click(within(paginations[0]).getByRole('button', { name: /trang 2 trong 2/i }));
    await waitFor(() => expect(mocks.supplementalQuery).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 })));
    fireEvent.change(screen.getByLabelText('Tìm yêu cầu, nguyên liệu hoặc trạng thái'), { target: { value: '  Gạo  ' } });
    await waitFor(() => expect(mocks.supplementalQuery).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, searchKeyword: 'Gạo' })));

    fireEvent.click(within(paginations[1]).getByRole('button', { name: /trang 2 trong 2/i }));
    await waitFor(() => expect(mocks.returnsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 })));
    fireEvent.change(screen.getByLabelText('Tìm phiếu trả, ngày hoặc lý do'), { target: { value: '  Dư ca  ' } });
    await waitFor(() => expect(mocks.returnsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, searchKeyword: 'Dư ca' })));
  });

  it('associates supplemental quantity and rejection validation with their fields', () => {
    const view = render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Cấp bổ sung' }));
    fireEvent.change(screen.getByLabelText('Số lượng cấp (kg)'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cấp' }));

    expect(screen.getByLabelText('Số lượng cấp (kg)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Số lượng cấp (kg)')).toHaveAccessibleDescription(/Số lượng cấp chưa hợp lệ/);

    view.unmount();
    render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));

    expect(screen.getByLabelText('Lý do từ chối')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Lý do từ chối')).toHaveAccessibleDescription('Thiếu lý do từ chối Nhập lý do để bếp biết cách xử lý tiếp theo.');
  });

  it('associates return discrepancy and line-quantity validation with their fields', () => {
    render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Có chênh lệch so với bếp khai báo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tiếp nhận' }));

    expect(screen.getByLabelText('Mô tả chênh lệch')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Mô tả chênh lệch')).toHaveAccessibleDescription('Thiếu mô tả chênh lệch Ghi rõ số thực nhận hoặc tình trạng nguyên liệu trước khi xác nhận.');

    fireEvent.change(screen.getByLabelText('Mô tả chênh lệch'), { target: { value: 'Không nhận được' } });
    fireEvent.change(screen.getByLabelText('Số thực nhận (kg)'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tiếp nhận' }));

    expect(screen.getByLabelText('Số thực nhận (kg)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Số thực nhận (kg)')).toHaveAccessibleDescription('Số thực nhận chưa hợp lệ Số thực nhận phải từ 0 trở lên.');
  });

  it('keeps each dialog mutation failure inside the dialog that initiated it', async () => {
    mocks.fulfill.mockReturnValue({ unwrap: () => Promise.reject({ data: { message: 'Tồn kho vừa thay đổi.' } }) });
    const firstView = render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Cấp bổ sung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cấp' }));
    let dialog = screen.getByRole('dialog', { name: 'Cấp nguyên liệu bổ sung' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Chưa cấp được nguyên liệu'));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Tồn kho vừa thay đổi.');

    firstView.unmount();
    mocks.reject.mockReturnValue({ unwrap: () => Promise.reject({ data: { message: 'Yêu cầu đã được xử lý.' } }) });
    const secondView = render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    fireEvent.change(screen.getByLabelText('Lý do từ chối'), { target: { value: 'Không đủ điều kiện' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    dialog = screen.getByRole('dialog', { name: 'Từ chối yêu cầu bổ sung' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Chưa từ chối được yêu cầu'));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Yêu cầu đã được xử lý.');

    secondView.unmount();
    mocks.confirmReturn.mockReturnValue({ unwrap: () => Promise.reject({ data: { message: 'Phiếu trả vừa được tiếp nhận.' } }) });
    render(<WarehouseExceptionsWorkbench canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tiếp nhận' }));
    dialog = screen.getByRole('dialog', { name: 'Tiếp nhận nguyên liệu trả' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Chưa xác nhận được phiếu trả'));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Phiếu trả vừa được tiếp nhận.');
  });
});
