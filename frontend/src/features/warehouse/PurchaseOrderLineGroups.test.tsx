import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PurchaseOrderDto, PurchaseOrderLineDto } from '@/api/workflowApi';
import { WarehousePurchaseOrdersPanel } from './pages/WarehousePurchaseOrdersPanel';
import { PurchaseOrderLineGroups } from './PurchaseOrderLineGroups';

const line = (id: string, orderedQty: number, receivedQty: number): PurchaseOrderLineDto => ({
  purchaseOrderLineId: id,
  purchaseRequestLineId: `request-${id}`,
  ingredientId: 'ingredient-1',
  ingredientName: 'Bún tươi',
  unitId: 'unit-1',
  unitName: 'kg',
  orderedQty,
  receivedQty,
  unitPrice: 9_500,
  lotNumberRequired: false,
  manufactureDateRequired: false,
  expiryDateRequired: false,
});

describe('WarehousePurchaseOrdersPanel', () => {
  const props = {
    canReceivePurchases: true,
    isFetchingPurchaseOrders: false,
    isPurchaseOrderDetailsOpen: false,
    selectedPurchaseOrderId: null,
    purchaseOrderDetailsHref: () => '/warehouse',
    onSelectReceiptLine: vi.fn(),
    pageNumber: 1,
    pageSize: 8,
    totalItems: 0,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onOpenBatchReceipt: vi.fn(),
  };

  it('renders the receiving table semantics and truthful empty state', () => {
    const view = render(<MemoryRouter><WarehousePurchaseOrdersPanel {...props} purchaseOrders={[]} /></MemoryRouter>);
    const region = screen.getByRole('region', { name: 'Đơn mua và tiến độ nhập kho' });
    expect(within(region).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Đơn mua / Nhà cung cấp',
      'Đề xuất nguồn',
      'Tiến độ nhập',
      'Trạng thái',
      'Thao tác',
    ]);
    expect(screen.getByText('Chưa có đơn mua trong phạm vi hiện tại.')).toBeInTheDocument();

    const order = { purchaseOrderId: 'po-1', purchaseOrderCode: 'PO-001', purchaseRequestCode: 'PR-001', supplierName: 'Nhà cung cấp A', status: 'APPROVED', orderDate: '2026-07-20', lines: [line('line-1', 10, 2)] } as PurchaseOrderDto;
    view.rerender(<MemoryRouter><WarehousePurchaseOrdersPanel {...props} purchaseOrders={[order]} totalItems={1} /></MemoryRouter>);
    expect(screen.getByText('Nhà cung cấp A')).toBeInTheDocument();
    expect(screen.getByText('1/1 dòng còn phải nhận')).toHaveAttribute('data-cell-role', 'numeric');
    expect(screen.getByRole('link', { name: 'Xem chi tiết PO-001' })).toBeInTheDocument();

    view.rerender(<MemoryRouter><WarehousePurchaseOrdersPanel {...props} isPurchaseOrderDetailsOpen selectedPurchaseOrderId="po-1" selectedPurchaseOrder={order} purchaseOrders={[order]} totalItems={1} /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Chi tiết PO-001' })).toHaveFocus();
  });
});

describe('PurchaseOrderLineGroups', () => {
  it('shows one ingredient group while retaining receipt actions for each source line', () => {
    const onReceive = vi.fn();
    render(<PurchaseOrderLineGroups lines={[line('line-1', 10, 2), line('line-2', 5, 0)]} canReceive onReceive={onReceive} />);

    expect(screen.getAllByText('Bún tươi')).toHaveLength(1);
    expect(screen.getByText('2/15 kg')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Nhóm dòng đơn mua chờ nhập kho' });
    expect(region).toHaveAccessibleDescription('Nhóm nguyên liệu theo đơn vị trong đơn mua, số lượng đã nhận/còn lại và đơn giá đặt; mở từng dòng nguồn để ghi nhận nhập kho');
    expect(screen.getAllByRole('columnheader').map((header) => header.getAttribute('scope'))).toEqual(['col', 'col', 'col', 'col', 'col']);
    expect(screen.getByText('2/15 kg').closest('td')).toHaveAttribute('data-cell-role', 'numeric');
    expect(region.querySelectorAll('td[data-cell-role="numeric"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Xem 2 nguồn' }));
    expect(screen.queryByText('line-1')).not.toBeInTheDocument();
    expect(screen.queryByText('line-2')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ghi nhận dòng này' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ghi nhận dòng này' })[1]);
    expect(onReceive).toHaveBeenCalledWith(expect.objectContaining({ purchaseOrderLineId: 'line-2' }));
  });

  it('shows the actual small remaining quantity instead of a floating-point artifact', () => {
    render(<PurchaseOrderLineGroups lines={[line('line-small', 0.001, 0.0008)]} canReceive onReceive={vi.fn()} />);

    expect(screen.getByText('Còn 0,0002 kg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghi nhận nhập kho' })).toBeEnabled();
  });

  it('marks a source line with an active receipt as unavailable for another draft', () => {
    const onReceive = vi.fn();
    render(<PurchaseOrderLineGroups lines={[{ ...line('line-1', 10, 0), activeReceiptId: 'receipt-1', activeReceiptCode: 'RCP-001', activeReceiptStatus: 'DRAFT' }]} canReceive onReceive={onReceive} />);

    expect(screen.getByRole('button', { name: 'Đang chờ xử lý ở RCP-001 (Bản nháp)' })).toBeDisabled();
    expect(screen.getByText('1 dòng đã có phiếu chờ xử lý')).toBeInTheDocument();
  });
});
