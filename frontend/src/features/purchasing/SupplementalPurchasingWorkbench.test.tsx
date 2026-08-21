import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupplementalRequests: vi.fn(),
  getPurchaseRequests: vi.fn(),
  getPurchaseOrders: vi.fn(),
  decisionPanel: vi.fn(),
}));

vi.mock('@/api/warehouseApi', () => ({
  useGetSupplementalMaterialRequestsQuery: mocks.getSupplementalRequests,
}));

vi.mock('@/api/purchasingApi', () => ({
  useGetPurchaseRequestsQuery: mocks.getPurchaseRequests,
  useGetPurchaseOrdersQuery: mocks.getPurchaseOrders,
}));

vi.mock('./PurchaseDecisionPanel', () => ({
  PurchaseDecisionPanel: (props: unknown) => {
    mocks.decisionPanel(props);
    return <div data-testid="purchase-decision-panel" />;
  },
}));

import { SupplementalPurchasingWorkbench } from './SupplementalPurchasingWorkbench';

const readyQuery = <T,>(data: T, overrides: Record<string, unknown> = {}) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
  ...overrides,
});

const failedQuery = (status: number, refetch = vi.fn()) => ({
  data: undefined,
  currentData: undefined,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: true,
  error: { status },
  refetch,
});

const supplementalItem = {
  requestId: 'supplemental-1',
  requestCode: 'SUP-001',
  issueId: 'issue-1',
  issueCode: 'ISS-001',
  issueLineId: 'issue-line-1',
  warehouseId: 'warehouse-1',
  ingredientId: 'ingredient-1',
  ingredientName: 'Bầu',
  unitId: 'unit-1',
  unitName: 'kg',
  requestedQty: 3,
  fulfilledQty: 1,
  remainingQty: 2,
  availableQty: 0,
  status: 'PARTIALLY_FULFILLED',
  requestedAt: '2026-07-25T12:00:00Z',
  purchaseRequestId: 'purchase-1',
  purchaseRequestCode: 'PR-SUP-001',
  purchaseRequestStatus: 'DRAFT',
  canFulfill: false,
  canRouteToPurchasing: false,
  canReject: false,
};

const purchaseResponse = {
  data: [{
    purchaseRequestId: 'purchase-1',
    purchaseRequestCode: 'PR-SUP-001',
    materialRequestId: 'material-request-1',
    purchaseForDate: '2026-07-25',
    shiftName: 'FULLDAY',
    status: 'DRAFT',
    lines: [{
      purchaseRequestLineId: 'purchase-line-1',
      materialRequestLineId: 'material-line-1',
      ingredientId: 'ingredient-1',
      ingredientName: 'Bầu',
      supplierId: 'supplier-1',
      supplierName: 'Tôm - Chị Vân',
      unitId: 'unit-1',
      unitName: 'kg',
      requiredQty: 3,
      currentStockQty: 1,
      purchaseQty: 2,
      estimatedUnitPrice: 25_000,
      expectedDeliveryDate: '2026-07-26',
    }],
  }],
};

const supplementalPage = (totalCount = 1) => ({
  items: [supplementalItem],
  totalCount,
  pageNumber: 1,
  pageSize: 100,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
});

describe('SupplementalPurchasingWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupplementalRequests.mockReturnValue(readyQuery(supplementalPage()));
    mocks.getPurchaseRequests.mockReturnValue(readyQuery(purchaseResponse));
    mocks.getPurchaseOrders.mockReturnValue(readyQuery([]));
  });

  it('surfaces a linked supplemental purchase request in the normal decision panel', () => {
    render(<SupplementalPurchasingWorkbench week="2026-07-20" />);

    expect(mocks.getSupplementalRequests).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 100 });
    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText('PR-SUP-001')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-decision-panel')).toBeInTheDocument();
    expect(mocks.decisionPanel).toHaveBeenCalledWith(expect.objectContaining({
      panelId: 'supplemental-purchase-decision-panel',
      week: '2026-07-20',
      selectedStage: 'submitted',
      serviceDate: expect.objectContaining({
        purchaseRequestId: 'purchase-1',
        purchaseRequestCode: 'PR-SUP-001',
      }),
      selectedLine: expect.objectContaining({ purchaseRequestLineId: 'purchase-line-1' }),
    }));
  });

  it('renders query-level forbidden without offering a retry', () => {
    mocks.getPurchaseRequests.mockReturnValue(failedQuery(403));

    render(<SupplementalPurchasingWorkbench week="2026-07-20" />);

    expect(screen.getByText('Không có quyền xem nhu cầu mua bổ sung từ bếp')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('SUP-001')).toBeNull();
  });

  it('keeps a non-forbidden failure actionable', () => {
    const refetch = vi.fn();
    mocks.getSupplementalRequests.mockReturnValue(failedQuery(500, refetch));

    render(<SupplementalPurchasingWorkbench week="2026-07-20" />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));

    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.queryByText('SUP-001')).toBeNull();
  });

  it('keeps stale rows visible and reports a non-paged truncation while refreshing', () => {
    mocks.getSupplementalRequests.mockReturnValue(readyQuery(
      supplementalPage(3),
      { isFetching: true },
    ));

    render(<SupplementalPurchasingWorkbench week="2026-07-20" />);

    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật nhu cầu mua bổ sung')).toBeInTheDocument();
    expect(screen.getByText(/Đang hiển thị 1\/3 yêu cầu bổ sung/)).toBeInTheDocument();
  });
});
