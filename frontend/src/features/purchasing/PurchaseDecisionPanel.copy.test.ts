import { describe, expect, it } from 'vitest';
import source from './PurchaseDecisionPanel.tsx?raw';

describe('PurchaseDecisionPanel user-facing copy', () => {
  it('shows the actual operational scope and hides technical line identifiers', () => {
    expect(source).toContain('formatShiftName(serviceDate.scope)');
    expect(source).toContain('formatQuantityWithUnit(selectedLine.purchaseQty, selectedLine.unitName)');
    expect(source).toContain('formatUnit(candidate.unitName)');
    expect(source).toContain("serviceDate.scope?.toUpperCase() === 'FULLDAY'");
    expect(source).not.toContain('Mã dòng {selectedLine.purchaseRequestLineId}');
    expect(source).not.toContain('Dữ liệu trạng thái do máy chủ xác định');
  });
});
