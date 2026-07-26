import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupplementalRequests: vi.fn(),
  getPurchaseRequests: vi.fn(),
  getPurchaseOrders: vi.fn(),
  decisionPanel: vi.fn(),
}));

vi.mock('../workflowApi', () => ({
  useGetSupplementalMaterialRequestsQuery: mocks.getSupplementalRequests,
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

describe('SupplementalPurchasingWorkbench', () => {
  it('surfaces a linked supplemental purchase request in the normal decision panel', () => {
    mocks.getSupplementalRequests.mockReturnValue({
      data: {
        items: [{
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
        }],
      },
      isError: false,
    });
    mocks.getPurchaseRequests.mockReturnValue({
      data: {
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
      },
      isError: false,
    });
    mocks.getPurchaseOrders.mockReturnValue({ data: [], isError: false });

    render(<SupplementalPurchasingWorkbench week="2026-07-20" />);

    expect(mocks.getSupplementalRequests).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 100 });
    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText('PR-SUP-001')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-decision-panel')).toBeInTheDocument();
    expect(mocks.decisionPanel).toHaveBeenCalledWith(expect.objectContaining({
      week: '2026-07-20',
      selectedStage: 'submitted',
      serviceDate: expect.objectContaining({
        purchaseRequestId: 'purchase-1',
        purchaseRequestCode: 'PR-SUP-001',
      }),
      selectedLine: expect.objectContaining({ purchaseRequestLineId: 'purchase-line-1' }),
    }));
  });
});
