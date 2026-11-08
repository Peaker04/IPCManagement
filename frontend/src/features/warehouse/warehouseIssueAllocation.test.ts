import { describe, expect, it } from 'vitest';
import type { DemandLine } from '@/types/workflow';
import type { CurrentStockRow, KitchenIssueRow } from '@/api/workflowApi';
import { buildWarehouseIssueAllocation } from './warehouseIssueAllocation';

const demand = (ingredientId: string, required: number): DemandLine => ({
  id: `demand-${ingredientId}`,
  materialRequestId: 'request-1',
  ingredientId,
  unitId: 'kg',
  material: ingredientId,
  required,
  available: 0,
  reserved: 0,
  unit: 'KG',
  source: 'ANV',
  status: 'Đủ dữ liệu',
  nextAction: 'Xuất kho',
  tone: 'success',
});

const demandLine = (id: string, ingredientId: string, required: number): DemandLine => ({
  ...demand(ingredientId, required),
  id,
});

const stock = (warehouseId: string, ingredientId: string, currentQty: number): CurrentStockRow => ({
  id: `${warehouseId}-${ingredientId}`,
  warehouseId,
  warehouse: warehouseId,
  ingredientId,
  ingredient: ingredientId,
  unitId: 'kg',
  unit: 'KG',
  currentQty,
  lastUpdated: '2026-07-20T00:00:00Z',
});

const issued = (ingredientId: string, issuedQty: number): KitchenIssueRow => ({
  id: `issue-${ingredientId}`,
  issueId: 'issue-1',
  issueCode: 'ISS-1',
  issueDate: '2026-07-20',
  warehouseId: 'warehouse-a',
  warehouse: 'Kho A',
  materialRequestId: 'request-1',
  ingredientId,
  ingredient: ingredientId,
  unitId: 'kg',
  unit: 'KG',
  requestedQty: issuedQty,
  issuedQty,
  isReceivedByKitchen: true,
  receiptStatus: 'Bếp đã nhận',
});

describe('buildWarehouseIssueAllocation', () => {
  it('only allocates remaining demand available in the selected warehouse', () => {
    const result = buildWarehouseIssueAllocation(
      'request-1',
      'warehouse-b',
      [demand('tomato', 10), demand('fish', 6)],
      [stock('warehouse-a', 'tomato', 100), stock('warehouse-b', 'fish', 6)],
      [],
    );

    expect(result).toEqual({
      remainingLineCount: 2,
      fullyCoveredLineCount: 1,
      lines: [{ materialRequestLineId: 'demand-fish', ingredientId: 'fish', unitId: 'kg', requestedQty: 6, issuedQty: 6 }],
    });
  });

  it('subtracts quantities already issued for the same material request', () => {
    const result = buildWarehouseIssueAllocation(
      'request-1',
      'warehouse-b',
      [demand('tomato', 10)],
      [stock('warehouse-b', 'tomato', 20)],
      [issued('tomato', 4)],
    );

    expect(result.lines).toEqual([
      { materialRequestLineId: 'demand-tomato', ingredientId: 'tomato', unitId: 'kg', requestedQty: 6, issuedQty: 6 },
    ]);
    expect(result.remainingLineCount).toBe(1);
    expect(result.fullyCoveredLineCount).toBe(1);
  });

  it('limits a partial issue to stock without exceeding remaining demand', () => {
    const result = buildWarehouseIssueAllocation(
      'request-1',
      'warehouse-b',
      [demand('tomato', 10)],
      [stock('warehouse-b', 'tomato', 3)],
      [],
    );

    expect(result.lines[0]).toMatchObject({ requestedQty: 3, issuedQty: 3 });
    expect(result.fullyCoveredLineCount).toBe(0);
  });

  it('preserves each source line when one ingredient and unit occur more than once', () => {
    const result = buildWarehouseIssueAllocation(
      'request-1',
      'warehouse-b',
      [demandLine('source-a', 'tomato', 2), demandLine('source-b', 'tomato', 3)],
      [stock('warehouse-b', 'tomato', 5)],
      [],
    );

    expect(result.lines).toEqual([
      { materialRequestLineId: 'source-a', ingredientId: 'tomato', unitId: 'kg', requestedQty: 2, issuedQty: 2 },
      { materialRequestLineId: 'source-b', ingredientId: 'tomato', unitId: 'kg', requestedQty: 3, issuedQty: 3 },
    ]);
  });
});
