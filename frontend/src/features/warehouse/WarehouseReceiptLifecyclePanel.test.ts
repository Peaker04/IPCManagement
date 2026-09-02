import { describe, expect, it } from 'vitest';
import source from './WarehouseReceiptLifecyclePanel.tsx?raw';

describe('WarehouseReceiptLifecyclePanel contract', () => {
  it('reloads the canonical receipt read-model before lifecycle actions', () => {
    expect(source).toContain('useGetInventoryReceiptsQuery');
    expect(source).toContain('useGetInventoryReceiptByIdQuery');
    expect(source).toContain("!receipt.purchaseOrderId");
    expect(source).toContain('đơn mua gốc');
  });

  it('pages receipt headers and keeps detail selection inside the active page', () => {
    expect(source).toContain('useGetInventoryReceiptsQuery({ pageNumber: receiptPageNumber, pageSize: RECEIPT_PAGE_SIZE })');
    expect(source).toContain('canonicalReceipts.some((item) => item.receiptId === selectedReceiptId)');
    expect(source).toContain('totalItems={receiptPage?.totalCount ?? 0}');
    expect(source).toContain('setSelectedReceiptId(undefined)');
    expect(source).not.toContain('useGetInventoryReceiptsQuery({ pageNumber: 1, pageSize: 20 })');
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
    expect(source).toContain("commandId('receipt-quality')");
    expect(source).toContain("commandId('receipt-post')");
    expect(source).toContain("commandId('receipt-rework')");
    expect(source).toContain('Lý do xử lý lại không được để trống.');
    expect(source.match(/maximumFractionDigits: 6/g)).toHaveLength(3);
  });

  it('offers only Admin an append-only correction after POSTED with source-line quantities and a mandatory reason', () => {
    expect(source).toContain("receipt.status === 'POSTED' && canCorrect");
    expect(source).toContain("commandId('receipt-correction')");
    expect(source).toContain('expectedVersion: 0');
    expect(source).toContain('Lý do điều chỉnh không được để trống.');
    expect(source).toContain('không sửa phiếu nhập hoặc bút toán gốc');
    expect(source).toContain('Ghi sổ chứng từ điều chỉnh');
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

  it('keeps a stable lifecycle footprint across loading and ready states', () => {
    expect(source).toContain('data-testid="receipt-lifecycle-panel"');
    expect(source).toContain("'mt-4 grid min-h-[20rem] content-start gap-3'");
    expect(source).not.toContain("isLifecycleBusy && 'min-h-[48rem]'");
    expect(source).toContain('aria-busy={isLifecycleBusy}');
  });
});
