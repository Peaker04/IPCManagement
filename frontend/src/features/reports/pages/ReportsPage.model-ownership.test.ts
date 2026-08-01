import { describe, expect, it } from 'vitest';
import facadeSource from './useReportsPageModel.ts?raw';
import sharedSource from './reportsPageModelShared.ts?raw';
import auditQualitySource from './useReportsAuditQualityViewModel.ts?raw';
import demandPurchaseSource from './useReportsDemandPurchaseViewModel.ts?raw';
import kitchenUsageSource from './useReportsKitchenUsageViewModel.ts?raw';
import priceSource from './useReportsPriceViewModel.ts?raw';
import stockMovementSource from './useReportsStockMovementViewModel.ts?raw';

const viewModelSources = [
  priceSource,
  demandPurchaseSource,
  stockMovementSource,
  kitchenUsageSource,
  auditQualitySource,
].join('\n');

describe('Reports page-model ownership contract', () => {
  it('composes the five report-view models unconditionally in query order', () => {
    const calls = facadeSource.match(/useReports(?:Price|DemandPurchase|StockMovement|KitchenUsage|AuditQuality)ViewModel\(/g);
    expect(calls).toEqual([
      'useReportsPriceViewModel(',
      'useReportsDemandPurchaseViewModel(',
      'useReportsStockMovementViewModel(',
      'useReportsKitchenUsageViewModel(',
      'useReportsAuditQualityViewModel(',
    ]);
  });

  it('keeps all twelve report queries behind the shared QueryView adapter', () => {
    expect(viewModelSources.match(/toReportView\(/g)).toHaveLength(12);
    expect(sharedSource).toContain('Mở báo cáo ${label} để tải dữ liệu.');
    expect(sharedSource).toContain('Bạn không có quyền xem báo cáo ${label}.');
  });

  it('keeps hidden views and price subviews skipped with the exact predicates', () => {
    expect(priceSource).toContain("{ skip: activeView !== 'price' || priceSubView !== 'lines' }");
    expect(priceSource).toContain("{ skip: activeView !== 'price' || priceSubView !== 'supplier' }");
    expect(demandPurchaseSource).toContain("{ skip: activeView !== 'purchase' }");
    expect(stockMovementSource).toContain("{ skip: activeView !== 'movement' }");
    expect(auditQualitySource).toContain("{ skip: activeView !== 'data-quality' }");
  });

  it('defers the two Reports server searches while preserving their 300 ms request debounce', () => {
    expect(auditQualitySource).toContain('const deferredDataQualitySearch = useDeferredValue(debouncedDataQualitySearch);');
    expect(auditQualitySource).toContain('searchKeyword: deferredDataQualitySearch || undefined');
    expect(auditQualitySource).toContain('setDataQualityPage(1);');
    expect(priceSource).toContain('const deferredPriceSearch = useDeferredValue(debouncedPriceSearch);');
    expect(priceSource).toContain('searchKeyword: deferredPriceSearch || undefined');
    expect(priceSource).toContain('setPricePage(1);');
    expect(auditQualitySource).toContain('globalThis.setTimeout')
    expect(priceSource).toContain('globalThis.setTimeout')
  });

  it('retains the public compatibility model type', () => {
    expect(facadeSource).toContain('export type ReportsPageModel = ReturnType<typeof useReportsPageModel>');
  });
});
