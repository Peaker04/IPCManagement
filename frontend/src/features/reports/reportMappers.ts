import type { IngredientDemandAggregateReportDto, StockMovementViewDto } from '@/api/workflowApiTypes';
import type { DemandLine, StockMovement, StockMovementType } from '@/types/workflow';

export const mapDemandAggregateLine = (item: IngredientDemandAggregateReportDto): DemandLine => {
  const shortage = Math.max(item.suggestedPurchaseQty, 0);
  const serviceDate = item.requestDate?.split('T')[0];
  const isCancelled = item.hasCancelledLine;

  return {
    id: `aggregate-${serviceDate}-${item.customerId}-${item.priceTierAmount}-${item.ingredientId}-${item.unitId}`,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
    serviceDate,
    priceTierAmount: item.priceTierAmount,
    material: item.ingredientName ?? item.ingredientId,
    required: item.totalRequiredQty,
    available: item.currentStockQty,
    reserved: 0,
    unit: item.unitName ?? '',
    source: `${item.customerName ?? item.customerCode ?? item.customerId} · ${item.priceTierAmount / 1000}k · ${item.lineCount} dòng nhu cầu`,
    status: isCancelled ? 'Cần tạo lại demand' : shortage > 0 ? 'Thiếu nguyên liệu' : 'Tồn kho đủ',
    nextAction: isCancelled ? 'Tạo lại demand từ KHSX' : shortage > 0 ? 'Đề xuất mua thêm' : 'Tạo phiếu xuất kho',
    tone: isCancelled ? 'warning' : shortage > 0 ? 'danger' : 'success',
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
