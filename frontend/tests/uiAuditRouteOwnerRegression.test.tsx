import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import recoveryAuthoritySource from '../../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json?raw';
import selectedBaselineSource from '../../.artifacts/phase28-ui-audit/baseline-recovery/attempt-3/evidence/canonical-combined.json?raw';
import weeklyMenuCommandBarSource from '../src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx?raw';
import materialDemandSectionSource from '../src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx?raw';
import purchaseSummarySectionSource from '../src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx?raw';
import quickServingCellSource from '../src/features/projects/weekly-menu/schedule/QuickServingCell.tsx?raw';
import kitchenReceiptSectionSource from '../src/features/chef/receipts/KitchenReceiptSection.tsx?raw';
import stockMovementTableSource from '../src/components/common/StockMovementTable.tsx?raw';
import reportsPageSource from '../src/features/reports/pages/ReportsPage.tsx?raw';
import reportsFiltersSource from '../src/features/reports/pages/ReportsFilters.tsx?raw';
import reportsPricePanelSource from '../src/features/reports/pages/ReportsPricePanel.tsx?raw';
import warehouseMovementPanelSource from '../src/features/warehouse/pages/WarehouseMovementPanel.tsx?raw';
import orderTableSource from '../src/features/coordination/components/order-table.tsx?raw';
import actionToolbarSource from '../src/features/coordination/components/action-toolbar.tsx?raw';
import approvalPageSource from '../src/features/approvals/pages/ApprovalPage.tsx?raw';
import approvalSearchFieldSource from '../src/features/approvals/pages/ApprovalSearchField.tsx?raw';
import approvalQueryPanelsSource from '../src/features/approvals/pages/ApprovalQueryPanels.tsx?raw';
import menuAmendmentSource from '../src/features/approvals/components/MenuAmendmentReconciliation.tsx?raw';
import weeklyHarnessSource from './weekly-menu-production-query.spec.ts?raw';
import chefHarnessSource from './chef-dashboard-production-query.spec.ts?raw';
import reportsHarnessSource from './reports-production-query.spec.ts?raw';
import warehouseHarnessSource from './warehouse-production-query.spec.ts?raw';
import mealOrdersHarnessSource from './meal-orders-production-query.spec.ts?raw';
import approvalsHarnessSource from './approvals-production-query.spec.ts?raw';
import axeEvidenceSource from './uiAuditAxe.ts?raw';

const uiRedesignSource = readFileSync('src/styles/ui-redesign.css', 'utf8');

type Finding = {
  identity: string;
  ruleId: string;
  verdict: string;
  expected?: string;
  actual?: string;
  severity?: string;
  lowestOwner?: string;
};

const exactKey = ({ identity, ruleId, expected, actual, severity, lowestOwner }: Finding) => ({
  identity,
  ruleId,
  expected,
  actual,
  severity,
  lowestOwner,
});
const serialize = (keys: ReturnType<typeof exactKey>[]) => JSON.stringify(
  [...keys].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const routeOwners = new Set([
  'WeeklyMenuPage',
  'ChefDashboardPage',
  'ReportsPage',
  'WarehousePage',
  'CoordinationPage/OrderTable',
  'ApprovalPage',
]);
const adminOwners = new Set(['AdminDataPage', 'ApprovalRulesPage', 'AdvancedDisplaySettings']);
const predecessorOwners = new Set(['DashboardPage', 'LoginPage']);

describe('Phase 28 non-admin route-owner remediation inventory', () => {
  it('reproduces and partitions the exact 28-03 residual authority', async () => {
    const authority = JSON.parse(recoveryAuthoritySource) as { selectedRecovery: { root: string } };
    const baseline = JSON.parse(selectedBaselineSource) as { records: Array<{ findings: Finding[] }> };
    const failures = baseline.records.flatMap(({ findings }) => findings)
      .filter(({ verdict, identity }) => verdict === 'FAIL' && identity.split('|')[0] !== '/purchasing');
    const route = failures.filter(({ lowestOwner }) => routeOwners.has(lowestOwner ?? ''));
    const admin = failures.filter(({ lowestOwner }) => adminOwners.has(lowestOwner ?? ''));
    const predecessor = failures.filter(({ lowestOwner }) => predecessorOwners.has(lowestOwner ?? ''));
    const unknown = failures.filter(({ lowestOwner }) => !routeOwners.has(lowestOwner ?? '') && !adminOwners.has(lowestOwner ?? '') && !predecessorOwners.has(lowestOwner ?? ''));

    expect(authority.selectedRecovery.root).toBe('.artifacts/phase28-ui-audit/baseline-recovery/attempt-3');
    expect(failures).toHaveLength(1_258);
    expect(await sha256(serialize(failures.map(exactKey)))).toBe('b8fa28d6f612c719912c89620a5729b83b0264be4fc8b57aadeb9c2ddc98fa6a');
    expect(route).toHaveLength(1_078);
    expect(predecessor).toHaveLength(28);
    expect(admin).toHaveLength(152);
    expect(unknown).toEqual([]);
    expect(new Set([...route, ...predecessor, ...admin].map((finding) => JSON.stringify(exactKey(finding)))).size).toBe(1_258);
    expect(failures.every(({ identity, expected, actual, severity, lowestOwner }) => identity.split('|').length === 6 && expected && actual && severity && lowestOwner)).toBe(true);
  });

  it('keeps visible-label controls actionable while excluding hidden Base UI internals', () => {
    const harnesses = [weeklyHarnessSource, chefHarnessSource, reportsHarnessSource, warehouseHarnessSource, mealOrdersHarnessSource, approvalsHarnessSource];
    expect(axeEvidenceSource).toContain("getComputedStyle(element, '::placeholder').color");
    expect(axeEvidenceSource).toContain("color === 'rgb(71, 85, 105)'");
    for (const source of harnesses) {
      expect(source).toContain('seriousViolationsWithBrowserPlaceholderEvidence(page, axe.violations)');
      expect(source).toContain("getAttribute('aria-hidden')");
      expect(source).toMatch(/tabIndex\s*!==?\s*-1/);
      expect(source).toContain('.labels');
    }
  });

  it('locks exact selector-proven names, contrast, and local table semantics', () => {
    expect(weeklyMenuCommandBarSource).toContain('aria-label="Chọn khách hàng"');
    expect(materialDemandSectionSource).toContain('is-warning [&>dt]:text-slate-800!');
    expect(quickServingCellSource).toContain('text-center text-slate-700');
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
