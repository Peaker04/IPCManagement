import type { PurchasePlanRow } from '@/features/workflow';

export type PurchasePlanSummary = {
  rowCount: number;
  totalShortageQty: number;
  totalEstimatedAmount: number;
  shortageTone: 'success' | 'danger';
};

export function summarizePurchasePlan(rows: PurchasePlanRow[]): PurchasePlanSummary {
  const totalShortageQty = rows.reduce((sum, row) => sum + row.shortageQty, 0);
  return {
    rowCount: rows.length,
    totalShortageQty,
    totalEstimatedAmount: rows.reduce((sum, row) => sum + row.estimatedAmount, 0),
    shortageTone: totalShortageQty > 0 ? 'danger' : 'success',
  };
}

export function normalizePurchasePlanGroupBy(value: string | null | undefined): 'day' | 'week' {
  return value === 'week' ? 'week' : 'day';
}
