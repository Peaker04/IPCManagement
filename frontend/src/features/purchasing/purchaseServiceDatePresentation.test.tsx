import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApi';
import { PurchaseServiceDateWorkbench } from './PurchaseServiceDateWorkbench';

describe('PurchaseServiceDateWorkbench terminal state', () => {
  it('sizes a true empty state to its message instead of reserving the populated table height', () => {
    render(
      <PurchaseServiceDateWorkbench
        serviceDates={[]}
        page={1}
        pageSize={8}
        totalItems={0}
        isLoading={false}
        onDateChange={vi.fn()}
        onLineChange={vi.fn()}
        onPageChange={vi.fn()}
      />,
    );

    const viewport = screen.getByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' });
    const emptyMessage = screen.getByText('Chưa có nhu cầu đã duyệt trong tuần này.');

    expect(viewport).not.toHaveClass('h-[400px]', 'xl:h-[480px]');
    expect(emptyMessage).not.toHaveClass('h-[320px]');
  });

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
    expect(screen.getByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' })).toHaveClass('h-[400px]', 'xl:h-[480px]');
  });

  it('groups repeated ingredient identities and keeps every source line actionable', () => {
    const onLineChange = vi.fn();
    const baseLine = {
      materialRequestLineId: 'material-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo',
      unitId: 'unit-1', unitName: 'kg', requiredQty: 10, currentStockQty: 0, purchaseQty: 10,
      estimatedUnitPrice: 20_000, supplierId: 'supplier-1', supplierName: 'Nhà cung cấp A',
      supplierDecisionStatus: 'CONFIRMED', supplierDecisionHistory: [],
    };
    const serviceDate = {
      serviceDate: '2026-07-20', scope: 'FULLDAY', currentStage: 'supplier-price',
      approvedDemandCount: 1, shortageLineCount: 2, supplierReadyLineCount: 2, blockingExceptionCount: 0,
      orderCount: 0, receivingLineCount: 0, fullyReceivedLineCount: 0, approvedDemands: [],
      purchaseLines: [
        { ...baseLine, purchaseRequestLineId: 'line-1' },
        { ...baseLine, purchaseRequestLineId: 'line-2', materialRequestLineId: 'material-line-2', purchaseQty: 5 },
      ],
    } as PurchaseWorkbenchServiceDate;

    render(<PurchaseServiceDateWorkbench serviceDates={[serviceDate]} selectedDate="2026-07-20" page={1} pageSize={8} totalItems={1} isLoading={false} onDateChange={vi.fn()} onLineChange={onLineChange} onPageChange={vi.fn()} />);

    expect(screen.getAllByText('Gạo')).toHaveLength(1);
    expect(screen.getByText('15 kg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem 2 nguồn' }));
    expect(screen.getByText('line-1')).toBeInTheDocument();
    expect(screen.getByText('line-2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mở dòng nguồn' })[1]);
    expect(onLineChange).toHaveBeenCalledWith('line-2');
  });
});
