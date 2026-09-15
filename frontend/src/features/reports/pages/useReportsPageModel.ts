import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { WorkflowReportQuery } from '@/api/workflowApiTypes';
import { visibleTabIds } from '@/lib/navigationPreferences';
import { buildCsv, downloadCsv } from './reportCsv';
import {
  priceSubViewTabs,
  readPositiveInteger,
  reportTabs,
  validReportViews,
  type PriceSubView,
  type ReportExportConfig,
  type ReportView,
} from './reportsPageModelShared';
import { useReportsAuditQualityViewModel } from './useReportsAuditQualityViewModel';
import { useReportsDemandPurchaseViewModel } from './useReportsDemandPurchaseViewModel';
import { useReportsKitchenUsageViewModel } from './useReportsKitchenUsageViewModel';
import { useReportsPriceViewModel } from './useReportsPriceViewModel';
import { useReportsStockMovementViewModel } from './useReportsStockMovementViewModel';

export {
  movementTypeLabel,
  pricePageSizeOptions,
  standardPageSizeOptions,
} from './reportsPageModelShared';
export type { PriceSubView, ReportView } from './reportsPageModelShared';

type ReportsPagePermissions = {
  canReadAuditChanges: boolean;
  canReadPurchaseReports: boolean;
  canReadWarehouseReports: boolean;
};

