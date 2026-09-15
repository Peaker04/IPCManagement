import { useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import type { ViewTab } from '@/components/common';
import { selectCurrentUser } from '@/features/auth';
import { getTodayInputValue, isAdminView, type AdminView } from './adminDataPageTypes';
import { useAdminAuditPanelModel } from './useAdminAuditPanelModel';
import { useAdminBomPanelModel } from './useAdminBomPanelModel';
import { useAdminCleanupPanelModel } from './useAdminCleanupPanelModel';
import { useAdminContractsPanelModel } from './useAdminContractsPanelModel';
import { useAdminEmployeesPanelModel } from './useAdminEmployeesPanelModel';
import { useAdminInventoryPanelModel } from './useAdminInventoryPanelModel';
import { useAdminStatisticsPanelModel } from './useAdminStatisticsPanelModel';
import { readPageTabPreferences, visibleTabIds } from '@/lib/navigationPreferences';
import { useSystemOperation } from '@/lib/systemOperationContext';
import { eligiblePageTabs } from '@/lib/systemOperationEligibility';

export function useAdminDataPageModel() {
  const [isViewPending, startViewTransition] = useTransition();
  const operationalDate = getTodayInputValue();
  const currentUser = useAppSelector(selectCurrentUser);
  const operation = useSystemOperation();
  const [searchParams, setSearchParams] = useSearchParams();
  const bomTemplateDishId = searchParams.get('dishId')?.trim() || undefined;
  const requestedBomTier = Number(searchParams.get('tier'));
  const bomInitialScope = {
    priceTier: [25000, 30000, 34000].includes(requestedBomTier) ? requestedBomTier : undefined,
    customerId: searchParams.get('customerId')?.trim() || undefined,
    effectiveFrom: /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '') ? searchParams.get('date')! : undefined,
  };
  const canManageEmployees = currentUser?.role === 'admin' || currentUser?.isAdminFullAccess;
  const eligibleAdminTabs = eligiblePageTabs(operation?.mode ?? 'DEFAULT', 'admin-data', operation?.capabilities.pageTabs['admin-data'] ?? [], visibleTabIds('admin-data')) as AdminView[];
  const requestedView = searchParams.get('view');
  const activeView = isAdminView(requestedView) && eligibleAdminTabs.includes(requestedView) && (requestedView !== 'employees' || canManageEmployees)
    ? requestedView
    : eligibleAdminTabs[0] ?? 'bom-import';
  const setActiveView = (view: AdminView) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('view', view);
    setSearchParams(nextSearchParams);
  };
  const adminTabPreferences = readPageTabPreferences()['admin-data'];

  const { queryViews: bomQueryViews, ...bomModel } = useAdminBomPanelModel(activeView, bomTemplateDishId, bomInitialScope);
  const { queryViews: contractQueryViews, ...contractModel } = useAdminContractsPanelModel(activeView);
  const { queryView: dataQualityView, ...cleanupModel } = useAdminCleanupPanelModel(activeView, operationalDate);
  const { queryViews: inventoryQueryViews, ...inventoryModel } = useAdminInventoryPanelModel(activeView);
  const { queryViews: statisticsQueryViews, ...statisticsModel } = useAdminStatisticsPanelModel(activeView, operationalDate);
  const { queryView: auditView, ...auditModel } = useAdminAuditPanelModel(activeView);
  const { queryViews: employeeQueryViews, ...employeeModel } = useAdminEmployeesPanelModel(activeView, canManageEmployees);

  const effectiveActiveView: AdminView = canManageEmployees ? activeView : activeView === 'employees' ? 'bom-import' : activeView;
  const adminTabs: ViewTab[] = [
    ...(adminTabPreferences['bom-import'] && eligibleAdminTabs.includes('bom-import') ? [{ id: 'admin-bom-import', label: 'BOM theo đơn giá' }] : []),
    ...(adminTabPreferences.contracts && eligibleAdminTabs.includes('contracts') ? [{ id: 'admin-contracts', label: 'Hợp đồng' }] : []),
    ...(adminTabPreferences.cleanup && eligibleAdminTabs.includes('cleanup') ? [{ id: 'admin-cleanup', label: 'Dữ liệu lỗi' }] : []),
    ...(adminTabPreferences.inventory && eligibleAdminTabs.includes('inventory') ? [{ id: 'admin-inventory', label: 'Tồn kho' }] : []),
    ...(adminTabPreferences.statistics && eligibleAdminTabs.includes('statistics') ? [{ id: 'admin-statistics', label: 'Thống kê' }] : []),
    ...(adminTabPreferences.audit && eligibleAdminTabs.includes('audit') ? [{ id: 'admin-audit', label: 'Nhật ký thay đổi' }] : []),
    ...(canManageEmployees && adminTabPreferences.employees && eligibleAdminTabs.includes('employees') ? [{ id: 'admin-employees', label: 'Nhân viên' }] : []),
  ];
  const queryViews = {
    audit: auditView,
    contracts: contractQueryViews.contracts,
    currentStock: inventoryQueryViews.currentStock,
    dataQuality: dataQualityView,
    dishCatalog: bomQueryViews.dishCatalog,
    employees: employeeQueryViews.employees,
    ingredientCatalog: bomQueryViews.ingredientCatalog,
    ingredientDemand: statisticsQueryViews.ingredientDemand,
    menuSchedules: contractQueryViews.menuSchedules,
    operationalKpis: statisticsQueryViews.operationalKpis,
    priceVariance: statisticsQueryViews.priceVariance,
    purchasePlan: statisticsQueryViews.purchasePlan,
    roles: employeeQueryViews.roles,
    stockMovements: inventoryQueryViews.stockMovements,
  };

  const effectiveTabView = adminTabs.some((tab) => tab.id === `admin-${effectiveActiveView}`) ? effectiveActiveView : (adminTabs[0]?.id.replace('admin-', '') as AdminView ?? 'bom-import');
  return {
    queryViews,
    ...bomModel,
    ...contractModel,
    ...cleanupModel,
    ...inventoryModel,
    ...statisticsModel,
    ...auditModel,
    ...employeeModel,
    adminTabs,
    bomTemplateDishId,
    canManageEmployees,
    effectiveActiveView: effectiveTabView,
    isViewPending,
    setActiveView,
    startViewTransition,
  };
}

export type AdminDataPageModel = ReturnType<typeof useAdminDataPageModel>;
