import { describe, expect, it } from 'vitest';
import type { PurchaseRequestResult, WarehouseDto } from '../workflowApi';
import {
  formatPurchaseRequestCandidate,
  getActionableDraftPurchaseRequests,
  getSelectedReceiptWarehouseId,
  mapPurchasePlanLines,
  mapPurchaseRequestLines,
  mapWarehouseOptions,
} from './purchasingModel';

const makePurchaseRequest = (status: string, id: string): PurchaseRequestResult => ({
  purchaseRequestId: id,
  purchaseRequestCode: `PR-${id}`,
  materialRequestId: `material-${id}`,
  purchaseForDate: '2026-07-20',
  status,
  lines: [{
    purchaseRequestLineId: `line-${id}`,
    materialRequestLineId: `material-line-${id}`,
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
});

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

  it('keeps only actionable DRAFT requests when backend pages contain mixed statuses', () => {
    const emptyDraft = { ...makePurchaseRequest('DRAFT', 'empty'), lines: [] };
    const requests = [
      makePurchaseRequest('SENTTOSUPPLIER', 'submitted'),
      makePurchaseRequest('DRAFT', 'draft'),
      makePurchaseRequest('APPROVED', 'approved'),
      emptyDraft,
    ];

    expect(getActionableDraftPurchaseRequests(requests).map((request) => request.purchaseRequestId))
      .toEqual(['draft']);
  });

  it('uses the dedicated warehouse catalog when it is empty or contains more than 20 warehouses', () => {
    expect(mapWarehouseOptions([])).toEqual([]);

    const warehouses: WarehouseDto[] = Array.from({ length: 205 }, (_, index) => ({
      warehouseId: `warehouse-${index + 1}`,
      warehouseCode: `WH-${index + 1}`,
      warehouseName: `Kho ${index + 1}`,
    }));
    const options = mapWarehouseOptions(warehouses);

    expect(options).toHaveLength(205);
    expect(options[204]).toEqual({ warehouseId: 'warehouse-205', warehouse: 'Kho 205' });
  });

  it('requires an explicit warehouse selection instead of silently using the first catalog item', () => {
    expect(getSelectedReceiptWarehouseId({}, 'order-1')).toBe('');
    expect(getSelectedReceiptWarehouseId({ 'order-1': 'warehouse-25' }, 'order-1')).toBe('warehouse-25');
  });
});