export const useReportsPageModel = ({
  canReadAuditChanges,
  canReadPurchaseReports,
  canReadWarehouseReports,
}: ReportsPagePermissions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isViewPending, startViewTransition] = useTransition();
  const initialView = searchParams.get('view');
  const initialPage = readPositiveInteger(searchParams.get('page'), 1);
  const [requestedView, setRequestedView] = useState<ReportView>(
    validReportViews.includes(initialView as ReportView) ? initialView as ReportView : 'price',
  );
  const initialPriceSubView = searchParams.get('subview');
  const [requestedPriceSubView, setRequestedPriceSubView] = useState<PriceSubView>(
    priceSubViewTabs.some((tab) => tab.id === initialPriceSubView) ? initialPriceSubView as PriceSubView : 'lines',
  );
  const canReadReceiptPriceVariance = canReadPurchaseReports || canReadWarehouseReports;
  const preferredReportViews = useMemo(() => visibleTabIds('reports') as ReportView[], []);
  const preferredPriceSubViews = useMemo(() => priceSubViewTabs.map((tab) => tab.id), []);
  const visibleReportViews = useMemo<ReportView[]>(() => validReportViews.filter((view) => {
    if (!preferredReportViews.includes(view)) return false;
    if (view === 'price') return canReadReceiptPriceVariance;
    if (view === 'purchase') return canReadPurchaseReports;
    if (view === 'audit') return canReadAuditChanges;
    return true;
  }), [canReadReceiptPriceVariance, canReadPurchaseReports, canReadAuditChanges, preferredReportViews]);
  const visibleReportTabs = useMemo(
    () => reportTabs.filter((tab) => visibleReportViews.includes(tab.id.replace('reports-', '') as ReportView)),
    [visibleReportViews],
  );
  const visiblePriceSubViewTabs = useMemo(
    () => priceSubViewTabs.filter((tab) => preferredPriceSubViews.includes(tab.id) && (tab.id === 'lines' ? canReadReceiptPriceVariance : canReadPurchaseReports)),
    [canReadReceiptPriceVariance, canReadPurchaseReports, preferredPriceSubViews],
  );
  const activeView: ReportView = visibleReportViews.includes(requestedView)
    ? requestedView
    : visibleReportViews[0] ?? 'demand';
  const priceSubView: PriceSubView = visiblePriceSubViewTabs.some((tab) => tab.id === requestedPriceSubView)
    ? requestedPriceSubView
    : visiblePriceSubViewTabs[0]?.id ?? 'lines';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const reportPageSize = 20;
  const reportQuery = useMemo<WorkflowReportQuery>(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    shiftName: shiftName || undefined,
    limit: reportPageSize,
  }), [dateFrom, dateTo, shiftName]);

  const { exportConfig: priceExportConfig, view: priceView, ...priceModel } = useReportsPriceViewModel({
    activeView,
    initialPage,
    priceSubView,
    reportQuery,
    searchParams,
  });
  const { exportConfigs: demandPurchaseExportConfigs, views: demandPurchaseViews, ...demandPurchaseModel } = useReportsDemandPurchaseViewModel({
    activeView,
    initialPage,
    reportQuery,
    searchParams,
  });
  const { exportConfigs: stockMovementExportConfigs, views: stockMovementViews, ...stockMovementModel } = useReportsStockMovementViewModel({
    activeView,
    initialPage,
    reportPageSize,
    reportQuery,
    searchParams,
    sortDirection,
  });
  const { exportConfigs: kitchenUsageExportConfigs, views: kitchenUsageViews, ...kitchenUsageModel } = useReportsKitchenUsageViewModel({
    activeView,
    initialPage,
    reportQuery,
    searchParams,
  });
  const { exportConfigs: auditQualityExportConfigs, views: auditQualityViews, ...auditQualityModel } = useReportsAuditQualityViewModel({
    activeView,
    initialPage,
    operationalPageSize: kitchenUsageModel.operationalPageSize,
    reportPageSize,
    reportQuery,
    sortDirection,
  });

  const updateSearchState = (updates: Record<string, string | undefined>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace: true });
  };
  const setNumberedPage = (setter: Dispatch<SetStateAction<number>>, nextPage: number) => {
    setter(nextPage);
    updateSearchState({
      view: activeView,
      subview: activeView === 'price' ? priceSubView : undefined,
      page: String(nextPage),
    });
  };
  const setNumberedPageSize = (
    pageSetter: Dispatch<SetStateAction<number>>,
    pageSizeSetter: Dispatch<SetStateAction<number>>,
    nextPageSize: number,
  ) => {
    pageSizeSetter(nextPageSize);
    pageSetter(1);
    updateSearchState({
      view: activeView,
      subview: activeView === 'price' ? priceSubView : undefined,
      page: '1',
      pageSize: String(nextPageSize),
    });
  };
  const resetCursorPages = () => {
    stockMovementModel.setMovementCursors([]);
    auditQualityModel.setAuditCursors([]);
  };
  const resetReportPages = () => {
    priceModel.setPricePage(1);
    priceModel.setSupplierPage(1);
    priceModel.setPeriodPage(1);
    priceModel.setDishGroupPage(1);
    stockMovementModel.setStockPage(1);
    demandPurchaseModel.setDemandPage(1);
    demandPurchaseModel.setPurchasePage(1);
    kitchenUsageModel.setKitchenPage(1);
    kitchenUsageModel.setUsagePage(1);
    auditQualityModel.setDataQualityPage(1);
    resetCursorPages();
  };
  const resetReportPagesAndUrl = () => {
    resetReportPages();
    updateSearchState({ page: '1' });
  };
  const changeDateFrom = (value: string) => {
    if (value === dateFrom) return;
    setDateFrom(value);
    resetReportPagesAndUrl();
  };
  const changeDateTo = (value: string) => {
    if (value === dateTo) return;
    setDateTo(value);
    resetReportPagesAndUrl();
  };
  const changeShiftName = (value: string) => {
    if (value === shiftName) return;
    setShiftName(value);
    resetReportPagesAndUrl();
  };
  const reportViews = {
    price: priceView,
    demand: demandPurchaseViews.demand,
    purchase: demandPurchaseViews.purchase,
    stock: stockMovementViews.stock,
    movement: stockMovementViews.movement,
    kitchen: kitchenUsageViews.kitchen,
    usage: kitchenUsageViews.usage,
    audit: auditQualityViews.audit,
    'data-quality': auditQualityViews['data-quality'],
  };
  const activeReportView = reportViews[activeView];
  const exportConfig: Record<ReportView, ReportExportConfig> = {
    price: priceExportConfig,
    ...demandPurchaseExportConfigs,
    ...stockMovementExportConfigs,
    ...kitchenUsageExportConfigs,
    ...auditQualityExportConfigs,
  };
  const canExportActiveReport =
    activeReportView.phase === 'ready' &&
    (exportConfig[activeView]?.rows.length ?? 0) > 0;
  const handleExportActiveReport = () => {
    const config = exportConfig[activeView];
    if (config.rows.length === 0) return;
    const csv = buildCsv(config.rows, config.columns);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `${config.filename}-${timestamp}.csv`);
  };
  return {
    ...priceModel,
    ...demandPurchaseModel,
    ...stockMovementModel,
    ...kitchenUsageModel,
    ...auditQualityModel,
    activeReportView,
    activeView,
    canExportActiveReport,
    canReadAuditChanges,
    canReadPurchaseReports,
    canReadReceiptPriceVariance,
    canReadWarehouseReports,
    changeDateFrom,
    changeDateTo,
    changeShiftName,
    dateFrom,
    dateTo,
    exportConfig,
    handleExportActiveReport,
    initialPage,
    initialPriceSubView,
    initialView,
    isViewPending,
    priceSubView,
    reportPageSize,
    reportQuery,
    reportViews,
    requestedPriceSubView,
    requestedView,
    resetCursorPages,
    resetReportPages,
    resetReportPagesAndUrl,
    searchParams,
    setDateFrom: changeDateFrom,
    setDateTo: changeDateTo,
    setNumberedPage,
    setNumberedPageSize,
    setRequestedPriceSubView,
    setRequestedView,
    setSearchParams,
    setShiftName: changeShiftName,
    setSortDirection,
    shiftName,
    sortDirection,
    startViewTransition,
    updateSearchState,
    visiblePriceSubViewTabs,
    visibleReportTabs,
    visibleReportViews,
  };
};

export type ReportsPageModel = ReturnType<typeof useReportsPageModel>;
