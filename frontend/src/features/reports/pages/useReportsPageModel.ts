import { useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { WorkflowReportQuery } from '@/api/workflowApiTypes';
import { visibleTabIds } from '@/lib/navigationPreferences';
import { buildCsv, downloadCsv } from './reportCsv';
import {
  pricePageSizeOptions,
  priceSubViewTabs,
  readPageSize,
  readPositiveInteger,
  reportTabs,
  standardPageSizeOptions,
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
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');
  const [shiftName, setShiftName] = useState(searchParams.get('shift') ?? '');
  const initialSort = searchParams.get('sort');
  const [sortDirection, setSortDirectionState] = useState<'desc' | 'asc'>(initialSort === 'asc' ? 'asc' : 'desc');
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
    searchParams,
  });

  useEffect(() => {
    let cancelled = false
    const syncFromUrl = () => {
      if (cancelled) return
    const urlView = searchParams.get('view');
    const nextView = visibleReportViews.includes(urlView as ReportView) ? urlView as ReportView : visibleReportViews[0] ?? 'demand';
    const urlSubView = searchParams.get('subview');
    const nextSubView = visiblePriceSubViewTabs.some((tab) => tab.id === urlSubView) ? urlSubView as PriceSubView : visiblePriceSubViewTabs[0]?.id ?? 'lines';
    const nextPage = readPositiveInteger(searchParams.get('page'), 1);
    const nextPageSize = readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions);
    const nextPricePageSize = readPageSize(searchParams.get('pageSize'), 6, pricePageSizeOptions);
    const nextSearch = searchParams.get('search') ?? '';

    setRequestedView(nextView);
    setRequestedPriceSubView(nextSubView);
    setDateFrom(searchParams.get('dateFrom') ?? '');
    setDateTo(searchParams.get('dateTo') ?? '');
    setShiftName(searchParams.get('shift') ?? '');
    setSortDirectionState(searchParams.get('sort') === 'asc' ? 'asc' : 'desc');

    if (nextView === 'price') {
      priceModel.hydratePriceSearch(nextSubView === 'lines' ? nextSearch : '');
      priceModel.setPricePage(nextPage);
      priceModel.setPricePageSize(nextPricePageSize);
      priceModel.setPriceAggregatePageSize(nextPageSize);
      priceModel.setSupplierPage(nextPage);
      priceModel.setPeriodPage(nextPage);
      priceModel.setDishGroupPage(nextPage);
    } else if (nextView === 'demand') {
      demandPurchaseModel.setDemandSearch(nextSearch);
      demandPurchaseModel.setDemandPage(nextPage);
      demandPurchaseModel.setDemandPageSize(nextPageSize);
    } else if (nextView === 'purchase') {
      demandPurchaseModel.setPurchaseSearch(nextSearch);
      demandPurchaseModel.setPurchasePage(nextPage);
      demandPurchaseModel.setPurchasePageSize(nextPageSize);
    } else if (nextView === 'stock') {
      stockMovementModel.setStockSearch(nextSearch);
      stockMovementModel.setStockPage(nextPage);
      stockMovementModel.setStockPageSize(nextPageSize);
    } else if (nextView === 'movement') {
      stockMovementModel.setMovementSearch(nextSearch);
      stockMovementModel.setMovementCursors([]);
    } else if (nextView === 'kitchen') {
      kitchenUsageModel.setKitchenPage(nextPage);
      kitchenUsageModel.setOperationalPageSize(nextPageSize);
    } else if (nextView === 'usage') {
      kitchenUsageModel.setUsagePage(nextPage);
      kitchenUsageModel.setOperationalPageSize(nextPageSize);
    } else if (nextView === 'audit') {
      auditQualityModel.setAuditCursors([]);
    } else if (nextView === 'data-quality') {
      auditQualityModel.setDataQualitySearch(nextSearch);
      auditQualityModel.setDataQualityPage(nextPage);
    }
    }
    queueMicrotask(syncFromUrl)
    return () => { cancelled = true }
    // URL changes are the external source of truth; model setters are intentionally omitted because several are view-local callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, visiblePriceSubViewTabs, visibleReportViews]);

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
  const resetPagesAndUrl = (updates: Record<string, string | undefined> = {}) => {
    resetReportPages();
    updateSearchState({ page: '1', ...updates });
  };
  const resetReportPagesAndUrl = () => {
    setDateFrom('');
    setDateTo('');
    setShiftName('');
    setSortDirectionState('desc');
    priceModel.setPriceSearch('');
    demandPurchaseModel.setDemandSearch('');
    demandPurchaseModel.setPurchaseSearch('');
    stockMovementModel.setStockSearch('');
    stockMovementModel.setMovementSearch('');
    auditQualityModel.setDataQualitySearch('');
    resetPagesAndUrl({ dateFrom: undefined, dateTo: undefined, shift: undefined, sort: undefined, search: undefined });
  };
  const changeDateFrom = (value: string) => {
    if (value === dateFrom) return;
    setDateFrom(value);
    resetPagesAndUrl({ dateFrom: value || undefined });
  };
  const changeDateTo = (value: string) => {
    if (value === dateTo) return;
    setDateTo(value);
    resetPagesAndUrl({ dateTo: value || undefined });
  };
  const changeShiftName = (value: string) => {
    if (value === shiftName) return;
    setShiftName(value);
    resetPagesAndUrl({ shift: value || undefined });
  };
  const changeSortDirection = (value: 'desc' | 'asc') => {
    if (value === sortDirection) return;
    setSortDirectionState(value);
    resetPagesAndUrl({ sort: value === 'desc' ? undefined : value });
  };
  const persistSearch = (value: string) => updateSearchState({ page: '1', search: value.trim() || undefined });
  const changeDemandSearch = (value: string) => { demandPurchaseModel.setDemandSearch(value); demandPurchaseModel.setDemandPage(1); persistSearch(value); };
  const changePurchaseSearch = (value: string) => { demandPurchaseModel.setPurchaseSearch(value); persistSearch(value); };
  const changeStockSearch = (value: string) => { stockMovementModel.setStockSearch(value); persistSearch(value); };
  const changeMovementSearch = (value: string) => { stockMovementModel.setMovementSearch(value); persistSearch(value); };
  const changePriceSearch = (value: string) => { priceModel.setPriceSearch(value); persistSearch(value); };
  const changeDataQualitySearch = (value: string) => { auditQualityModel.setDataQualitySearch(value); persistSearch(value); };
  const reportSearchByView: Partial<Record<ReportView, string>> = {
    price: priceModel.priceSearch,
    demand: demandPurchaseModel.demandSearch,
    purchase: demandPurchaseModel.purchaseSearch,
    stock: stockMovementModel.stockSearch,
    movement: stockMovementModel.movementSearch,
    'data-quality': auditQualityModel.dataQualitySearch,
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
    reportSearchByView,
    reportViews,
    requestedPriceSubView,
    requestedView,
    resetCursorPages,
    resetReportPages,
    resetReportPagesAndUrl,
    searchParams,
    setDateFrom: changeDateFrom,
    setDataQualitySearch: changeDataQualitySearch,
    setDemandSearch: changeDemandSearch,
    setMovementSearch: changeMovementSearch,
    setPriceSearch: changePriceSearch,
    setPurchaseSearch: changePurchaseSearch,
    setStockSearch: changeStockSearch,
    setDateTo: changeDateTo,
    setNumberedPage,
    setNumberedPageSize,
    setRequestedPriceSubView,
    setRequestedView,
    setSearchParams,
    setShiftName: changeShiftName,
    setSortDirection: changeSortDirection,
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
