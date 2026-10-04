import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import weeklyMenuCommandBarSource from '../src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx?raw';
import materialDemandSectionSource from '../src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx?raw';
import quickServingCellSource from '../src/features/projects/weekly-menu/schedule/QuickServingCell.tsx?raw';
import kitchenReceiptSectionSource from '../src/features/chef/receipts/KitchenReceiptSection.tsx?raw';
import stockMovementTableSource from '../src/components/common/StockMovementTable.tsx?raw';
import reportsPricePanelSource from '../src/features/reports/pages/ReportsPricePanel.tsx?raw';
import orderTableSource from '../src/features/coordination/components/order-table.tsx?raw';
import actionToolbarSource from '../src/features/coordination/components/action-toolbar.tsx?raw';
import approvalPageSource from '../src/features/approvals/pages/ApprovalPage.tsx?raw';
import approvalQueryPanelsSource from '../src/features/approvals/pages/ApprovalQueryPanels.tsx?raw';
import menuAmendmentSource from '../src/features/approvals/components/MenuAmendmentReconciliation.tsx?raw';
import weeklyHarnessSource from './browser/weekly-menu-production-query.spec.ts?raw';
import chefHarnessSource from './browser/chef-dashboard-production-query.spec.ts?raw';
import reportsHarnessSource from './browser/reports-production-query.spec.ts?raw';
import warehouseHarnessSource from './browser/warehouse-production-query.spec.ts?raw';
import mealOrdersHarnessSource from './browser/meal-orders-production-query.spec.ts?raw';
import approvalsHarnessSource from './browser/approvals-production-query.spec.ts?raw';
import axeEvidenceSource from './uiAuditAxe.ts?raw';

const uiRedesignSource = readFileSync('src/styles/ui-redesign.css', 'utf8');

describe('Route accessibility regression contracts', () => {
  it('keeps visible-label controls actionable while excluding hidden Base UI internals', () => {
    const harnesses = [weeklyHarnessSource, chefHarnessSource, reportsHarnessSource, warehouseHarnessSource, mealOrdersHarnessSource, approvalsHarnessSource];
    expect(axeEvidenceSource).toContain("violation.impact === 'serious' || violation.impact === 'critical'");
    expect(axeEvidenceSource).not.toContain("getComputedStyle(element, '::placeholder')");
    for (const source of harnesses) {
      expect(source).toContain('seriousViolationsWithBrowserPlaceholderEvidence(page, axe.violations)');
      expect(source).toContain("getAttribute('aria-hidden')");
      expect(source).toMatch(/tabIndex\s*!==?\s*-1/);
      expect(source).toContain('.labels');
    }
  });

  it('locks exact selector-proven names, contrast, and local table semantics', () => {
    expect(weeklyMenuCommandBarSource).toContain('aria-label="Khách hàng"');
    expect(materialDemandSectionSource).toContain('is-warning [&>dt]:text-slate-800!');
    expect(quickServingCellSource).toContain('text-center text-sm text-slate-700');
    expect(uiRedesignSource).toContain('#report-filter-from');
    expect(uiRedesignSource).toContain('#coordination-order-search');
    expect(uiRedesignSource).toContain('color: #475569 !important');
    expect(kitchenReceiptSectionSource).toContain('[&_.text-slate-500]:text-slate-700!');
    expect(stockMovementTableSource).not.toContain('text-xs text-slate-400 font-sans font-normal');
    expect(reportsPricePanelSource).not.toContain('text-xs font-normal text-slate-400');
    expect(reportsPricePanelSource).toContain('scrollLabel="Hàng đợi cảnh báo giá có thể cuộn"');
    expect(actionToolbarSource).toContain('role="group" aria-label="Thao tác điều phối"');
    expect(orderTableSource).not.toContain('mt-0.5 text-xs text-slate-400');
    expect(menuAmendmentSource).not.toContain('mt-3 text-sm text-slate-500');
    expect(approvalQueryPanelsSource).not.toContain('text-slate-500 text-xs');
    expect(approvalPageSource).not.toContain('ml-2 text-xs text-slate-400');
    expect(approvalPageSource).not.toContain('text-center text-slate-400');
  });
});
