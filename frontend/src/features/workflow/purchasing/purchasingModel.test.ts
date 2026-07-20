import { describe, expect, it } from 'vitest';
import { formatPurchaseRequestCandidate, mapPurchasePlanLines, mapPurchaseRequestLines } from './purchasingModel';

describe('purchasing model', () => {
  it('maps shortage plans without dropping stock already pending receipt', () => {
    const [line] = mapPurchasePlanLines([{
      periodKey: '2026-07-20',
      periodStart: '2026-07-20',
      ingredientId: 'ingredient-1',
      ingredientName: 'Gạo',
      requiredQty: 100,
      currentStockQty: 25,
      pendingReceiptQty: 15,
      unitName: 'kg',
      supplierName: null,
      estimatedUnitPrice: null,
      shortageQty: 60,
      warnings: [],
    }]);

    expect(line).toMatchObject({ available: 40, status: 'Thiếu hàng', nextAction: 'Đề xuất mua', tone: 'warning' });
    expect(line.estimatedUnitPrice).toBeUndefined();
  });

  it('keeps request identifiers and supplier action semantics for mutations', () => {
    const [line] = mapPurchaseRequestLines([{
      purchaseRequestId: 'request-1',
      purchaseRequestCode: 'PR-001',
      materialRequestId: 'material-1',
      purchaseForDate: '2026-07-20',
      status: 'DRAFT',
      lines: [{
        purchaseRequestLineId: 'line-1',
        materialRequestLineId: 'material-line-1',
        ingredientId: 'ingredient-1',
        ingredientName: 'Gạo',
        supplierId: '',
        supplierName: '',
        unitId: 'unit-1',
        unitName: 'kg',
        requiredQty: 100,
        currentStockQty: 40,
        purchaseQty: 60,
        estimatedUnitPrice: 20_000,
      }],
    }]);

    expect(line).toMatchObject({ purchaseRequestId: 'request-1', purchaseRequestLineId: 'line-1', nextAction: 'Chọn nhà cung cấp' });
  });

  it('labels an existing proposal in the material-request candidate', () => {
    expect(formatPurchaseRequestCandidate({ materialRequestCode: 'MR-001', requestDate: '2026-07-20', actionableLineCount: 3, hasExistingPurchaseRequest: true }))
      .toContain('Đã có đề xuất');
  });
});
