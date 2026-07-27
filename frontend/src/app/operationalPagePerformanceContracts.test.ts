import { describe, expect, it } from 'vitest';
import purchasingSource from '../features/purchasing/pages/PurchasingPage.tsx?raw';
import adminSource from '../features/workflow/pages/AdminDataPage.tsx?raw';
import chefSource from '../features/chef/pages/ChefDashboardPage.tsx?raw';
import chefReceiptsSource from '../features/chef/receipts/useKitchenReceipts.ts?raw';
import chefProductionSource from '../features/chef/production/useChefProductionPlan.ts?raw';
import chefExceptionsSource from '../features/chef/exceptions/useChefExceptions.ts?raw';
import chefJournalSource from '../features/chef/journal/useChefJournal.ts?raw';
import reportsSource from '../features/reports/pages/ReportsPage.tsx?raw';
import weeklyMenuSource from '../features/projects/pages/WeeklyMenuPage.tsx?raw';
import materialDemandSource from '../features/projects/weekly-menu/demand/useMaterialDemand.ts?raw';
import warehouseSource from '../features/warehouse/pages/WarehousePage.tsx?raw';

describe('operational page performance contracts', () => {
  it('keeps supplier quotations as an isolated purchasing work object', () => {
    expect(purchasingSource).toContain("{ id: 'purchasing-quotations', label: 'Báo giá nhà cung cấp' }");
    expect(purchasingSource).toContain("useSupplierQuotations(activeView === 'quotations')");
    expect(purchasingSource).toContain("{ skip: activeView !== 'workflow' }");
    expect(purchasingSource).toContain("activeView === 'quotations' ? (");
  });

  it('places the chef shift summary before the production plan table', () => {
    expect(chefSource.indexOf('<ChefHeader productionPlan={production.productionPlan} />'))
      .toBeLessThan(chefSource.indexOf('<ChefProductionSection'));
  });

  it('does not fetch hidden weekly-menu work views', () => {
    expect(weeklyMenuSource).toContain("enabled: activeView === 'demand' || activeView === 'purchase-summary'");
    expect(weeklyMenuSource).toContain("activeView === 'production-plan'");
    expect(materialDemandSource).toContain('skip: !enabled || !scope.customerId');
    expect(materialDemandSource).toContain('skip: !stalenessEnabled || !scope.customerId');
    expect(weeklyMenuSource).toContain("connection?.saveData || connection?.effectiveType === 'slow-2g'");
    expect(weeklyMenuSource).toContain('.finally(preloadNext)');
  });

  it('keeps chef tab queries scoped to the selected panel', () => {
    expect(chefSource).toContain('const isProductionView = activeView === \'production\'');
    expect(chefSource).toContain('useChefJournal(!isProductionView)');
    for (const source of [chefReceiptsSource, chefProductionSource, chefExceptionsSource, chefJournalSource]) {
      expect(source).toContain('skip: !enabled');
    }
  });

  it('gates warehouse work-view queries and keeps panel geometry stable', () => {
    expect(warehouseSource).toContain("{ skip: activeView !== 'demand' }");
    expect(warehouseSource).toContain("useWorkflowOverview({ skip: activeView !== 'demand' })");
    expect(warehouseSource).toContain('min-h-[420px]');
    expect(warehouseSource).toContain('duration-150 motion-reduce:transition-none');
  });

  it('only fetches and renders the selected price analysis', () => {
    for (const subview of ['lines', 'supplier', 'period', 'dishGroup']) {
      expect(reportsSource).toContain(`priceSubView !== '${subview}'`);
    }
    expect(reportsSource).toContain("priceSubView === 'lines' && (");
    expect(reportsSource).toContain('price: activePriceResult');
  });

  it('does not build hidden admin dialogs or query inactive datasets', () => {
    expect(adminSource).toContain('{ skip: !isContractView || !selectedContract?.customerId }');
    expect(adminSource).toContain('if (!isBomView) return [];');
    expect(adminSource).toContain('{isBomDialogOpen && <Dialog open');
    expect(adminSource).toContain('{closingBom && <Dialog open');
    expect(adminSource).not.toContain('useWorkflowOverview(');
  });
});
