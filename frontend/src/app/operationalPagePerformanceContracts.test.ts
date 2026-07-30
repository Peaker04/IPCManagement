import { describe, expect, it } from 'vitest';
import purchasingSource from '../features/purchasing/pages/PurchasingPage.tsx?raw';
import adminSource from './pages/AdminDataPage.tsx?raw';
import adminBomSource from './pages/admin-data/AdminBomPanel.tsx?raw';
import adminBomModelSource from './pages/admin-data/useAdminBomPanelModel.ts?raw';
import adminContractsModelSource from './pages/admin-data/useAdminContractsPanelModel.ts?raw';
import adminModelSource from './pages/admin-data/useAdminDataPageModel.ts?raw';
import adminInventorySource from './pages/admin-data/AdminInventoryPanel.tsx?raw';
import adminInventoryModelSource from './pages/admin-data/useAdminInventoryPanelModel.ts?raw';
import chefSource from '../features/chef/pages/ChefDashboardPage.tsx?raw';
import chefReceiptsSource from '../features/chef/receipts/useKitchenReceipts.ts?raw';
import chefProductionSource from '../features/chef/production/useChefProductionPlan.ts?raw';
import chefExceptionsSource from '../features/chef/exceptions/useChefExceptions.ts?raw';
import chefJournalSource from '../features/chef/journal/useChefJournal.ts?raw';
import reportsSource from '../features/reports/pages/ReportsPage.tsx?raw';
import reportsModelSource from '../features/reports/pages/useReportsPageModel.ts?raw';
import reportsStockModelSource from '../features/reports/pages/useReportsStockMovementViewModel.ts?raw';
import reportsPriceSource from '../features/reports/pages/ReportsPricePanel.tsx?raw';
import reportsPriceModelSource from '../features/reports/pages/useReportsPriceViewModel.ts?raw';
import weeklyMenuSource from '../features/projects/pages/WeeklyMenuPage.tsx?raw';
import materialDemandSource from '../features/projects/weekly-menu/demand/useMaterialDemand.ts?raw';
import purchaseSummaryModelSource from '../features/projects/weekly-menu/purchasing/usePurchaseSummary.ts?raw';
import warehouseSource from '../features/warehouse/pages/WarehousePage.tsx?raw';
import warehouseDemandPanelSource from '../features/warehouse/WarehouseDemandPanel.tsx?raw';

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
    expect(weeklyMenuSource).toContain("enabled: activeView === 'demand'");
    expect(weeklyMenuSource).toContain("enabled: activeView === 'purchase-summary'");
    expect(weeklyMenuSource).toContain('const demandReadinessResult = useGetIngredientDemandAggregatePageQuery({');
    expect(weeklyMenuSource).toContain('pageSize: 10');
    expect(weeklyMenuSource).toContain('demandMaterialCount: demandReadinessResult.data?.totalCount ?? 0');
    expect(weeklyMenuSource).toContain("activeView === 'production-plan'");
    expect(materialDemandSource).toContain('skip: !enabled || !scope.customerId');
    expect(purchaseSummaryModelSource).toContain('useGetIngredientDemandAggregatePageQuery({');
    expect(purchaseSummaryModelSource).toContain('pageSize: 10');
    expect(purchaseSummaryModelSource).toContain('searchKeyword: deferredSearch || undefined');
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
    const warehouseContractSource = `${warehouseSource}\n${warehouseDemandPanelSource}`;
    expect(warehouseContractSource).toContain("{ skip: activeView !== 'demand' }");
    expect(warehouseContractSource).toContain("useWorkflowOverview({ skip: activeView !== 'demand' })");
    expect(warehouseContractSource).toContain('min-h-[420px]');
    expect(warehouseContractSource).toContain('duration-150 motion-reduce:transition-none');
  });

  it('only fetches and renders the selected price analysis', () => {
    const reportsContractSource = `${reportsSource}\n${reportsModelSource}\n${reportsPriceModelSource}\n${reportsPriceSource}`;
    for (const subview of ['lines', 'supplier', 'period', 'dishGroup']) {
      expect(reportsContractSource).toContain(`priceSubView !== '${subview}'`);
    }
    expect(reportsContractSource).toContain("priceSubView === 'lines' && (");
    expect(reportsContractSource).toContain('price: priceModel.activePriceView');
  });

  it('does not build hidden admin dialogs or query inactive datasets', () => {
    const adminContractSource = `${adminSource}\n${adminModelSource}\n${adminBomModelSource}\n${adminContractsModelSource}\n${adminBomSource}`;
    expect(adminContractSource).toContain("{ skip: activeView !== 'contracts' || !selectedContract?.customerId }");
    expect(adminContractSource).toContain('if (!isBomView) return [];');
    expect(adminContractSource).toContain('{isBomDialogOpen && <Dialog open');
    expect(adminContractSource).toContain('{closingBom && <Dialog open');
    expect(adminContractSource).not.toContain('useWorkflowOverview(');
  });

  it('keeps large stock and movement searches server-side before pagination', () => {
    const searchContractSource = `${reportsSource}\n${reportsStockModelSource}\n${warehouseSource}\n${adminInventorySource}\n${adminInventoryModelSource}`;
    expect(searchContractSource).toContain('searchKeyword: deferredStockSearch || undefined');
    expect(searchContractSource).toContain('searchKeyword: deferredMovementSearch || undefined');
    expect(searchContractSource).toContain('searchKeyword: deferredCurrentStockSearch || undefined');
    expect(searchContractSource).toContain('searchKeyword: deferredStockMovementSearch || undefined');
    expect(searchContractSource).toContain('searchKeyword: deferredInventoryMovementSearch || undefined');
  });
});
