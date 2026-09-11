import type {
  CreateInventoryIssueLineRequest,
  CurrentStockRow,
  KitchenIssueRow,
} from '@/api/workflowApiTypes';
import type { DemandLine } from '@/types/workflow';
import { formatDateOnly } from '@/lib/formatters';

const QUANTITY_EPSILON = 0.000001;

const lineKey = (ingredientId: string, unitId: string) => `${ingredientId}|${unitId}`;

export const formatIssueCandidateLabel = (candidate: {
  requestDate: string;
  actionableLineCount: number;
  materialRequestCode: string;
  customerName?: string;
  customerCode?: string;
}) => `${candidate.customerName || 'Khách hàng chưa xác định'}${candidate.customerCode ? ` (${candidate.customerCode})` : ''} · Ngày ${formatDateOnly(candidate.requestDate)} · ${candidate.actionableLineCount} nhóm nguyên liệu · Chứng từ ${candidate.materialRequestCode}`;

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
  const demandLinesForRequest = demandLines.filter((line) => (
    line.materialRequestId === materialRequestId
    && line.ingredientId
    && line.unitId
    && line.required > QUANTITY_EPSILON
  ));

  // Keep the source-line grain until the command boundary. A material request can
  // legitimately repeat one ingredient/unit across several source lines; the API
  // must receive the exact line ID so it can enforce provenance and remaining qty.
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

  for (const line of demandLinesForRequest) {
    const key = lineKey(line.ingredientId!, line.unitId!);
    const previouslyIssued = issuedByItem.get(key) ?? 0;
    const alreadyAppliedToEarlierSource = Math.min(previouslyIssued, line.required);
    issuedByItem.set(key, Math.max(previouslyIssued - alreadyAppliedToEarlierSource, 0));
    const remaining = Math.max(line.required - alreadyAppliedToEarlierSource, 0);
    if (remaining <= QUANTITY_EPSILON) continue;

    remainingLineCount += 1;
    const available = stockByItem.get(key) ?? 0;
    const allocated = Math.min(remaining, available);
    if (allocated <= QUANTITY_EPSILON) continue;

    if (available + QUANTITY_EPSILON >= remaining) fullyCoveredLineCount += 1;
    stockByItem.set(key, Math.max(available - allocated, 0));
    lines.push({
      materialRequestLineId: line.id,
      ingredientId: line.ingredientId!,
      unitId: line.unitId!,
      requestedQty: allocated,
      issuedQty: allocated,
    });
  }

  return { lines, remainingLineCount, fullyCoveredLineCount };
};
