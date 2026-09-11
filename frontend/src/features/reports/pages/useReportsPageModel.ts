import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ContextStripItem } from '@/components/common';
import type { WorkflowReportQuery } from '@/api/workflowApiTypes';
import { uiCopy } from '@/lib/uiCopy';
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
  const reportViews = {
    price: priceModel.activePriceView,
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
  const handleExportActiveReport = () => {
    const config = exportConfig[activeView];
    if (config.rows.length === 0) return;
    const csv = buildCsv(config.rows, config.columns);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `${config.filename}-${timestamp}.csv`);
  };
  const reportContextItems: ContextStripItem[] = [
    ...(canReadReceiptPriceVariance
      ? [{ label: 'Cảnh báo giá trên trang', value: priceView.phase === 'ready' ? `${priceModel.warningItems.length}/${priceModel.priceVarianceRows.length}` : '—', tone: priceView.phase !== 'ready' ? 'neutral' as const : priceModel.warningItems.length ? 'danger' as const : 'success' as const }]
      : []),
    { label: 'Thiếu nguyên liệu', value: demandPurchaseViews.demand.phase === 'ready' ? demandPurchaseModel.shortageCount.toString() : '—', tone: demandPurchaseViews.demand.phase !== 'ready' ? 'neutral' : demandPurchaseModel.shortageCount ? 'danger' : 'success' },
    { label: 'Dòng tồn kho', value: stockMovementViews.stock.phase === 'ready' ? stockMovementViews.stock.data.totalCount.toString() : '—', tone: 'neutral' },
    ...(canReadAuditChanges
      ? [{ label: uiCopy.reports.audit, value: auditQualityViews.audit.phase === 'ready' ? auditQualityModel.auditRows.length.toString() : '—', tone: 'neutral' as const }]
      : []),
    { label: uiCopy.reports.dataQuality, value: auditQualityViews['data-quality'].phase === 'ready' ? (auditQualityViews['data-quality'].data.totalIssues ?? 0).toString() : '—', tone: auditQualityViews['data-quality'].phase !== 'ready' ? 'neutral' : auditQualityModel.dataQualityRows.length ? 'warning' : 'success' },
  ];

  return {
    ...priceModel,
    ...demandPurchaseModel,
    ...stockMovementModel,
    ...kitchenUsageModel,
    ...auditQualityModel,
    activeReportView,
    activeView,
    canReadAuditChanges,
    canReadPurchaseReports,
    canReadReceiptPriceVariance,
    canReadWarehouseReports,
    dateFrom,
    dateTo,
    exportConfig,
    handleExportActiveReport,
    initialPage,
    initialPriceSubView,
    initialView,
    isViewPending,
    priceSubView,
    reportContextItems,
    reportPageSize,
    reportQuery,
    reportViews,
    requestedPriceSubView,
    requestedView,
    resetCursorPages,
    resetReportPages,
    resetReportPagesAndUrl,
    searchParams,
    setDateFrom,
    setDateTo,
    setNumberedPage,
    setNumberedPageSize,
    setRequestedPriceSubView,
    setRequestedView,
    setSearchParams,
    setShiftName,
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
