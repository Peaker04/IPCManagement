import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import weeklyMenuPageSource from '../src/features/projects/pages/WeeklyMenuPage.tsx?raw';
import weeklyMenuViewContentSource from '../src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx?raw';
import purchasingPageSource from '../src/features/purchasing/pages/PurchasingPage.tsx?raw';
import warehousePageSource from '../src/features/warehouse/pages/WarehousePage.tsx?raw';

const eagerOwners = [
  { source: weeklyMenuPageSource, importPath: '../weekly-menu/shell/WeeklyMenuReadiness', exportName: 'WeeklyMenuReadiness' },
  { source: purchasingPageSource, importPath: '@/components/common/ServiceRunBlockerPanel', exportName: 'ServiceRunBlockerPanel' },
  { source: purchasingPageSource, importPath: '../PurchaseWorkflowGuide', exportName: 'PurchaseWorkflowGuide' },
  { source: warehousePageSource, importPath: './WarehouseMovementPanel', exportName: 'WarehouseMovementPanel' },
  { source: warehousePageSource, importPath: '@/components/common/ServiceRunBlockerPanel', exportName: 'ServiceRunBlockerPanel' },
  { source: warehousePageSource, importPath: '../WarehouseReceiptLifecyclePanel', exportName: 'WarehouseReceiptLifecyclePanel' },
] as const;

const expectEagerOwner = ({ source, importPath, exportName }: (typeof eagerOwners)[number]) => {
  expect(source).toContain(`import { ${exportName} } from '${importPath}';`);
  expect(source).not.toContain(`lazy(() => import('${importPath}')`);
  expect(source).not.toContain(`import('${importPath}')`);
};

describe('critical route initial ownership', () => {
  it('keeps the weekly-menu command bar and selected schedule content eager without critical skeletons', () => {
    expect(weeklyMenuPageSource).toContain("import { WeeklyMenuCommandBar } from '../weekly-menu/shell/WeeklyMenuCommandBar';");
    expect(weeklyMenuPageSource).toContain("import { WeeklyMenuViewContent } from '../weekly-menu/shell/WeeklyMenuViewContent';");
    expect(weeklyMenuPageSource).not.toContain("lazy(() => import('../weekly-menu/shell/WeeklyMenuCommandBar')");
    expect(weeklyMenuPageSource).not.toContain("lazy(() => import('../weekly-menu/shell/WeeklyMenuViewContent')");
    expect(weeklyMenuViewContentSource).toContain("import { WeeklyScheduleSection } from '../schedule/WeeklyScheduleSection';");
    expect(weeklyMenuViewContentSource).not.toContain("lazy(() => import('../schedule/WeeklyScheduleSection')");
  });

  it('keeps every default or unconditional renderer in the eager route closure', () => {
    eagerOwners.forEach(expectEagerOwner);
  });

  it('keeps the purchasing decision owner mounted eagerly while inactive tabs retain query isolation', () => {
    expect(purchasingPageSource).toContain("import { PurchaseDecisionPanel } from '../PurchaseDecisionPanel';");
    expect(purchasingPageSource).not.toContain("lazy(() => import('../PurchaseDecisionPanel')");
    expect(purchasingPageSource).toContain("{ skip: activeView !== 'workflow' }");
    expect(purchasingPageSource).toContain("useSupplierQuotations(activeView === 'quotations')");
    expect(purchasingPageSource).toContain("activeView === 'quotations' ? (");
  });

  it('pairs every active query with an eager renderer and keeps only inactive or user-opened owners lazy', () => {
    expect(warehousePageSource).toContain("{ skip: activeView !== 'movement' }");
    expect(warehousePageSource).toContain("<KeepAliveTabPanel id=\"warehouse-movement\" active={activeView === 'movement'}");
    expect(purchasingPageSource).toContain("{ skip: activeView !== 'workflow' }");
    expect(purchasingPageSource).toContain("activeView === 'workflow' ? (");

    expect(warehousePageSource).toContain("const WarehousePurchaseReceiptDialog = lazy(() => import('../WarehousePurchaseReceiptDialog')");
    expect(warehousePageSource).toContain("const WarehouseBatchPurchaseReceiptDialog = lazy(() => import('../WarehouseBatchPurchaseReceiptDialog')");
    expect(warehousePageSource).toContain("const WarehouseDemandPanel = lazy(() => import('../WarehouseDemandPanel')");
    expect(warehousePageSource).toContain("const WarehouseExceptionsWorkbench = lazy(() => import('../WarehouseExceptionsWorkbench')");
    expect(purchasingPageSource).toContain("const SupplementalPurchasingWorkbench = lazy(() => import('../SupplementalPurchasingWorkbench')");
    expect(purchasingPageSource).toContain("const SupplierQuotationSection = lazy(() => import('../quotation/SupplierQuotationSection')");
    expect(weeklyMenuPageSource).toContain("const WeeklyMenuImportDialog = lazy(() => import('../weekly-menu/import/WeeklyMenuImportDialog')");
    expect(weeklyMenuPageSource).toContain("const WeeklyScheduleEditorDialog = lazy(() => import('../weekly-menu/schedule/WeeklyScheduleEditorDialog')");
  });

  it('keeps purchase orders mounted eagerly while inactive warehouse queries stay skipped', () => {
    expect(warehousePageSource).toContain("import { WarehousePurchaseOrdersPanel } from './WarehousePurchaseOrdersPanel';");
    expect(warehousePageSource).not.toContain("lazy(() => import('./WarehousePurchaseOrdersPanel')");
    expect(warehousePageSource).toContain("{ skip: activeView !== 'demand' }");
    expect(warehousePageSource).toContain("{ skip: activeView !== 'movement' }");
  });

  it('does not publish eager owners as dynamic manifest entries after a production build', () => {
    const manifestPath = resolve(process.cwd(), 'dist/.vite/manifest.json');
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { isDynamicEntry?: boolean }>;
    const eagerOwnerPaths = [
      'src/components/common/ServiceRunBlockerPanel.tsx',
      'src/features/projects/weekly-menu/shell/WeeklyMenuReadiness.tsx',
      'src/features/purchasing/PurchaseWorkflowGuide.tsx',
      'src/features/warehouse/pages/WarehouseMovementPanel.tsx',
      'src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx',
    ];
    for (const ownerPath of eagerOwnerPaths) {
      expect(manifest[ownerPath]?.isDynamicEntry, `${ownerPath} must stay in its route entry closure`).not.toBe(true);
    }
  });

  it('preloads only inactive weekly-menu views and leaves the selected schedule in the eager route closure', () => {
    expect(weeklyMenuPageSource).toContain("weeklyMenuTabIds.filter((view) => view !== 'schedule')");
    expect(weeklyMenuPageSource).toContain('preloadWeeklyMenuView(view)');
  });
});
