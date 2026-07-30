import type { IngredientDemandAggregateReportDto } from '@/api/workflowApiTypes';
import type { DemandLine } from '@/types/workflow';

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
