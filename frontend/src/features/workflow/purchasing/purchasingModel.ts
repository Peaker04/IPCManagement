import type { DemandLine } from '@/features/workflow';
import type { PurchaseRequestResult } from '../workflowApi';

export const getPurchasingErrorMessage = (error: unknown) =>
  (error as { data?: { message?: string }; message?: string })?.data?.message ??
  (error as { message?: string })?.message ??
  'Đã xảy ra lỗi không xác định.';

export function mapPurchasePlanLines(
  rows: Array<{
    periodKey: string;
    periodStart: string;
    ingredientId: string;
    ingredientName?: string | null;
    requiredQty: number;
    currentStockQty: number;
    pendingReceiptQty: number;
    unitName?: string | null;
    supplierName?: string | null;
    estimatedUnitPrice?: number | null;
    shortageQty: number;
    warnings: string[];
  }>,
): DemandLine[] {
  return rows.map((row) => ({
    id: `${row.periodKey}-${row.ingredientId}`,
    ingredientId: row.ingredientId,
    sourceDocumentCode: row.periodKey,
    serviceDate: row.periodStart,
    material: row.ingredientName ?? row.ingredientId,
    required: row.requiredQty,
    available: row.currentStockQty + row.pendingReceiptQty,
    reserved: 0,
    unit: row.unitName ?? '',
    source: row.supplierName ?? 'Chưa có nhà cung cấp',
    estimatedUnitPrice: row.estimatedUnitPrice ?? undefined,
    status: row.warnings.length > 0 ? row.warnings.join(', ') : row.shortageQty > 0 ? 'Thiếu hàng' : 'Đủ hàng',
    nextAction: row.shortageQty > 0 ? 'Đề xuất mua' : 'Không cần mua',
    tone: row.warnings.length > 0 ? 'danger' : row.shortageQty > 0 ? 'warning' : 'success',
  }));
}

export function mapPurchaseRequestLines(requests: PurchaseRequestResult[]): DemandLine[] {
  return requests.flatMap((request) =>
    request.lines.map((line) => ({
      id: line.purchaseRequestLineId,
      materialRequestId: request.materialRequestId,
      purchaseRequestId: request.purchaseRequestId,
      purchaseRequestLineId: line.purchaseRequestLineId,
      supplierId: line.supplierId,
      ingredientId: line.ingredientId,
      estimatedUnitPrice: line.estimatedUnitPrice,
      expectedDeliveryDate: line.expectedDeliveryDate,
      note: line.note,
      sourceDocumentCode: request.purchaseRequestCode,
      serviceDate: request.purchaseForDate,
      material: line.ingredientName,
      required: line.requiredQty,
      available: line.currentStockQty,
      reserved: line.purchaseQty,
      unit: line.unitName,
      source: line.supplierName || 'Chưa chọn nhà cung cấp',
      status: request.status,
      nextAction: request.status === 'APPROVED' ? 'Tạo đơn mua hàng' : request.status === 'DRAFT' ? 'Chọn nhà cung cấp' : 'Theo dõi đơn mua',
      tone: request.status === 'APPROVED' ? 'success' : request.status === 'SUBMITTED' ? 'warning' : 'neutral',
    })),
  );
}

export function formatPurchaseRequestCandidate(candidate: {
  materialRequestCode: string;
  requestDate: string;
  actionableLineCount: number;
  hasExistingPurchaseRequest: boolean;
}) {
  return `${candidate.materialRequestCode} | ${candidate.requestDate} | ${candidate.actionableLineCount} dòng thiếu${candidate.hasExistingPurchaseRequest ? ' | Đã có đề xuất' : ''}`;
}
