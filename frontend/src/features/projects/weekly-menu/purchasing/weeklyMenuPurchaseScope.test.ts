import { describe, expect, it } from 'vitest';
import weeklyMenuPageSource from '../../pages/WeeklyMenuPage.tsx?raw';
import purchaseSummarySource from './PurchaseSummarySection.tsx?raw';

describe('weekly purchase scope contract', () => {
  it('queries the effective displayed week after a customer auto-loads its committed menu', () => {
    expect(weeklyMenuPageSource).toMatch(/useWeeklyMenuImport\(\{[\s\S]*?weekStartDate: committedMenuWeekStartDate,[\s\S]*?\}\);/);
    expect(weeklyMenuPageSource).toMatch(/usePurchaseSummary\(\{[\s\S]*?weekStartDate: weeklyScheduleScope\.weekStartDate,[\s\S]*?weekLabel: weeklyScheduleScope\.weekLabel/);
    expect(weeklyMenuPageSource).toMatch(/useGetIngredientDemandAggregatePageQuery\(\{[\s\S]*?dateFrom: weeklyScheduleScope\.weekStartDate \|\| undefined,[\s\S]*?dateTo: committedMenu\?\.weekEndDate\?\.split\('T'\)\[0\]/);
  });

  it('renders the ingredient label while retaining the stable identity as the row key', () => {
    expect(purchaseSummarySource).toContain('key={identityKey}');
    expect(purchaseSummarySource).toContain('{data.ingredientName}');
    expect(purchaseSummarySource).toContain('LT cả tuần');
    expect(purchaseSummarySource).toContain('Mỗi dòng thuộc một ngày, khách hàng, đơn giá, nguyên liệu và đơn vị');
    expect(purchaseSummarySource).toContain("label: 'Dòng chưa xuất'");
    expect(purchaseSummarySource).toContain("label: 'Dòng chờ Bếp nhận'");
    expect(purchaseSummarySource).not.toContain("`${presentation.shortageCount} nguyên liệu`");
  });
});
