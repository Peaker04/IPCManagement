import type {
  CreateInventoryIssueLineRequest,
  CurrentStockRow,
  KitchenIssueRow,
} from '../workflowApi';
import type { DemandLine } from '../types';

const QUANTITY_EPSILON = 0.000001;

const lineKey = (ingredientId: string, unitId: string) => `${ingredientId}|${unitId}`;

export interface WarehouseIssueAllocation {
  lines: CreateInventoryIssueLineRequest[];
  remainingLineCount: number;
  fullyCoveredLineCount: number;
}

export const buildWarehouseIssueAllocation = (
  materialRequestId: string,
  warehouseId: string,
  demandLines: DemandLine[],
  stockRows: CurrentStockRow[],
  issuedLines: KitchenIssueRow[],
): WarehouseIssueAllocation => {
  const demandByItem = new Map<string, CreateInventoryIssueLineRequest>();
  for (const line of demandLines) {
    if (
      line.materialRequestId !== materialRequestId
      || !line.ingredientId
      || !line.unitId
      || line.required <= QUANTITY_EPSILON
    ) {
      continue;
    }

    const key = lineKey(line.ingredientId, line.unitId);
    const existing = demandByItem.get(key);
    demandByItem.set(key, {
      ingredientId: line.ingredientId,
      unitId: line.unitId,
      requestedQty: (existing?.requestedQty ?? 0) + line.required,
      issuedQty: (existing?.issuedQty ?? 0) + line.required,
    });
  }

  const issuedByItem = new Map<string, number>();
  for (const line of issuedLines) {
    if (line.materialRequestId !== materialRequestId) continue;
    const key = lineKey(line.ingredientId, line.unitId);
    issuedByItem.set(key, (issuedByItem.get(key) ?? 0) + line.issuedQty);
  }

  const stockByItem = new Map<string, number>();
  for (const row of stockRows) {
    if (row.warehouseId !== warehouseId || row.currentQty <= QUANTITY_EPSILON) continue;
    const key = lineKey(row.ingredientId, row.unitId);
    stockByItem.set(key, (stockByItem.get(key) ?? 0) + row.currentQty);
  }

  const lines: CreateInventoryIssueLineRequest[] = [];
  let remainingLineCount = 0;
  let fullyCoveredLineCount = 0;

  for (const [key, demand] of demandByItem) {
    const remaining = Math.max(demand.requestedQty - (issuedByItem.get(key) ?? 0), 0);
    if (remaining <= QUANTITY_EPSILON) continue;

    remainingLineCount += 1;
    const available = stockByItem.get(key) ?? 0;
    const allocated = Math.min(remaining, available);
    if (allocated <= QUANTITY_EPSILON) continue;

    if (available + QUANTITY_EPSILON >= remaining) fullyCoveredLineCount += 1;
    lines.push({
      ingredientId: demand.ingredientId,
      unitId: demand.unitId,
      requestedQty: allocated,
      issuedQty: allocated,
    });
  }

  return { lines, remainingLineCount, fullyCoveredLineCount };
};
