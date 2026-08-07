import { describe, expect, it } from 'vitest';
import { mapStockMovement } from './reportMappers';

const issue = (kitchenReceiptStatus: string | null) => ({
  movementId: 'movement-1',
  movementDate: '2026-08-05T08:00:00Z',
  warehouseId: 'warehouse-1',
  warehouseName: 'Kho chính',
  ingredientId: 'ingredient-1',
  ingredientName: 'Gạo',
  unitId: 'unit-1',
  unitName: 'kg',
  movementType: 'ISSUE',
  quantityIn: 0,
  quantityOut: 10,
  beforeQty: 20,
  afterQty: 10,
  refTable: 'inventoryissues',
  refId: 'issue-1',
  reason: null,
  note: null,
  kitchenReceiptStatus,
});

describe('stock movement presentation', () => {
  it('marks an issue as complete only after the kitchen receipt is projected by the API', () => {
    expect(mapStockMovement(issue('RECEIVED'))).toMatchObject({
      status: 'Bếp đã nhận',
      nextAction: 'Đã hoàn tất',
      tone: 'success',
    });

    expect(mapStockMovement(issue('PENDING'))).toMatchObject({
      status: 'Đã xuất kho',
      nextAction: 'Bếp xác nhận nhận nguyên liệu',
      tone: 'warning',
    });
  });
});
