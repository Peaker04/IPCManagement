import { describe, expect, it } from 'vitest';
import weeklyMenuPageSource from '../src/features/projects/pages/WeeklyMenuPage.tsx?raw';
import weeklyMenuViewContentSource from '../src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx?raw';
import purchasingPageSource from '../src/features/purchasing/pages/PurchasingPage.tsx?raw';
import warehousePageSource from '../src/features/warehouse/pages/WarehousePage.tsx?raw';

describe('critical route initial ownership', () => {
  it('keeps the weekly-menu command bar and selected schedule content eager without critical skeletons', () => {
    expect(weeklyMenuPageSource).toContain("import { WeeklyMenuCommandBar } from '../weekly-menu/shell/WeeklyMenuCommandBar';");
    expect(weeklyMenuPageSource).toContain("import { WeeklyMenuViewContent } from '../weekly-menu/shell/WeeklyMenuViewContent';");
    expect(weeklyMenuPageSource).not.toContain("lazy(() => import('../weekly-menu/shell/WeeklyMenuCommandBar')");
    expect(weeklyMenuPageSource).not.toContain("lazy(() => import('../weekly-menu/shell/WeeklyMenuViewContent')");
    expect(weeklyMenuViewContentSource).toContain("import { WeeklyScheduleSection } from '../schedule/WeeklyScheduleSection';");
    expect(weeklyMenuViewContentSource).not.toContain("lazy(() => import('../schedule/WeeklyScheduleSection')");
  });

  it('keeps the purchasing decision owner mounted eagerly while inactive tabs retain query isolation', () => {
    expect(purchasingPageSource).toContain("import { PurchaseDecisionPanel } from '../PurchaseDecisionPanel';");
    expect(purchasingPageSource).not.toContain("lazy(() => import('../PurchaseDecisionPanel')");
    expect(purchasingPageSource).toContain("{ skip: activeView !== 'workflow' }");
    expect(purchasingPageSource).toContain("useSupplierQuotations(activeView === 'quotations')");
    expect(purchasingPageSource).toContain("activeView === 'quotations' ? (");
  });

  it('keeps purchase orders mounted eagerly while inactive warehouse queries stay skipped', () => {
    expect(warehousePageSource).toContain("import { WarehousePurchaseOrdersPanel } from './WarehousePurchaseOrdersPanel';");
    expect(warehousePageSource).not.toContain("lazy(() => import('./WarehousePurchaseOrdersPanel')");
    expect(warehousePageSource).toContain("{ skip: activeView !== 'demand' }");
    expect(warehousePageSource).toContain("{ skip: activeView !== 'movement' }");
  });

  it('preloads only inactive weekly-menu views and leaves the selected schedule in the eager route closure', () => {
    expect(weeklyMenuPageSource).toContain("weeklyMenuTabIds.filter((view) => view !== 'schedule')");
    expect(weeklyMenuPageSource).toContain('preloadWeeklyMenuView(view)');
  });
});
