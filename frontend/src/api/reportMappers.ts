import type { IngredientDemandAggregateReportDto, StockMovementViewDto } from '@/api/workflowApiTypes';
import type { DemandLine, StockMovement, StockMovementType } from '@/types/workflow';

export const mapDemandAggregateLine = (item: IngredientDemandAggregateReportDto): DemandLine => {
  const shortage = Math.max(item.remainingToIssueQty, 0);
  const pendingKitchenReceipt = Math.max(item.issuedQty - item.receivedByKitchenQty, 0);
  const serviceDate = item.requestDate?.split('T')[0];
  const isCancelled = item.hasCancelledLine;

  return {
    id: `aggregate-${serviceDate}-${item.customerId}-${item.priceTierAmount}-${item.ingredientId}-${item.unitId}`,
    projection: 'physical-handoff',
    customerId: item.customerId,
    historicalAllocatedQty: item.currentStockQty,
    issuedQty: item.issuedQty,
    receivedByKitchenQty: item.receivedByKitchenQty,
    remainingToIssueQty: shortage,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
    serviceDate,
    priceTierAmount: item.priceTierAmount,
    material: item.ingredientName ?? item.ingredientId,
    required: item.totalRequiredQty,
    available: item.issuedQty,
    reserved: 0,
    unit: item.unitName ?? '',
    source: `${item.customerName ?? item.customerCode ?? item.customerId} · ${item.priceTierAmount / 1000}k · ${item.lineCount} dòng nhu cầu`,
    pendingKitchenReceiptQty: pendingKitchenReceipt,
    unissuedQty: shortage,
    status: isCancelled ? 'Cần tính lại nhu cầu' : shortage > 0 ? 'Chưa xuất' : pendingKitchenReceipt > 0 ? 'Chờ bếp xác nhận' : 'Bếp đã nhận',
    // Aggregates have no exact command-source identity or purchase eligibility.
    // Keep scope in the row; hand off to the actor, never invent a destination.
    nextAction: isCancelled ? 'Điều phối tính lại' : shortage > 0 ? 'Kho xử lý xuất' : pendingKitchenReceipt > 0 ? 'Bếp xác nhận nhận' : 'Theo dõi chứng từ',
    tone: isCancelled || pendingKitchenReceipt > 0 || shortage > 0 ? 'warning' : 'success',
  };
};

export const mapStockMovement = (item: StockMovementViewDto): StockMovement => {
  const movementType = item.movementType.toUpperCase();
  const type: StockMovementType =
    movementType === 'RECEIPT'
      ? 'receipt'
      : movementType === 'ISSUE'
        ? 'issue'
        : movementType === 'RETURN'
          ? 'return'
          : 'adjustment';
  const isReceivedByKitchen = type === 'issue' && item.kitchenReceiptStatus === 'RECEIVED';
  const quantity = type === 'issue' ? item.quantityOut : item.quantityIn;
  const tone = isReceivedByKitchen || type === 'adjustment' || type === 'return' ? 'success' : 'warning';

  return {
    id: item.movementId,
    type,
    documentNo: item.refTable ? `${item.refTable}${item.refId ? `-${item.refId.slice(0, 8)}` : ''}` : item.movementId.slice(0, 8),
    material: item.ingredientName ?? item.ingredientId,
    quantity,
    beforeQty: item.beforeQty,
    afterQty: item.afterQty,
    unit: item.unitName ?? '',
    owner: item.warehouseName ?? 'Kho',
    status: type === 'receipt' ? 'Đã nhập kho' : isReceivedByKitchen ? 'Bếp đã nhận' : type === 'issue' ? 'Đã xuất kho' : type === 'return' ? 'Đã hoàn kho' : 'Đã điều chỉnh tồn',
    nextAction: type === 'issue' ? isReceivedByKitchen ? 'Đã hoàn tất' : 'Bếp xác nhận nhận nguyên liệu' : 'Cập nhật tồn kho',
    tone,
  };
};
