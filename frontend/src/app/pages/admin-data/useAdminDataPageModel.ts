import { useState, useTransition } from 'react';
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
import { readPageTabPreferences } from '@/lib/navigationPreferences';

export function useAdminDataPageModel() {
  const [isViewPending, startViewTransition] = useTransition();
  const operationalDate = getTodayInputValue();
  const currentUser = useAppSelector(selectCurrentUser);
  const [searchParams] = useSearchParams();
  const bomTemplateDishId = searchParams.get('dishId')?.trim() || undefined;
  const canManageEmployees = currentUser?.role === 'admin' || currentUser?.isAdminFullAccess;
  const initialView = isAdminView(searchParams.get('view')) && (searchParams.get('view') !== 'employees' || canManageEmployees)
    ? searchParams.get('view') as AdminView
    : 'bom-import';
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const adminTabPreferences = readPageTabPreferences()['admin-data'];

  const { queryViews: bomQueryViews, ...bomModel } = useAdminBomPanelModel(activeView, bomTemplateDishId);
  const { queryViews: contractQueryViews, ...contractModel } = useAdminContractsPanelModel(activeView);
  const { queryView: dataQualityView, ...cleanupModel } = useAdminCleanupPanelModel(activeView, operationalDate);
  const { queryViews: inventoryQueryViews, ...inventoryModel } = useAdminInventoryPanelModel(activeView);
  const { queryViews: statisticsQueryViews, ...statisticsModel } = useAdminStatisticsPanelModel(activeView, operationalDate);
  const { queryView: auditView, ...auditModel } = useAdminAuditPanelModel(activeView);
  const { queryViews: employeeQueryViews, ...employeeModel } = useAdminEmployeesPanelModel(activeView, canManageEmployees);

  const effectiveActiveView: AdminView = canManageEmployees ? activeView : activeView === 'employees' ? 'bom-import' : activeView;
  const adminContextItems = effectiveActiveView === 'bom-import'
    ? [
        { label: 'BOM đang hiển thị', value: bomQueryViews.dishCatalog.phase === 'ready' ? `${bomModel.currentBomRows.length} dòng` : '—', tone: 'neutral' as const },
        { label: 'Mức định lượng', value: `${bomModel.bomImportTier / 1000}k`, tone: 'info' as const },
        { label: 'Phạm vi', value: bomModel.bomImportCustomerId ? 'Theo khách hàng' : 'Dùng chung', tone: bomModel.bomImportCustomerId ? 'warning' as const : 'neutral' as const },
        { label: 'Kết quả kiểm tra', value: bomModel.bomImportPreview ? `${bomModel.bomImportPreview.validRows}/${bomModel.bomImportPreview.totalRows} hợp lệ` : 'Chưa kiểm tra', tone: bomModel.bomImportPreview?.errorRows ? 'danger' as const : bomModel.bomImportPreview ? 'success' as const : 'neutral' as const },
      ]
    : effectiveActiveView === 'contracts'
      ? [
          { label: 'Khách hàng', value: contractQueryViews.contracts.phase === 'ready' ? contractModel.customerContracts.length.toString() : '—', tone: 'neutral' as const },
          { label: 'Đang dùng', value: contractQueryViews.contracts.phase === 'ready' ? contractModel.customerContracts.filter((item) => item.isActive).length.toString() : '—', tone: contractQueryViews.contracts.phase === 'ready' ? 'success' as const : 'neutral' as const },
          { label: 'Phiên bản lịch', value: contractQueryViews.menuSchedules.phase === 'ready' ? contractModel.menuSchedules.length.toString() : '—', tone: 'neutral' as const },
        ]
      : effectiveActiveView === 'cleanup'
        ? [
            { label: 'Dữ liệu lỗi', value: dataQualityView.phase === 'ready' ? `${cleanupModel.dataQualityErrorCount} mục` : '—', tone: dataQualityView.phase !== 'ready' ? 'neutral' as const : cleanupModel.dataQualityErrorCount ? 'danger' as const : 'success' as const },
            { label: 'SLA gấp', value: dataQualityView.phase === 'ready' ? `${dataQualityView.data.urgentIssueCount}` : '—', tone: dataQualityView.phase !== 'ready' ? 'neutral' as const : dataQualityView.data.urgentIssueCount ? 'danger' as const : 'success' as const },
            { label: 'Đã xử lý', value: dataQualityView.phase === 'ready' ? `${dataQualityView.data.resolvedIssueCount}` : '—', tone: dataQualityView.phase === 'ready' ? 'success' as const : 'neutral' as const },
          ]
        : effectiveActiveView === 'inventory'
          ? [
              { label: 'Tồn kho', value: inventoryQueryViews.currentStock.phase === 'ready' ? `${inventoryQueryViews.currentStock.data.totalCount} dòng` : '—', tone: 'neutral' as const },
              { label: 'Điều chỉnh', value: inventoryQueryViews.stockMovements.phase === 'ready' ? `${inventoryModel.adjustmentMovements.length} bút toán` : '—', tone: inventoryQueryViews.stockMovements.phase !== 'ready' ? 'neutral' as const : inventoryModel.adjustmentMovements.length ? 'warning' as const : 'success' as const },
            ]
          : effectiveActiveView === 'statistics'
            ? [
                { label: 'Thiếu nguyên liệu', value: statisticsQueryViews.ingredientDemand.phase === 'ready' ? statisticsModel.shortageCount.toString() : '—', tone: statisticsQueryViews.ingredientDemand.phase !== 'ready' ? 'neutral' as const : statisticsModel.shortageCount ? 'danger' as const : 'success' as const },
                { label: 'Cảnh báo giá', value: statisticsQueryViews.priceVariance.phase === 'ready' ? statisticsModel.priceWarningCount.toString() : '—', tone: statisticsQueryViews.priceVariance.phase !== 'ready' ? 'neutral' as const : statisticsModel.priceWarningCount ? 'warning' as const : 'success' as const },
                { label: 'Đề xuất mua', value: statisticsQueryViews.purchasePlan.phase === 'ready' ? statisticsModel.totalPurchaseQty.toString() : '—', tone: statisticsQueryViews.purchasePlan.phase !== 'ready' ? 'neutral' as const : statisticsModel.totalPurchaseQty ? 'warning' as const : 'success' as const },
              ]
            : effectiveActiveView === 'audit'
              ? [{ label: 'Nhật ký', value: auditView.phase === 'ready' ? `${auditModel.displayLogs.length} thay đổi` : '—', tone: 'neutral' as const }]
              : [{ label: 'Nhân viên', value: employeeQueryViews.employees.phase === 'ready' ? `${employeeModel.employeeMeta?.totalCount ?? 0} tài khoản` : '—', tone: employeeQueryViews.employees.phase === 'ready' ? 'info' as const : 'neutral' as const }];
  const adminTabs: ViewTab[] = [
    ...(adminTabPreferences['bom-import'] ? [{ id: 'admin-bom-import', label: 'BOM theo đơn giá' }] : []),
    ...(adminTabPreferences.contracts ? [{ id: 'admin-contracts', label: 'Hợp đồng' }] : []),
    ...(adminTabPreferences.cleanup ? [{ id: 'admin-cleanup', label: 'Dữ liệu lỗi' }] : []),
    ...(adminTabPreferences.inventory ? [{ id: 'admin-inventory', label: 'Tồn kho' }] : []),
    ...(adminTabPreferences.statistics ? [{ id: 'admin-statistics', label: 'Thống kê' }] : []),
    ...(adminTabPreferences.audit ? [{ id: 'admin-audit', label: 'Nhật ký thay đổi' }] : []),
    ...(canManageEmployees && adminTabPreferences.employees ? [{ id: 'admin-employees', label: 'Nhân viên' }] : []),
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
    adminContextItems,
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
