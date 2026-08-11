import { describe, expect, it } from 'vitest';
import source from './WarehouseReceiptLifecyclePanel.tsx?raw';

describe('WarehouseReceiptLifecyclePanel contract', () => {
  it('reloads the canonical receipt read-model before lifecycle actions', () => {
    expect(source).toContain('useGetInventoryReceiptsQuery');
    expect(source).toContain('useGetInventoryReceiptByIdQuery');
    expect(source).toContain("!receipt.purchaseOrderId");
    expect(source).toContain('nguồn đơn mua bất biến');
  });

  it('keeps quality, manager approval, and POST ownership visibly separate', () => {
    expect(source).toContain("useHasRole(['thukho'])");
    expect(source).toContain("useHasRole(['admin'])");
    expect(source).toContain("useHasRole(['dieuphoi'])");
    expect(source).toContain("receipt.status === 'PENDING_APPROVAL'");
    expect(source).toContain('Chỉ Thủ kho được kiểm tra chất lượng.');
    expect(source).toContain('Chỉ Admin được POSTED sau khi Quản lý duyệt.');
  });

  it('requires every rejected quantity to carry a reason and sends the optimistic version', () => {
    expect(source).toContain('rejectedQuantity > 0 && !line.reason');
    expect(source).toContain('expectedVersion: receipt.concurrencyVersion');
    expect(source).toContain("commandId('receipt-quality')");
    expect(source).toContain("commandId('receipt-post')");
    expect(source).toContain("commandId('receipt-rework')");
    expect(source).toContain('Lý do xử lý lại không được để trống.');
  });

  it('offers only Admin an append-only correction after POSTED with source-line quantities and a mandatory reason', () => {
    expect(source).toContain("receipt.status === 'POSTED' && canCorrect");
    expect(source).toContain("commandId('receipt-correction')");
    expect(source).toContain('expectedVersion: 0');
    expect(source).toContain('Lý do correction không được để trống.');
    expect(source).toContain('Receipt và movement POSTED gốc không bị sửa.');
  });

  it('reserves the lifecycle viewport only while receipt data is loading', () => {
    expect(source).toContain('data-testid="receipt-lifecycle-panel"');
    expect(source).toContain("isLifecycleBusy && 'min-h-[48rem]'");
    expect(source).not.toContain("'mt-4 grid min-h-[48rem] content-start gap-3'");
    expect(source).toContain('aria-busy={isLifecycleBusy}');
  });
});
