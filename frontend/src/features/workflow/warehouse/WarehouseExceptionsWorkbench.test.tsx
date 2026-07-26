import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fulfill: vi.fn(),
  route: vi.fn(),
  reject: vi.fn(),
  confirmReturn: vi.fn(),
  refetchSupplemental: vi.fn(),
  refetchReturns: vi.fn(),
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
  lines: [{ returnLineId: 'return-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', quantity: 2, unitId: 'unit-1', unitName: 'kg' }],
};

vi.mock('../workflowApi', () => ({
  useGetSupplementalMaterialRequestsQuery: () => ({
    data: { items: [supplemental], totalCount: 1, pageNumber: 1, pageSize: 8, totalPages: 1, hasPrev: false, hasNext: false },
    isFetching: false,
    isError: false,
    refetch: mocks.refetchSupplemental,
  }),
  useGetInventoryReturnsQuery: () => ({
    data: { items: [inventoryReturn], totalCount: 1, pageNumber: 1, pageSize: 8, totalPages: 1, hasPrev: false, hasNext: false },
    isFetching: false,
    isError: false,
    refetch: mocks.refetchReturns,
  }),
  useGetInventoryReturnByIdQuery: (id: string) => ({ data: id ? inventoryReturn : undefined, isFetching: false, isError: false, refetch: vi.fn() }),
  useFulfillSupplementalMaterialRequestMutation: () => [mocks.fulfill, { isLoading: false }],
  useRouteSupplementalMaterialRequestToPurchasingMutation: () => [mocks.route, { isLoading: false }],
  useRejectSupplementalMaterialRequestMutation: () => [mocks.reject, { isLoading: false }],
  useConfirmInventoryReturnReceiptMutation: () => [mocks.confirmReturn, { isLoading: false }],
}));

import { WarehouseExceptionsWorkbench } from './WarehouseExceptionsWorkbench';

describe('WarehouseExceptionsWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fulfill.mockReturnValue({ unwrap: () => Promise.resolve({ data: { ...supplemental, fulfilledQty: 3, remainingQty: 2 } }) });
    mocks.route.mockReturnValue({ unwrap: () => Promise.resolve({ data: { ...supplemental, purchaseRequestCode: 'PR-SUP-001' } }) });
    mocks.reject.mockReturnValue({ unwrap: () => Promise.resolve({ data: { ...supplemental, status: 'REJECTED' } }) });
    mocks.confirmReturn.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) });
  });

  it('shows server-authoritative actions and creates a partial supplemental issue', async () => {
    render(<WarehouseExceptionsWorkbench canManage />);

    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText(/Kho chỉ đủ cấp một phần 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cấp bổ sung' }));
    expect(screen.getByLabelText('Số lượng cấp (kg)')).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cấp' }));

    await waitFor(() => expect(mocks.fulfill).toHaveBeenCalledWith({ requestId: 'supplemental-1', quantity: 3 }));
    expect(await screen.findByText(/đã cấp 3 kg, còn 2 kg/)).toBeInTheDocument();
  });

  it('lets warehouse confirm actual return quantity and discrepancy semantics', async () => {
    render(<WarehouseExceptionsWorkbench canManage />);

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByLabelText('Số thực nhận (kg)')).toHaveValue(2);
    fireEvent.click(screen.getByLabelText('Có chênh lệch so với bếp khai báo'));
    fireEvent.change(screen.getByLabelText('Mô tả chênh lệch'), { target: { value: 'Chỉ nhận 1.5 kg còn sử dụng được' } });
    fireEvent.change(screen.getByLabelText('Số thực nhận (kg)'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tiếp nhận' }));

    await waitFor(() => expect(mocks.confirmReturn).toHaveBeenCalledWith({
      returnId: 'return-1',
      hasDiscrepancy: true,
      discrepancyNote: 'Chỉ nhận 1.5 kg còn sử dụng được',
      adjustedLines: [{ returnLineId: 'return-line-1', newQuantity: 1.5 }],
    }));
  });
});
