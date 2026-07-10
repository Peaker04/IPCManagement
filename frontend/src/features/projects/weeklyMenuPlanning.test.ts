import { describe, expect, it } from 'vitest';

import {
  buildProductionDisplayDayByDate,
  buildProductionPlanPages,
  filterProductionPlansForSelection,
  formatBomTierLabel,
  getSafeProductionPlanPageIndex,
  isBomPriceTier,
  normalizeBomPriceTier,
} from './weeklyMenuPlanning';

type TestPlan = {
  planDate: string;
  planCode: string;
  lines: Array<{ totalServings?: number | null }>;
};

const plans: TestPlan[] = [
  { planDate: '2026-06-18T00:00:00', planCode: 'OLD', lines: [{ totalServings: 100 }] },
  { planDate: '2026-07-06T00:00:00', planCode: 'MON', lines: [{ totalServings: 120 }] },
  { planDate: '2026-07-07T00:00:00', planCode: 'TUE-A', lines: [{ totalServings: 200 }, { totalServings: null }] },
  { planDate: '2026-07-07T12:00:00', planCode: 'TUE-B', lines: [{ totalServings: 300 }] },
];

describe('weeklyMenuPlanning BOM tiers', () => {
  it('accepts only fixed BOM tiers and does not infer nearby prices', () => {
    expect(isBomPriceTier(25000)).toBe(true);
    expect(isBomPriceTier(30000)).toBe(true);
    expect(isBomPriceTier(34000)).toBe(true);
    expect(isBomPriceTier(26000)).toBe(false);
  });

  it('normalizes missing or invalid prices to the default fixed tier', () => {
    expect(normalizeBomPriceTier(undefined)).toBe(25000);
    expect(normalizeBomPriceTier(null)).toBe(25000);
    expect(normalizeBomPriceTier(34000.4)).toBe(34000);
    expect(normalizeBomPriceTier(26000)).toBe(25000);
  });

  it('formats fixed tier labels for dense UI display', () => {
    expect(formatBomTierLabel(25000)).toBe('25k');
    expect(formatBomTierLabel(34000)).toBe('34k');
  });
});

describe('weeklyMenuPlanning production pages', () => {
  it('filters week view to the displayed week so older plans cannot leak into pagination', () => {
    const result = filterProductionPlansForSelection(plans, ['2026-07-06', '2026-07-07']);

    expect(result.map((plan) => plan.planCode)).toEqual(['MON', 'TUE-A', 'TUE-B']);
  });

  it('uses selected service date as a lazy-loading day filter', () => {
    const result = filterProductionPlansForSelection(plans, ['2026-07-06', '2026-07-07'], '2026-07-07');

    expect(result.map((plan) => plan.planCode)).toEqual(['TUE-A', 'TUE-B']);
  });

  it('groups plans by service date and totals lines and servings', () => {
    const displayMap = buildProductionDisplayDayByDate(
      [
        { label: 'Thứ Hai', date: '06/07/2026' },
        { label: 'Thứ Ba', date: '07/07/2026' },
      ],
      (date) => {
        const [day, month, year] = date.split('/');
        return `${year}-${month}-${day}`;
      },
    );
    const filtered = filterProductionPlansForSelection(plans, ['2026-07-06', '2026-07-07']);

    const pages = buildProductionPlanPages(filtered, displayMap);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      key: '2026-07-06',
      label: 'Thứ Hai',
      totalLines: 1,
      totalServings: 120,
    });
    expect(pages[1]).toMatchObject({
      key: '2026-07-07',
      label: 'Thứ Ba',
      totalLines: 3,
      totalServings: 500,
    });
  });

  it('clamps page index when page count changes after filtering', () => {
    expect(getSafeProductionPlanPageIndex(0, 4)).toBe(0);
    expect(getSafeProductionPlanPageIndex(3, 4)).toBe(2);
    expect(getSafeProductionPlanPageIndex(3, 1)).toBe(1);
  });
});
