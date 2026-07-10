import { describe, expect, it } from 'vitest';

import type { PurchasePlanRow } from '@/features/workflow';
import { normalizePurchasePlanGroupBy, summarizePurchasePlan } from './reportPlanning';

const baseRow: PurchasePlanRow = {
  periodKey: '2026-07-06',
  groupBy: 'day',
  periodStart: '2026-07-06',
  periodEnd: '2026-07-06',
  ingredientId: 'ing-1',
  ingredientName: 'Thịt gà',
  unitId: 'unit-1',
  unitName: 'kg',
  requiredQty: 10,
  currentStockQty: 2,
  pendingReceiptQty: 3,
  shortageQty: 5,
  suggestedPurchaseQty: 8,
  estimatedUnitPrice: 1000,
  estimatedAmount: 5000,
  warnings: [],
};

describe('reportPlanning purchase plan helpers', () => {
  it('summarizes shortage and amount for purchase-plan day/week views', () => {
    const summary = summarizePurchasePlan([
      baseRow,
      { ...baseRow, periodKey: '2026-07-07', shortageQty: 0, estimatedAmount: 1200 },
    ]);

    expect(summary).toEqual({
      rowCount: 2,
      totalShortageQty: 5,
      totalEstimatedAmount: 6200,
      shortageTone: 'danger',
    });
  });

  it('uses success tone when pending receipts cover all shortage', () => {
    expect(summarizePurchasePlan([{ ...baseRow, shortageQty: 0 }]).shortageTone).toBe('success');
  });

  it('normalizes unsupported groupBy values back to day', () => {
    expect(normalizePurchasePlanGroupBy('week')).toBe('week');
    expect(normalizePurchasePlanGroupBy('day')).toBe('day');
    expect(normalizePurchasePlanGroupBy('month')).toBe('day');
    expect(normalizePurchasePlanGroupBy(undefined)).toBe('day');
  });
});
