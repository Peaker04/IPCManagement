import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import source from './WarehouseReceiptLifecyclePanel.tsx?raw';

const lifecycleMocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
}));

vi.mock('@/lib/useHasRole', () => ({ useHasRole: () => false }));
vi.mock('@/api/warehouseApi', () => ({
  useGetInventoryReceiptsQuery: lifecycleMocks.list,
  useGetInventoryReceiptByIdQuery: lifecycleMocks.detail,
  useAcceptReceiptQualityMutation: () => [vi.fn(), { isLoading: false }],
  usePostWarehousePurchaseReceiptMutation: () => [vi.fn(), { isLoading: false }],
  useCreateReceiptCorrectionMutation: () => [vi.fn(), { isLoading: false }],
  useReworkWarehousePurchaseReceiptMutation: () => [vi.fn(), { isLoading: false }],
  useVoidWarehousePurchaseReceiptMutation: () => [vi.fn(), { isLoading: false }],
}));

import { WarehouseReceiptLifecyclePanel } from './WarehouseReceiptLifecyclePanel';

describe('WarehouseReceiptLifecyclePanel contract', () => {
  it('reloads the canonical receipt read-model before lifecycle actions', () => {
    expect(source).toContain('useGetInventoryReceiptsQuery');
    expect(source).toContain('useGetInventoryReceiptByIdQuery');
    expect(source).toContain("!receipt.purchaseOrderId");
    expect(source).toContain('đơn mua gốc');
  });

  it('loads only receipts belonging to the selected purchase order and keeps receipt selection URL-owned', () => {
    expect(source).toContain('purchaseOrderId: string');
    expect(source).toContain('selectedReceiptId?: string');
    expect(source).toContain('purchaseOrderId, pageNumber: receiptPageNumber');
    expect(source).toContain('onSelectReceipt(item.receiptId)');
    expect(source).not.toContain('canonicalReceipts[0]?.receiptId');
    expect(source).not.toContain('[selectedReceiptId, setSelectedReceiptId]');
  });

  it('keeps quality, manager approval, and POST ownership visibly separate', () => {
    expect(source).toContain("useHasRole(['thukho'])");
    expect(source).toContain("useHasRole(['admin'])");
    expect(source).toContain("useHasRole(['dieuphoi'])");
    expect(source).toContain("receipt.status === 'PENDING_APPROVAL'");
    expect(source).toContain('Chỉ Thủ kho được kiểm tra chất lượng.');
    expect(source).toContain('Chỉ Quản trị viên được ghi sổ kho sau khi Quản lý duyệt.');
  });

  it('requires every rejected quantity to carry a reason and sends the optimistic version', () => {
    expect(source).toContain('rejectedQuantity > 0 && !line.reason');
    expect(source).toContain('expectedVersion: receipt.concurrencyVersion');
    expect(source).toContain('commandId: actionCommandIds.quality');
    expect(source).toContain('commandId: actionCommandIds.post');
    expect(source).toContain('commandId: actionCommandIds.rework');
    expect(source).toContain("renewCommand('quality')");
    expect(source).toContain("renewCommand('post')");
    expect(source).toContain("renewCommand('rework')");
    expect(source).toContain('Lý do xử lý lại không được để trống.');
    expect(source.match(/maximumFractionDigits: 6/g)).toHaveLength(3);
  });

  it('offers only Admin an append-only correction after POSTED with source-line quantities and a mandatory reason', () => {
    expect(source).toContain("receipt.status === 'POSTED' && canCorrect");
    expect(source).toContain('commandId: actionCommandIds.correction');
    expect(source).toContain("renewCommand('correction')");
    expect(source).toContain('expectedVersion: 0');
    expect(source).toContain('Lý do điều chỉnh không được để trống.');
    expect(source).toContain('không sửa phiếu nhập hoặc bút toán gốc');
    expect(source).toContain('Ghi sổ chứng từ điều chỉnh');
  });

  it('preserves dirty form values across accidental close and resets them only after success or receipt selection', () => {
    expect(source).not.toContain("setReworkReason(''); setReworkOpen(true)");
    expect(source).not.toContain("setVoidReason(''); setVoidOpen(true)");
    expect(source).not.toContain("setCorrectionDraft({}); setCorrectionOpen(true)");
    expect(source).toMatch(/setQualityOpen\(false\);\s+setQualityDraft\(\{\}\);/)
    expect(source).toContain("onSelectReceipt(item.receiptId); setQualityDraft({}); setReworkReason('');")
  });

  it('uses warehouse language instead of implementation vocabulary in visible copy', () => {
    expect(source).toContain('Xử lý phiếu nhập');
    expect(source).toContain('từng dòng nguyên liệu');
    expect(source).toContain('Điều chỉnh sau nhập');
    expect(source).not.toContain('Lifecycle phiếu nhập');
    expect(source).not.toContain('từng source line');
    expect(source).not.toContain('Hủy có audit');
    expect(source).not.toContain('Tạo correction hậu nhập');
    expect(source).not.toContain('source line hoặc version');
  });

  it('names the selected-order receipt table by its business grain', () => {
    expect(source).toContain('caption="Mỗi dòng là một phiếu nhập thuộc đơn mua đang chọn"');
    expect(source).toContain('<th scope="col">Phiếu</th>');
    expect(source).toContain('Chưa có phiếu nhập cần xử lý trong trang này.');
  });

  it('mounts the same bounded workflow shell for loading and ready-empty states', () => {
    const refetch = vi.fn();
    lifecycleMocks.detail.mockReturnValue({ data: undefined, isFetching: false, isError: false, refetch: vi.fn() });
    lifecycleMocks.list.mockReturnValue({ data: undefined, isError: false, isFetching: true, refetch });

    const view = render(createElement(WarehouseReceiptLifecyclePanel, { purchaseOrderId: 'po-1', onSelectReceipt: vi.fn() }));
    const loadingPanel = screen.getByTestId('receipt-lifecycle-panel');
    expect(loadingPanel).toHaveClass('content-start');
    expect(loadingPanel).not.toHaveClass('min-h-[20rem]');
    expect(loadingPanel).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Đang tải phiếu nhập…')).toBeInTheDocument();

    lifecycleMocks.list.mockReturnValue({ data: { items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }, isError: false, isFetching: false, refetch });
    view.rerender(createElement(WarehouseReceiptLifecyclePanel, { purchaseOrderId: 'po-1', onSelectReceipt: vi.fn() }));
    const readyPanel = screen.getByTestId('receipt-lifecycle-panel');
    expect(readyPanel).toHaveClass('content-start');
    expect(readyPanel).not.toHaveClass('min-h-[20rem]');
    expect(readyPanel).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Chưa có phiếu nhập cần xử lý trong trang này.')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });
});
