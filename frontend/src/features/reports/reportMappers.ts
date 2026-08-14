import type { IngredientDemandAggregateReportDto, StockMovementViewDto } from '@/api/workflowApiTypes';
import type { DemandLine, StockMovement, StockMovementType } from '@/types/workflow';
import { ROUTES } from '@/lib/routeConfig';

export const mapDemandAggregateLine = (item: IngredientDemandAggregateReportDto): DemandLine => {
  const shortage = Math.max(item.unissuedQty, 0);
  const pendingKitchenReceipt = Math.max(item.pendingKitchenReceiptQty, 0);
  const serviceDate = item.requestDate?.split('T')[0];
  const isCancelled = item.hasCancelledLine;
  const kitchenHref = serviceDate ? `${ROUTES.CHEF_DASHBOARD}?date=${serviceDate}` : ROUTES.CHEF_DASHBOARD;
  const purchasingHref = serviceDate ? `${ROUTES.PURCHASING}?date=${serviceDate}` : ROUTES.PURCHASING;

  return {
    id: `aggregate-${serviceDate}-${item.customerId}-${item.priceTierAmount}-${item.ingredientId}-${item.unitId}`,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
    serviceDate,
    priceTierAmount: item.priceTierAmount,
    material: item.ingredientName ?? item.ingredientId,
    required: item.totalRequiredQty,
    available: item.fulfilledQty + pendingKitchenReceipt,
    reserved: 0,
    unit: item.unitName ?? '',
    source: `${item.customerName ?? item.customerCode ?? item.customerId} · ${item.priceTierAmount / 1000}k · ${item.lineCount} dòng nhu cầu`,
    pendingKitchenReceiptQty: pendingKitchenReceipt,
    unissuedQty: shortage,
    status: isCancelled ? 'Cần tính lại nhu cầu' : shortage > 0 ? 'Còn thiếu nguyên liệu' : pendingKitchenReceipt > 0 ? 'Chờ bếp xác nhận' : 'Đã đáp ứng đủ',
    nextAction: isCancelled ? 'Mở nhu cầu để tính lại' : shortage > 0 ? 'Mở thu mua' : pendingKitchenReceipt > 0 ? 'Mở checklist nhận nguyên liệu' : 'Đã hoàn tất',
    actionHref: isCancelled ? ROUTES.WEEKLY_MENU : shortage > 0 ? purchasingHref : pendingKitchenReceipt > 0 ? kitchenHref : undefined,
    tone: isCancelled || pendingKitchenReceipt > 0 ? 'warning' : shortage > 0 ? 'danger' : 'success',
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
