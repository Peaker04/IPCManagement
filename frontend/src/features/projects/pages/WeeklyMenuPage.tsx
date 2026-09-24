import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'; import { useSearchParams } from 'react-router-dom';
import { WeeklyMenuCommandBar } from '../weekly-menu/shell/WeeklyMenuCommandBar';
import { WeeklyMenuReadiness } from '../weekly-menu/shell/WeeklyMenuReadiness';
import { WeeklyMenuViewContent } from '../weekly-menu/shell/WeeklyMenuViewContent';
import { useCoordinationStoreSelector } from '@/lib/coordinationStore';
import { useAppDispatch } from '@/lib/reduxHooks';
import { setWeeklyMenu } from '@/lib/coordinationActions';
import { OperationalFrame, RefreshStatus, ConfirmDialog } from '@/components/common';
import { typography } from '@/lib/typography';
import { useHasRole } from '@/lib/useHasRole';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { visibleTabIds, readReconciliationSelection } from '@/lib/navigationPreferences';
import { eligiblePageTabs } from '@/lib/systemOperationEligibility';
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi';
import { useGetIngredientDemandAggregatePageQuery } from '@/api/reportsApi';
import { useGetCoordinationCustomersQuery, useGetCustomerContractsQuery, useGetCommittedWeeklyMenuQuery, useGetReconciliationWeeklyMenuQuery, useGetMealQuantityPlansQuery, useGetMenuSchedulesQuery, useUpdateMenuScheduleVersionMutation } from '@/api/coordinationApi';
import { isBomPriceTier, normalizeBomPriceTier } from '../weeklyMenuPlanning';
import { formatImportDate, getStoredWeekStartDate, LAST_WEEKLY_MENU_CUSTOMER_KEY, LAST_WEEKLY_MENU_WEEK_KEY, normalizeDishMatchKey, normalizeWeekStartDate, parseDisplayDateToIso, readWeeklyMenuSelection, toLocalIsoDate, writeWeeklyMenuSelection } from '../weekly-menu/model/formatters';
import { buildImportedDayDates, buildImportedLayoutRows, buildPlanRowsMaterialSummary } from '../weekly-menu/model/scope';
import type { WeeklyMenuView } from '../weekly-menu/model/types';
import { useWeeklyMenuImport } from '../weekly-menu/import/useWeeklyMenuImport';
import { useWeeklyScheduleEditor } from '../weekly-menu/schedule/useWeeklyScheduleEditor';
import type { WeeklyScheduleFeedback } from '../weekly-menu/schedule/types';
import { useWeeklyProductionPlan } from '../weekly-menu/production-plan/useWeeklyProductionPlan';
import { useMaterialDemand } from '../weekly-menu/demand/useMaterialDemand';
import { useMenuCost } from '../weekly-menu/cost/useMenuCost';
import { usePurchaseSummary } from '../weekly-menu/purchasing/usePurchaseSummary';
import { useDishMaterials } from '../weekly-menu/dish-materials/useDishMaterials';
import { buildWeeklyPlanRows } from '../weekly-menu/cost/weeklyPlanRowsModel';
import { WeeklyMenuPricingContext } from '../weekly-menu/shell/WeeklyMenuPricingContext';
import { WeeklyMenuAlerts } from '../weekly-menu/shell/WeeklyMenuAlerts';
import { preloadWeeklyMenuView } from '../weekly-menu/shell/weeklyMenuViewPreload';
import { buildWeeklyMenuReadiness } from '../weekly-menu/model/readiness';
import { ClosedLoopTransferPanel } from '@/components/reconciliation/ClosedLoopTransferPanel';
import { useSystemOperation } from '@/lib/systemOperationContext';
import { WeeklyMenuNavigation } from '../weekly-menu/shell/WeeklyMenuNavigation';
import { readReconciliationWeeklyMenuRoute } from '@/lib/routeConfig';
const WeeklyMenuImportDialog = lazy(() => import('../weekly-menu/import/WeeklyMenuImportDialog').then(({ WeeklyMenuImportDialog: component }) => ({ default: component })))
const WeeklyScheduleEditorDialog = lazy(() => import('../weekly-menu/schedule/WeeklyScheduleEditorDialog').then(({ WeeklyScheduleEditorDialog: component }) => ({ default: component })))
import { QueryViewBoundary, type QueryViewEntry } from '@/components/common/QueryViewBoundary';
import { toLabeledQueryView } from '@/lib/labeledQueryView';
const DefaultWeeklyMenuPage = () => {
  const canPublishWeeklyMenu = useHasRole([]);
  const dispatch = useAppDispatch();
  const systemOperation = useSystemOperation();
  const isMaterialReconciliationMode = systemOperation?.mode === 'MATERIAL_RECONCILIATION';
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingWorkflowClose, setPendingWorkflowClose] = useState<null | {
    kind: 'import' | 'editor';
    target: 'import' | 'editor' | null;
  }>(null);
  const reconciliationRouteScope = readReconciliationWeeklyMenuRoute(searchParams);
  const persistedReconciliationScope = readReconciliationSelection();
  const reduxWeeklyMenu = useCoordinationStoreSelector((state) => state.coordination.weeklyMenu);
  const orders = useCoordinationStoreSelector((state) => state.coordination.orders);
  const lockedShifts = useCoordinationStoreSelector((state) => state.coordination.lockedShifts);
  const catalogQuery = useGetDishesCatalogQuery();
  const catalogView = toLabeledQueryView(catalogQuery, 'danh mục món và BOM', {
    instruction: 'Mở kế hoạch tuần để tải danh mục món và BOM.',
  });
  const catalogData = catalogView.phase === 'ready'
    ? catalogView.data
    : catalogView.phase === 'error' ? catalogQuery.currentData : undefined;
  const catalogDishes = useMemo(() => catalogData ?? [], [catalogData]);
  const isCatalogLoading = catalogView.phase === 'loading';
  const isCatalogError = catalogView.phase === 'error' || catalogView.phase === 'forbidden';
  const isCatalogEmpty = catalogView.phase === 'ready' && catalogDishes.length === 0;
  const customersQuery = useGetCoordinationCustomersQuery();
  const customersView = toLabeledQueryView(customersQuery, 'danh sách khách hàng', {
    instruction: 'Mở kế hoạch tuần để tải danh sách khách hàng.',
  });
  const customersResponse = customersView.phase === 'ready'
    ? customersView.data
    : customersView.phase === 'error' ? customersQuery.currentData : undefined;
  const customers = customersResponse?.data ?? [];
  const isCustomerLoading = customersView.phase === 'loading';
  const isCustomerError = customersView.phase === 'error' || customersView.phase === 'forbidden';
  const customerContractsQuery = useGetCustomerContractsQuery(undefined, {
    skip: isMaterialReconciliationMode,
  });
  const customerContractsView = toLabeledQueryView(customerContractsQuery, 'hợp đồng định mức', {
    instruction: 'Mở kế hoạch tuần để tải hợp đồng định mức.',
  });
  const customerContractsResponse = customerContractsView.phase === 'ready'
    ? customerContractsView.data
    : customerContractsView.phase === 'error' ? customerContractsQuery.currentData : undefined;
  const customerContracts = customerContractsResponse?.data ?? [];
  const [selectedMenuCustomerId, setSelectedMenuCustomerId] = useState(
    () => readWeeklyMenuSelection(LAST_WEEKLY_MENU_CUSTOMER_KEY),
  );
  const effectiveMenuCustomerId = isMaterialReconciliationMode
    ? reconciliationRouteScope.customerId || persistedReconciliationScope.customerId || selectedMenuCustomerId
    : selectedMenuCustomerId;
  const [committedMenuWeekStartDate, setCommittedMenuWeekStartDate] = useState(
    getStoredWeekStartDate,
  );
  const effectiveWeekStartDate = isMaterialReconciliationMode
    ? normalizeWeekStartDate(reconciliationRouteScope.weekStartDate || persistedReconciliationScope.weekStartDate || committedMenuWeekStartDate)
    : committedMenuWeekStartDate;
  const weeklyMenuQueryArgs = {
    customerId: effectiveMenuCustomerId,
    weekStartDate: effectiveWeekStartDate || undefined,
  };
  const defaultCommittedMenuQuery = useGetCommittedWeeklyMenuQuery(
    weeklyMenuQueryArgs,
    { skip: isMaterialReconciliationMode || !effectiveMenuCustomerId },
  );
  const reconciliationCommittedMenuQuery = useGetReconciliationWeeklyMenuQuery(
    weeklyMenuQueryArgs,
    { skip: !isMaterialReconciliationMode || !effectiveMenuCustomerId },
  );
  const committedMenuQuery = isMaterialReconciliationMode
    ? reconciliationCommittedMenuQuery
    : defaultCommittedMenuQuery;
  const committedMenuView = toLabeledQueryView(committedMenuQuery, 'thực đơn tuần đã lưu', {
    instruction: 'Chọn khách hàng để tải thực đơn tuần đã lưu.',
  });
  const committedMenuResponse = committedMenuView.phase === 'ready' || committedMenuView.phase === 'error'
    ? committedMenuQuery.currentData ?? committedMenuQuery.data
    : undefined;
  const isCommittedMenuFetching = committedMenuView.phase === 'loading'
    || (committedMenuView.phase === 'ready' && committedMenuView.isRefreshing);
  const committedMenu = committedMenuResponse?.data;
  const committedMenuRows = committedMenu?.rows;
  const displayedWeekStartDate = committedMenu?.weekStartDate?.split('T')[0] || effectiveWeekStartDate || '';
  const menuScheduleWeekStartDate = committedMenu?.weekStartDate?.split('T')[0] ?? (effectiveWeekStartDate || undefined);
  const menuSchedulesQuery = useGetMenuSchedulesQuery(
    {
      customerId: effectiveMenuCustomerId,
      ...(menuScheduleWeekStartDate ? { weekStartDate: menuScheduleWeekStartDate } : {}),
    },
    { skip: !effectiveMenuCustomerId },
  );
  const menuSchedulesView = toLabeledQueryView(menuSchedulesQuery, 'lịch thực đơn', {
    instruction: 'Chọn khách hàng để tải lịch thực đơn.',
  });
  const menuSchedulesResponse = menuSchedulesView.phase === 'ready'
    ? menuSchedulesView.data
    : menuSchedulesView.phase === 'error' ? menuSchedulesQuery.currentData : undefined;
  const menuSchedules = useMemo(() => menuSchedulesResponse?.data ?? [], [menuSchedulesResponse?.data]);
  const [updateMenuScheduleVersion, { isLoading: isPublishingMenu }] = useUpdateMenuScheduleVersionMutation();
  const mealQuantityPlansQuery = useGetMealQuantityPlansQuery(
    {
      customerId: effectiveMenuCustomerId,
      ...(menuScheduleWeekStartDate ? { weekStartDate: menuScheduleWeekStartDate } : {}),
    },
    { skip: !effectiveMenuCustomerId || !menuScheduleWeekStartDate },
  );
  const mealQuantityPlansView = toLabeledQueryView(mealQuantityPlansQuery, 'kế hoạch số suất', {
    instruction: !effectiveMenuCustomerId
      ? 'Chọn khách hàng để tải kế hoạch số suất.'
      : 'Chọn tuần có thực đơn để tải kế hoạch số suất.',
  });
  const mealQuantityPlansResponse = mealQuantityPlansView.phase === 'ready'
    ? mealQuantityPlansView.data
    : mealQuantityPlansView.phase === 'error' ? mealQuantityPlansQuery.currentData : undefined;
  const mealQuantityPlans = useMemo(() => mealQuantityPlansResponse?.data ?? [], [mealQuantityPlansResponse?.data]);
  const incompleteServingPlanCount = useMemo(
    () => mealQuantityPlans.filter((plan) => plan.status.toUpperCase() !== 'COMPLETED').length,
    [mealQuantityPlans],
  );
  const committedMenuDates = useMemo(
    () => (committedMenuRows ? buildImportedDayDates(committedMenuRows) : {}),
    [committedMenuRows],
  );
  const displayDays = useMemo(
    () => DAYS_OF_WEEK.slice(0, 6).map((day, index) => {
      if (committedMenuDates[day.key]) return { ...day, date: committedMenuDates[day.key] };
      if (!displayedWeekStartDate) return { ...day, date: '' };
      const date = new Date(`${displayedWeekStartDate}T00:00:00`);
      date.setDate(date.getDate() + index);
      return { ...day, date: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` };
    }),
    [committedMenuDates, displayedWeekStartDate],
  );
  const committedLayoutRows = useMemo(
    () => buildImportedLayoutRows(committedMenuRows ?? []),
    [committedMenuRows],
  );
  const todayIso = toLocalIsoDate(new Date());
  const activeServiceDay = displayDays.find((day) => parseDisplayDateToIso(day.date) === todayIso);
  const analysisServiceDate = parseDisplayDateToIso(activeServiceDay?.date ?? displayDays[0]?.date ?? '')
    ?? displayedWeekStartDate;
  const activeServiceLabel = activeServiceDay
    ? `${activeServiceDay.label} - ${activeServiceDay.date}`
    : displayedWeekStartDate
      ? `Tuần ${formatImportDate(displayedWeekStartDate)}`
      : 'Chưa chọn tuần';
  const selectedCustomer = customers.find((customer) => customer.customerId === effectiveMenuCustomerId);
  const selectedCustomerContract = customerContracts.find((contract) => contract.customerId === effectiveMenuCustomerId);
  const scheduleMenuPrices = menuSchedules
    .filter((schedule) => !effectiveMenuCustomerId || schedule.customerId === effectiveMenuCustomerId)
    .map((schedule) => schedule.menuPrice)
    .filter((price) => Number.isFinite(price) && price > 0);
  const scheduleFixedTiers = scheduleMenuPrices.filter(isBomPriceTier).map(normalizeBomPriceTier);
  const invalidScheduleMenuPrices = scheduleMenuPrices.filter((price) => !isBomPriceTier(price));
  const contractFixedTier = normalizeBomPriceTier(selectedCustomerContract?.defaultMenuPrice);
  const menuPrice = scheduleFixedTiers[0] ?? contractFixedTier;
  const menuPriceSource = scheduleFixedTiers.length > 0
    ? 'Lịch menu'
    : selectedCustomerContract?.defaultMenuPrice
      ? 'Hợp đồng'
      : 'Mặc định';
  const fixedBomRatePercent = 100;
  useEffect(() => {
    if (committedMenuView.phase !== 'ready') return;
    if (!committedMenu?.importedWeeklyMenu || Object.keys(committedMenu.importedWeeklyMenu).length === 0) {
      dispatch(setWeeklyMenu({}));
      return;
    }

    dispatch(setWeeklyMenu(committedMenu.importedWeeklyMenu));
  }, [committedMenu, committedMenuView.phase, dispatch]);

  const weeklyMenuTabIds = useMemo(() => {
    const locallyVisibleTabs = visibleTabIds('weekly-menu') as WeeklyMenuView[];
    const backendTabs = systemOperation?.capabilities.pageTabs['weekly-menu'] ?? [];
    const primaryTabs = eligiblePageTabs(systemOperation?.mode ?? 'DEFAULT', 'weekly-menu', backendTabs, locallyVisibleTabs) as WeeklyMenuView[];
    return systemOperation?.mode === 'MATERIAL_RECONCILIATION'
      ? primaryTabs
      : [...primaryTabs, ...(['purchase-summary', 'cost', 'dish-materials'] as WeeklyMenuView[]).filter((view) => backendTabs.includes(view))];
  }, [systemOperation?.capabilities.pageTabs, systemOperation?.mode]);
  const requestedDefaultView = searchParams.get('view') as WeeklyMenuView | null;
  const [selectedView, setSelectedView] = useState<WeeklyMenuView>(() =>
    requestedDefaultView && weeklyMenuTabIds.includes(requestedDefaultView) ? requestedDefaultView : weeklyMenuTabIds[0] ?? 'schedule');
  const requestedReconciliationView = reconciliationRouteScope.view;
  const resolvedSelectedView = isMaterialReconciliationMode
    && requestedReconciliationView
    && weeklyMenuTabIds.includes(requestedReconciliationView as WeeklyMenuView)
    ? requestedReconciliationView as WeeklyMenuView
    : !isMaterialReconciliationMode && requestedDefaultView && weeklyMenuTabIds.includes(requestedDefaultView)
      ? requestedDefaultView
      : weeklyMenuTabIds.includes(selectedView)
      ? selectedView
      : weeklyMenuTabIds[0] ?? 'schedule';
  useEffect(() => {
    if (!isMaterialReconciliationMode) return;
    const next = new URLSearchParams(searchParams);
    next.set('view', resolvedSelectedView);
    if (effectiveMenuCustomerId) next.set('customerId', effectiveMenuCustomerId);
    else next.delete('customerId');
    if (effectiveWeekStartDate) next.set('weekStartDate', effectiveWeekStartDate);
    else next.delete('weekStartDate');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [effectiveMenuCustomerId, effectiveWeekStartDate, isMaterialReconciliationMode, resolvedSelectedView, searchParams, setSearchParams]);
  const updateReconciliationScope = (updates: { view?: WeeklyMenuView; customerId?: string; weekStartDate?: string }) => {
    if (!isMaterialReconciliationMode) return;
    const next = new URLSearchParams(searchParams);
    if (updates.view !== undefined) next.set('view', updates.view);
    if (updates.customerId !== undefined) {
      if (updates.customerId) next.set('customerId', updates.customerId);
      else next.delete('customerId');
    }
    if (updates.weekStartDate !== undefined) {
      if (updates.weekStartDate) next.set('weekStartDate', updates.weekStartDate);
      else next.delete('weekStartDate');
    }
    setSearchParams(next);
  };
  const activeView = useDeferredValue(resolvedSelectedView);
  const isViewPending = resolvedSelectedView !== activeView;
  const [menuFeedback, setMenuFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<WeeklyScheduleFeedback | null>(null);

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;

    let cancelled = false;
    let idleHandle: number | undefined;
    const views = weeklyMenuTabIds.filter((view) => view !== 'schedule');
    const preloadNext = () => {
      if (cancelled) return;
      const view = views.shift();
      if (!view) return;
      const run = () => void Promise.resolve(preloadWeeklyMenuView(view))
        .catch(() => undefined)
        .finally(preloadNext);
      idleHandle = window.requestIdleCallback
        ? window.requestIdleCallback(run, { timeout: 1500 })
        : window.setTimeout(run, 100);
    };
    const startHandle = window.setTimeout(preloadNext, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(startHandle);
      if (idleHandle !== undefined) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
    };
  }, [weeklyMenuTabIds]);

  const resetScopedWeeklyMenuUi = () => {
    dispatch(setWeeklyMenu({}));
    setMenuFeedback(null);
    setScheduleFeedback(null);
  };
  const publishableSchedule = menuSchedules.find((schedule) => schedule.menuVersionStatus !== 'ACTIVE');
  const publishWeeklyMenu = async () => {
    if (!publishableSchedule) return;
    try {
      const response = await updateMenuScheduleVersion({
        menuScheduleId: publishableSchedule.menuScheduleId,
        body: { status: 'ACTIVE', reason: 'Xuất bản tuần từ KHSX và định lượng' },
      }).unwrap();
      setMenuFeedback({
        title: 'Đã xuất bản thực đơn tuần',
        message: response.message || 'Toàn bộ lịch thực đơn trong tuần đã chuyển sang trạng thái hoạt động.',
        variant: 'info',
      });
    } catch (error) {
      setMenuFeedback({
        title: 'Chưa thể xuất bản thực đơn tuần',
        message: error instanceof Error ? error.message : 'Không thể cập nhật trạng thái version thực đơn.',
        variant: 'danger',
      });
    }
  };

  const importWorkflow = useWeeklyMenuImport({
    customers,
    isCustomerLoading,
    isCustomerError,
    refetchCustomers: customersQuery.refetch,
    customerId: effectiveMenuCustomerId,
    weekStartDate: effectiveWeekStartDate,
    committedWeekStartDate: committedMenu?.weekStartDate?.split('T')[0],
    menuPrice,
    displayDays,
    todayIso,
    catalogDishes,
    onCustomerCreated: (customerId) => {
      setSelectedMenuCustomerId(customerId);
      resetScopedWeeklyMenuUi();
      writeWeeklyMenuSelection(LAST_WEEKLY_MENU_CUSTOMER_KEY, customerId);
    },
    onMenuCommitted: (result) => {
      writeWeeklyMenuSelection(LAST_WEEKLY_MENU_CUSTOMER_KEY, result.customerId);
      setSelectedMenuCustomerId(result.customerId);
      resetScopedWeeklyMenuUi();
      if (result.weekStartDate) {
        writeWeeklyMenuSelection(LAST_WEEKLY_MENU_WEEK_KEY, result.weekStartDate);
        setCommittedMenuWeekStartDate(result.weekStartDate);
      }
      dispatch(setWeeklyMenu(result.importedWeeklyMenu));
    },
  });

  const weeklyScheduleScope = {
    customerId: effectiveMenuCustomerId,
    customerLabel: selectedCustomer
      ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}`
      : committedMenu?.customerCode ?? 'Chưa chọn',
    weekStartDate: displayedWeekStartDate,
    weekLabel: committedMenu?.weekStartDate
      ? `${formatImportDate(committedMenu.weekStartDate)} - ${formatImportDate(committedMenu.weekEndDate)}`
      : 'Chưa có menu',
    menuPrice,
    fixedBomRatePercent,
    activeServiceLabel,
    activeDayKey: activeServiceDay?.key,
    displayDays,
  };

  const scheduleWorkflow = useWeeklyScheduleEditor({
    scope: weeklyScheduleScope,
    committedRows: committedMenu?.rows ?? [],
    importedMenu: reduxWeeklyMenu,
    mealQuantityPlans,
    menuSchedules,
    orders,
    lockedShifts,
    catalogDishes,
    onMenuFeedback: setMenuFeedback,
    onQuickServingFeedback: setScheduleFeedback,
  });
  const requestedWorkflow = searchParams.get('workflow') as 'import' | 'editor' | null;
  const setWorkflowRoute = useCallback((workflow: 'import' | 'editor' | null, replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (workflow) next.set('workflow', workflow);
    else next.delete('workflow');
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);
  const openImportWorkflow = () => {
    setWorkflowRoute('import');
    importWorkflow.actions.open();
  };
  const closeImportWorkflow = () => {
    setWorkflowRoute(null);
    importWorkflow.actions.close();
  };
  const openScheduleWorkflow = () => {
    setWorkflowRoute('editor');
    scheduleWorkflow.actions.openEditor();
  };
  const closeScheduleWorkflow = () => {
    setWorkflowRoute(null);
    scheduleWorkflow.actions.closeEditor();
  };
  const routedImportWorkflow = {
    ...importWorkflow,
    actions: {
      ...importWorkflow.actions,
      close: closeImportWorkflow,
      onOpenChange: (open: boolean) => open ? openImportWorkflow() : closeImportWorkflow(),
    },
  };
  const routedScheduleWorkflow = {
    ...scheduleWorkflow,
    actions: { ...scheduleWorkflow.actions, closeEditor: closeScheduleWorkflow },
  };
  const productionPlanWorkflow = useWeeklyProductionPlan(
    weeklyScheduleScope,
    activeView === 'production-plan' && Boolean(committedMenu?.weekStartDate),
  );
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes]);
  const dishNamesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish.name])), [catalogDishes]);
  const dishesByName = useMemo(
    () => new Map(catalogDishes.map((dish) => [normalizeDishMatchKey(dish.name), dish])),
    [catalogDishes],
  );

  const weeklyPlanRows = useMemo(() => buildWeeklyPlanRows({
    committedRows: committedMenuRows ?? [],
    displayDays,
    weeklyMenu: scheduleWorkflow.state.weeklyMenu,
    dishesById,
    dishesByName,
    getServiceDate: scheduleWorkflow.presentation.getServiceDate,
    getSlotServingInfo: scheduleWorkflow.presentation.getSlotServingInfo,
    getLinePricing: scheduleWorkflow.presentation.getLinePricing,
  }), [
    committedMenuRows,
    dishesById,
    dishesByName,
    displayDays,
    scheduleWorkflow.presentation.getLinePricing,
    scheduleWorkflow.presentation.getServiceDate,
    scheduleWorkflow.presentation.getSlotServingInfo,
    scheduleWorkflow.state.weeklyMenu,
  ]);
  const weeklyRowsWithBom = useMemo(() => weeklyPlanRows.filter((row) => row.hasCatalogBom), [weeklyPlanRows]);
  const weeklyRowsMissingBom = useMemo(() => weeklyPlanRows.filter((row) => !row.hasCatalogBom), [weeklyPlanRows]);
  const weeklyRowsMissingOperationalServings = useMemo(() => weeklyPlanRows.filter((row) => row.portions <= 0), [weeklyPlanRows]);
  const invalidBomTierCount = invalidScheduleMenuPrices.length;
  const quickServingRows = useMemo(
    () => scheduleWorkflow.presentation.buildQuickServingRows(weeklyPlanRows),
    [scheduleWorkflow.presentation, weeklyPlanRows],
  );
  useEffect(() => {
    if (requestedWorkflow === 'import' && !importWorkflow.state.isOpen) importWorkflow.actions.open();
    if (requestedWorkflow !== 'import' && importWorkflow.state.isOpen) {
      const hasDraft = Boolean(importWorkflow.state.selectedFile)
        || importWorkflow.state.jobs.length > 0
        || Boolean(importWorkflow.state.quickCustomerCode.trim())
        || Boolean(importWorkflow.state.quickCustomerName.trim());
      if (hasDraft) {
        // URL navigation is external state; queue the confirmation state for the next render.
        if (!pendingWorkflowClose) queueMicrotask(() => setPendingWorkflowClose({ kind: 'import', target: requestedWorkflow }));
        setWorkflowRoute('import');
      } else importWorkflow.actions.close();
    }
    if (requestedWorkflow === 'editor' && !scheduleWorkflow.state.isEditorOpen) scheduleWorkflow.actions.openEditor();
    if (requestedWorkflow !== 'editor' && scheduleWorkflow.state.isEditorOpen) {
      const hasDraft = scheduleWorkflow.presentation.pendingChangeCount > 0 || quickServingRows.some((row) => row.hasDraftChange);
      if (hasDraft) {
        // URL navigation is external state; queue the confirmation state for the next render.
        if (!pendingWorkflowClose) queueMicrotask(() => setPendingWorkflowClose({ kind: 'editor', target: requestedWorkflow }));
        setWorkflowRoute('editor');
      } else scheduleWorkflow.actions.closeEditor();
    }
  }, [importWorkflow.actions, importWorkflow.state.isOpen, importWorkflow.state.jobs.length, importWorkflow.state.quickCustomerCode, importWorkflow.state.quickCustomerName, importWorkflow.state.selectedFile, pendingWorkflowClose, quickServingRows, requestedWorkflow, scheduleWorkflow.actions, scheduleWorkflow.presentation.pendingChangeCount, scheduleWorkflow.state.isEditorOpen, setWorkflowRoute]);
  const materialSummary = buildPlanRowsMaterialSummary(weeklyPlanRows, dishesById, dishesByName, {
    customerId: effectiveMenuCustomerId,
    priceTier: menuPrice,
  });

  const demandWorkflow = useMaterialDemand({
    enabled: !isMaterialReconciliationMode && activeView === 'demand',
    stalenessEnabled: !isMaterialReconciliationMode && activeView === 'demand',
    scope: weeklyScheduleScope,
    reportDateFrom: committedMenu?.weekStartDate?.split('T')[0],
    reportDateTo: committedMenu?.weekEndDate?.split('T')[0],
    sourceMenuValue: selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'Chưa chọn',
    customerCode: selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN',
    customerLabel: weeklyScheduleScope.customerLabel,
    materialSummaryCount: Object.keys(materialSummary).length,
    weeklyPlanRows,
    invalidScheduleMenuPrices,
    quickServingRows,
    dishesById,
    dishesByName,
  });
  const demandLines = demandWorkflow.presentation.demandLines;
  const aggregatedDemandLines = demandWorkflow.presentation.aggregatedDemandLines;
  const demandReadinessResult = useGetIngredientDemandAggregatePageQuery({
    customerId: weeklyScheduleScope.customerId,
    dateFrom: weeklyScheduleScope.weekStartDate || undefined,
    dateTo: committedMenu?.weekEndDate?.split('T')[0],
    pageNumber: 1,
    pageSize: 10,
  }, {
    skip: isMaterialReconciliationMode
      || !weeklyScheduleScope.customerId
      || !weeklyScheduleScope.weekStartDate
      || !committedMenu?.weekEndDate,
  });
  const readiness = buildWeeklyMenuReadiness({
    hasSelectedCustomer: Boolean(effectiveMenuCustomerId),
    isSyncing: isCatalogLoading || isCommittedMenuFetching || demandReadinessResult.isLoading,
    hasCatalogIssue: isCatalogError || isCatalogEmpty,
    hasDemandIssue: !isMaterialReconciliationMode && demandReadinessResult.isError,
    menuCount: weeklyPlanRows.length,
    missingServingCount: weeklyRowsMissingOperationalServings.length,
    missingBomCount: weeklyRowsMissingBom.length,
    invalidBomTierCount,
    demandMaterialCount: demandReadinessResult.data?.totalCount ?? 0,
    // Readiness retains the compatibility calculation/lifecycle signal, not physical issue backlog.
    demandShortageCount: demandReadinessResult.data?.shortageCount ?? 0,
  });
  const readOnlyScopeKey = `${weeklyScheduleScope.customerId}:${weeklyScheduleScope.weekStartDate}`;
  const sourceLabel = selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'Chưa chọn';
  const menuCostWorkflow = useMenuCost({
    scope: weeklyScheduleScope, sourceLabel, weeklyPlanRows, dishesById, dishesByName,
  });
  const purchaseSummaryWorkflow = usePurchaseSummary({
    enabled: activeView === 'purchase-summary',
    scopeKey: readOnlyScopeKey,
    customerId: weeklyScheduleScope.customerId,
    customerCode: selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN',
    customerLabel: sourceLabel,
    weekStartDate: weeklyScheduleScope.weekStartDate,
    weekLabel: weeklyScheduleScope.weekLabel,
    materialSummary,
    demandLines,
    aggregatedDemandLines,
  });
  const dishMaterialsWorkflow = useDishMaterials({
    scopeKey: readOnlyScopeKey,
    sourceLabel,
    menuPrice,
    customerId: effectiveMenuCustomerId,
    serviceDate: analysisServiceDate,
    catalogDishes,
    weeklyRowsWithBom,
    dishesById,
  });
  const weeklyMenuQueries: QueryViewEntry[] = [
    { label: 'danh mục món và BOM', view: catalogView },
    { label: 'danh sách khách hàng', view: customersView },
    { label: 'thực đơn tuần đã lưu', view: committedMenuView },
    ...(!isMaterialReconciliationMode ? [{ label: 'hợp đồng định mức', view: customerContractsView }] : []),
    { label: 'lịch thực đơn', view: menuSchedulesView },
    { label: 'kế hoạch số suất', view: mealQuantityPlansView },
  ];
  return (

    <OperationalFrame

      command={<WeeklyMenuCommandBar
        customers={customers}
        selectedCustomerId={effectiveMenuCustomerId}
        weekStartDate={displayedWeekStartDate}
        isCustomerLoading={isCustomerLoading}
        isImporting={importWorkflow.status.isImporting}
        canPublish={canPublishWeeklyMenu && Boolean(publishableSchedule)}
        isPublishing={isPublishingMenu}
        onEdit={openScheduleWorkflow}
        onImport={openImportWorkflow}
        onExport={isMaterialReconciliationMode ? undefined : purchaseSummaryWorkflow.actions.exportWarehouseReport}
        onPublish={() => void publishWeeklyMenu()}
        onCustomerChange={(customerId) => {
          setSelectedMenuCustomerId(customerId);
          updateReconciliationScope({ customerId });
          resetScopedWeeklyMenuUi();
          writeWeeklyMenuSelection(LAST_WEEKLY_MENU_CUSTOMER_KEY, customerId);
        }}
        onWeekChange={(weekStartDate) => {
          const normalizedWeekStartDate = normalizeWeekStartDate(weekStartDate);
          setCommittedMenuWeekStartDate(normalizedWeekStartDate);
          updateReconciliationScope({ weekStartDate: normalizedWeekStartDate });
          resetScopedWeeklyMenuUi();
          writeWeeklyMenuSelection(LAST_WEEKLY_MENU_WEEK_KEY, normalizedWeekStartDate);
        }}
      />}
      context={isMaterialReconciliationMode ? undefined : <WeeklyMenuPricingContext menuPrice={menuPrice} menuPriceSource={menuPriceSource} />}
    >
      <QueryViewBoundary preserveFallback noticePlacement="overlay" queries={weeklyMenuQueries} refreshLabel="Đang cập nhật kế hoạch tuần">
        <WeeklyMenuReadiness readiness={readiness} />
        <WeeklyMenuNavigation
          mode={systemOperation?.mode ?? 'DEFAULT'}
          views={weeklyMenuTabIds}
          activeView={resolvedSelectedView}
          onViewChange={(view) => {
            setSelectedView(view);
            if (isMaterialReconciliationMode) updateReconciliationScope({ view });
            else {
              const next = new URLSearchParams(searchParams);
              next.set('view', view);
              setSearchParams(next);
            }
          }}
        />
        <WeeklyMenuAlerts
          invalidBomTierCount={invalidBomTierCount}
          menuFeedback={menuFeedback}
          purchaseFeedback={purchaseSummaryWorkflow.state.feedback}
          isCatalogLoading={isCatalogLoading}
          isCatalogError={isCatalogError}
          isCatalogEmpty={isCatalogEmpty}
          isCommittedMenuFetching={isCommittedMenuFetching}
          hasSelectedCustomer={Boolean(effectiveMenuCustomerId)}
        />

        {(requestedWorkflow === 'import' || importWorkflow.state.isOpen) && (
          <Suspense fallback={null}><WeeklyMenuImportDialog workflow={routedImportWorkflow} /></Suspense>
        )}
        {(requestedWorkflow === 'editor' || scheduleWorkflow.state.isEditorOpen) && (
          <Suspense fallback={null}><WeeklyScheduleEditorDialog workflow={routedScheduleWorkflow} servingRows={quickServingRows} layoutRows={committedLayoutRows} isLoading={isCatalogLoading || isCommittedMenuFetching || mealQuantityPlansView.phase === 'loading' || menuSchedulesView.phase === 'loading'} /></Suspense>
        )}
        <ConfirmDialog
          open={pendingWorkflowClose !== null}
          title="Rời khỏi thay đổi chưa lưu?"
          description={pendingWorkflowClose?.kind === 'import'
            ? 'Các file và thông tin nhập thực đơn chưa lưu sẽ bị bỏ.'
            : 'Các thay đổi lịch tuần và số suất chưa lưu sẽ bị bỏ.'}
          confirmLabel="Rời khỏi"
          variant="destructive"
          onOpenChange={(open) => {
            if (!open) setPendingWorkflowClose(null);
          }}
          onConfirm={() => {
            const pending = pendingWorkflowClose;
            setPendingWorkflowClose(null);
            if (pending?.kind === 'import') importWorkflow.actions.close();
            if (pending?.kind === 'editor') scheduleWorkflow.actions.closeEditor();
            setWorkflowRoute(pending?.target ?? null);
          }}
        />
        <div
          data-weekly-menu-work-surface="true"
          className={`${typography.body} relative`}
          aria-busy={isViewPending}
          aria-live="polite"
        >
          {isViewPending && (
            <RefreshStatus>Đang cập nhật</RefreshStatus>
          )}
          {isMaterialReconciliationMode && activeView === 'demand' ? <ClosedLoopTransferPanel
            menuVersionId={committedMenu?.menuVersionId}
            menuVersionStatus={committedMenu?.menuVersionStatus}
            isPublishingMenu={isPublishingMenu}
            onPublishMenu={() => void publishWeeklyMenu()}
            incompleteServingPlanCount={incompleteServingPlanCount}
            onEditServings={openScheduleWorkflow}
            canInitializeTolerance={canPublishWeeklyMenu}
            scopeLabel={selectedCustomer && displayedWeekStartDate
              ? `${selectedCustomer.customerCode} · tuần ${formatImportDate(displayedWeekStartDate)}`
              : 'Chọn khách hàng và tuần'}
          /> : <WeeklyMenuViewContent
            activeView={activeView}
            scope={weeklyScheduleScope}
            hasCommittedWeek={Boolean(committedMenu?.weekStartDate)}
            committedRows={committedLayoutRows}
            dishNamesById={dishNamesById}
            scheduleWorkflow={scheduleWorkflow}
            productionPlanWorkflow={productionPlanWorkflow}
            demandWorkflow={demandWorkflow}
            servingFeedback={scheduleFeedback}
            menuCostWorkflow={menuCostWorkflow}
            purchaseSummaryWorkflow={purchaseSummaryWorkflow}
            dishMaterialsWorkflow={dishMaterialsWorkflow}
          />}
        </div>
      </QueryViewBoundary>
    </OperationalFrame>
  );
};

export default function WeeklyMenuPage() {
  return <DefaultWeeklyMenuPage />;
}
