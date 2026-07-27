import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApi';
import { PurchaseServiceDateWorkbench } from './PurchaseServiceDateWorkbench';

describe('PurchaseServiceDateWorkbench terminal state', () => {
  it('shows received demand and supplier coverage from persisted purchase lines', () => {
    const serviceDate: PurchaseWorkbenchServiceDate = {
      serviceDate: '2026-07-20',
      scope: 'FULLDAY',
      currentStage: 'receiving',
      approvedDemandCount: 0,
      shortageLineCount: 0,
      supplierReadyLineCount: 1,
      blockingExceptionCount: 0,
      purchaseRequestId: 'request-1',
      purchaseRequestCode: 'PR-001',
      purchaseRequestStatus: 'APPROVED',
      orderCount: 1,
      receivingLineCount: 1,
      fullyReceivedLineCount: 1,
      approvedDemands: [],
      purchaseLines: [{
        purchaseRequestLineId: 'line-1',
        materialRequestLineId: 'material-line-1',
        ingredientId: 'ingredient-1',
        ingredientName: 'Gạo',
        unitId: 'unit-1',
        unitName: 'kg',
        requiredQty: 10,
        currentStockQty: 0,
        purchaseQty: 10,
        estimatedUnitPrice: 20_000,
        supplierId: 'supplier-1',
        supplierName: 'Nhà cung cấp A',
        supplierDecisionStatus: 'CONFIRMED',
        supplierDecisionHistory: [],
      }],
    };

    render(
      <PurchaseServiceDateWorkbench
        serviceDates={[serviceDate]}
        selectedDate="2026-07-20"
        page={1}
        pageSize={8}
        totalItems={1}
        isLoading={false}
        onDateChange={vi.fn()}
        onLineChange={vi.fn()}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Đã nhận đủ').length).toBeGreaterThan(0);
    expect(screen.getByText('NCC: 1/1')).toBeInTheDocument();
    expect(screen.queryByText('Chưa tạo')).not.toBeInTheDocument();
  });
});
