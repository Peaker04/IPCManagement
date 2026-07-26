import { Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setWeeklyMenu } from '../../coordination/coordinationSlice';
import { OperationalFrame, QueryErrorAlert, ViewSwitcher } from '@/components/common';
import { DAYS_OF_WEEK_WITH_DATES as DEFAULT_DAYS_OF_WEEK } from '@/lib/constants';
import { useGetDishesCatalogQuery } from '../dishCatalogApi';
import {
  useGetCoordinationCustomersQuery,
  useGetCustomerContractsQuery,
  useGetCommittedWeeklyMenuQuery,
  useGetMealQuantityPlansQuery,
  useGetMenuSchedulesQuery,
} from '../../coordination/coordinationApi';
import { isBomPriceTier, normalizeBomPriceTier } from '../weeklyMenuPlanning';
import {
  formatImportDate,
  getStoredWeekStartDate,
  LAST_WEEKLY_MENU_CUSTOMER_KEY,
  LAST_WEEKLY_MENU_WEEK_KEY,
  normalizeDishMatchKey,
  parseDisplayDateToIso,
  toLocalIsoDate,
} from '../weekly-menu/model/formatters';
import {
  buildImportedDayDates,
  buildImportedLayoutRows,
  buildPlanRowsMaterialSummary,
} from '../weekly-menu/model/scope';
import type { WeeklyMenuView } from '../weekly-menu/model/types';
import { useWeeklyMenuImport } from '../weekly-menu/import/useWeeklyMenuImport';
import { WeeklyMenuImportDialog } from '../weekly-menu/import/WeeklyMenuImportDialog';
import { useWeeklyScheduleEditor } from '../weekly-menu/schedule/useWeeklyScheduleEditor';
import { WeeklyScheduleEditorDialog } from '../weekly-menu/schedule/WeeklyScheduleEditorDialog';
import type { WeeklyScheduleFeedback } from '../weekly-menu/schedule/types';
import { useWeeklyProductionPlan } from '../weekly-menu/production-plan/useWeeklyProductionPlan';
import { useMaterialDemand } from '../weekly-menu/demand/useMaterialDemand';
import { useMenuCost } from '../weekly-menu/cost/useMenuCost';
import { usePurchaseSummary } from '../weekly-menu/purchasing/usePurchaseSummary';
import { useDishMaterials } from '../weekly-menu/dish-materials/useDishMaterials';
import { buildWeeklyPlanRows } from '../weekly-menu/cost/weeklyPlanRowsModel';
import { WeeklyMenuCommandBar, WeeklyMenuPricingContext } from '../weekly-menu/shell/WeeklyMenuCommandBar';
import { WeeklyMenuAlerts } from '../weekly-menu/shell/WeeklyMenuAlerts';
import { WeeklyMenuReadiness } from '../weekly-menu/shell/WeeklyMenuReadiness';
import { WeeklyMenuViewContent } from '../weekly-menu/shell/WeeklyMenuViewContent';
import { preloadWeeklyMenuView } from '../weekly-menu/shell/weeklyMenuViewPreload';
import { buildWeeklyMenuReadiness } from '../weekly-menu/model/readiness';

const WeeklyMenuPage = () => {
  const dispatch = useAppDispatch();
  const reduxWeeklyMenu = useAppSelector((state) => state.coordination.weeklyMenu);
  const orders = useAppSelector((state) => state.coordination.orders);
  const lockedShifts = useAppSelector((state) => state.coordination.lockedShifts);
  const {
    data: catalogDishes = [],
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    isFetching: isCatalogFetching,
    refetch: refetchCatalog,
  } = useGetDishesCatalogQuery();
  const isCatalogEmpty = !isCatalogLoading && !isCatalogError && catalogDishes.length === 0;

  const {
    data: customerResponse,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
    refetch: refetchCustomers,
  } = useGetCoordinationCustomersQuery();
  const customers = customerResponse?.data ?? [];
  const { data: customerContractsResponse } = useGetCustomerContractsQuery();
  const customerContracts = customerContractsResponse?.data ?? [];
  const [selectedMenuCustomerId, setSelectedMenuCustomerId] = useState(
    () => window.localStorage.getItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) ?? '',
  );
  const effectiveMenuCustomerId = selectedMenuCustomerId;
  const [committedMenuWeekStartDate, setCommittedMenuWeekStartDate] = useState(
    getStoredWeekStartDate,
  );
  const {
    currentData: committedMenuResponse,
    isFetching: isCommittedMenuFetching,
    isError: isCommittedMenuError,
    refetch: refetchCommittedMenu,
  } = useGetCommittedWeeklyMenuQuery(
    {
      customerId: effectiveMenuCustomerId,
      weekStartDate: committedMenuWeekStartDate || undefined,
    },
    { skip: !effectiveMenuCustomerId },
  );
  const committedMenu = committedMenuResponse?.data;
  const displayedWeekStartDate = committedMenuWeekStartDate || committedMenu?.weekStartDate?.split('T')[0] || '';
  const menuScheduleWeekStartDate = committedMenu?.weekStartDate?.split('T')[0] ?? (committedMenuWeekStartDate || undefined);
  const {
    currentData: menuSchedulesResponse,
    isFetching: isMenuSchedulesFetching,
    isError: isMenuSchedulesError,
    refetch: refetchMenuSchedules,
  } = useGetMenuSchedulesQuery(
    {
      customerId: effectiveMenuCustomerId,
      ...(menuScheduleWeekStartDate ? { weekStartDate: menuScheduleWeekStartDate } : {}),
    },
    { skip: !effectiveMenuCustomerId },
  );
  const menuSchedules = useMemo(() => menuSchedulesResponse?.data ?? [], [menuSchedulesResponse?.data]);
  const {
    currentData: mealQuantityPlansResponse,
    isFetching: isMealQuantityPlansFetching,
    isError: isMealQuantityPlansError,
    refetch: refetchMealQuantityPlans,
  } = useGetMealQuantityPlansQuery(
    {
      customerId: effectiveMenuCustomerId,
      ...(menuScheduleWeekStartDate ? { weekStartDate: menuScheduleWeekStartDate } : {}),
    },
    { skip: !effectiveMenuCustomerId || !menuScheduleWeekStartDate },
  );
  const mealQuantityPlans = useMemo(() => mealQuantityPlansResponse?.data ?? [], [mealQuantityPlansResponse?.data]);
  const committedMenuDates = useMemo(
    () => (committedMenu?.rows ? buildImportedDayDates(committedMenu.rows) : {}),
    [committedMenu],
  );
  const displayDays = useMemo(
    () => DEFAULT_DAYS_OF_WEEK.map((day) => ({
      ...day,
      date: committedMenuDates[day.key] ?? day.date,
    })),
    [committedMenuDates],
  );
  const committedLayoutRows = useMemo(
    () => buildImportedLayoutRows(committedMenu?.rows ?? []),
    [committedMenu],
  );
  const todayIso = toLocalIsoDate(new Date());
  const activeServiceDay = displayDays.find((day) => parseDisplayDateToIso(day.date) === todayIso);
  const analysisServiceDate = parseDisplayDateToIso(activeServiceDay?.date ?? displayDays[0]?.date ?? '')
    ?? displayedWeekStartDate;
  const activeServiceLabel = activeServiceDay
    ? `${activeServiceDay.label} - ${activeServiceDay.date}`
    : `Ngoài tuần menu (${formatImportDate(todayIso)})`;
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
    if (!committedMenu?.importedWeeklyMenu || Object.keys(committedMenu.importedWeeklyMenu).length === 0) {
      dispatch(setWeeklyMenu({}));
      return;
    }

    dispatch(setWeeklyMenu(committedMenu.importedWeeklyMenu));
  }, [committedMenu, dispatch]);

  const [selectedView, setSelectedView] = useState<WeeklyMenuView>('schedule');
  const activeView = useDeferredValue(selectedView);
  const isViewPending = selectedView !== activeView;
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
    const views: WeeklyMenuView[] = ['demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials'];
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
  }, []);

  const resetScopedWeeklyMenuUi = () => {
    dispatch(setWeeklyMenu({}));
    setMenuFeedback(null);
    setScheduleFeedback(null);
  };

  const importWorkflow = useWeeklyMenuImport({
    customers,
    isCustomerLoading,
    isCustomerError,
    refetchCustomers,
    customerId: effectiveMenuCustomerId,
    weekStartDate: committedMenuWeekStartDate,
    committedWeekStartDate: committedMenu?.weekStartDate?.split('T')[0],
    menuPrice,
    displayDays,
    todayIso,
    onCustomerCreated: (customerId) => {
      setSelectedMenuCustomerId(customerId);
      resetScopedWeeklyMenuUi();
      window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, customerId);
    },
    onMenuCommitted: (result) => {
      window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, result.customerId);
      setSelectedMenuCustomerId(result.customerId);
      resetScopedWeeklyMenuUi();
      if (result.weekStartDate) {
        window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, result.weekStartDate);
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
  const productionPlanWorkflow = useWeeklyProductionPlan(
    weeklyScheduleScope,
    activeView === 'production-plan' && Boolean(committedMenu?.weekStartDate),
  );
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes]);
  const dishesByName = useMemo(
    () => new Map(catalogDishes.map((dish) => [normalizeDishMatchKey(dish.name), dish])),
    [catalogDishes],
  );

  const weeklyPlanRows = useMemo(() => buildWeeklyPlanRows({
    committedRows: committedMenu?.rows ?? [],
    displayDays,
    weeklyMenu: scheduleWorkflow.state.weeklyMenu,
    dishesById,
    dishesByName,
    getServiceDate: scheduleWorkflow.presentation.getServiceDate,
    getSlotServingInfo: scheduleWorkflow.presentation.getSlotServingInfo,
    getLinePricing: scheduleWorkflow.presentation.getLinePricing,
  }), [
    committedMenu?.rows,
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
  const materialSummary = buildPlanRowsMaterialSummary(weeklyPlanRows, dishesById, dishesByName, {
    customerId: effectiveMenuCustomerId,
    priceTier: menuPrice,
  });

  const demandWorkflow = useMaterialDemand({
    enabled: activeView === 'demand' || activeView === 'purchase-summary',
    stalenessEnabled: activeView === 'demand',
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
  });
  const demandLines = demandWorkflow.presentation.demandLines;
  const aggregatedDemandLines = demandWorkflow.presentation.aggregatedDemandLines;
  const readiness = buildWeeklyMenuReadiness({
    hasSelectedCustomer: Boolean(effectiveMenuCustomerId),
    isSyncing: isCatalogLoading || isCommittedMenuFetching,
    hasCatalogIssue: isCatalogError || isCatalogEmpty,
    menuCount: weeklyPlanRows.length,
    missingServingCount: weeklyRowsMissingOperationalServings.length,
    missingBomCount: weeklyRowsMissingBom.length,
    invalidBomTierCount,
    demandMaterialCount: demandLines.length ? aggregatedDemandLines.length : 0,
  });
  const readOnlyScopeKey = `${weeklyScheduleScope.customerId}:${weeklyScheduleScope.weekStartDate}`;
  const sourceLabel = selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'Chưa chọn';
  const menuCostWorkflow = useMenuCost({
    scope: weeklyScheduleScope, sourceLabel, weeklyPlanRows, dishesById, dishesByName,
  });
  const purchaseSummaryWorkflow = usePurchaseSummary({
    scopeKey: readOnlyScopeKey,
    customerCode: selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN',
    customerLabel: sourceLabel,
    weekStartDate: committedMenuWeekStartDate,
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
  const hasWeeklyMenuQueryError = isCatalogError || isCustomerError || isCommittedMenuError || isMenuSchedulesError || isMealQuantityPlansError;
  const isRetryingWeeklyMenu = isCatalogFetching || isCustomerLoading || isCommittedMenuFetching || isMenuSchedulesFetching || isMealQuantityPlansFetching;
  const retryWeeklyMenu = () => {
    const requests: Array<PromiseLike<unknown>> = [refetchCatalog(), refetchCustomers()];
    if (effectiveMenuCustomerId) {
      requests.push(refetchCommittedMenu(), refetchMenuSchedules());
      if (menuScheduleWeekStartDate) requests.push(refetchMealQuantityPlans());
    }
    return Promise.all(requests);
  };
  return (

    <OperationalFrame

      command={<WeeklyMenuCommandBar
        customers={customers}
        selectedCustomerId={selectedMenuCustomerId}
        weekStartDate={displayedWeekStartDate}
        isCustomerLoading={isCustomerLoading}
        isImporting={importWorkflow.status.isImporting}
        onEdit={scheduleWorkflow.actions.openEditor}
        onImport={importWorkflow.actions.open}
        onExport={purchaseSummaryWorkflow.actions.exportWarehouseReport}
        onCustomerChange={(customerId) => {
          setSelectedMenuCustomerId(customerId);
          setCommittedMenuWeekStartDate('');
          resetScopedWeeklyMenuUi();
          if (customerId) window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, customerId);
          else window.localStorage.removeItem(LAST_WEEKLY_MENU_CUSTOMER_KEY);
          window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
        }}
        onWeekChange={(weekStartDate) => {
          setCommittedMenuWeekStartDate(weekStartDate);
          resetScopedWeeklyMenuUi();
          if (weekStartDate) window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, weekStartDate);
          else window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
        }}
      />}
      context={<WeeklyMenuPricingContext menuPrice={menuPrice} menuPriceSource={menuPriceSource} />}
    >
      {hasWeeklyMenuQueryError && (
        <QueryErrorAlert
          title="Không tải đủ dữ liệu kế hoạch tuần"
          isRetrying={isRetryingWeeklyMenu}
          onRetry={retryWeeklyMenu}
        >
          Menu, số suất hoặc danh mục BOM đang gián đoạn. Dữ liệu hiện có chỉ dùng để đối chiếu; hãy thử tải lại trước khi nhập, sửa hoặc tạo demand.
        </QueryErrorAlert>
      )}
      <ViewSwitcher
        ariaLabel="Chọn góc nhìn kế hoạch tuần"
        tabs={[
          { id: 'schedule', label: 'Kế hoạch tuần' },
          { id: 'demand', label: 'Nhu cầu' },
          { id: 'production-plan', label: 'Kế hoạch sản xuất' },
          { id: 'purchase-summary', label: 'Tổng hợp mua' },
          { id: 'cost', label: 'Giá vốn' },
          { id: 'dish-materials', label: 'Nguyên liệu món' },
        ]}
        activeTab={selectedView}
        onTabChange={(tabId) => setSelectedView(tabId as WeeklyMenuView)}
      />
      <WeeklyMenuReadiness readiness={readiness} />
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

      <div
        className="relative min-h-[420px] transition-opacity duration-150 motion-reduce:transition-none"
        aria-busy={isViewPending}
        aria-live="polite"
      >
        {isViewPending && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm">
            Đang cập nhật
          </span>
        )}
        <Suspense fallback={(
          <section aria-busy="true" className="min-h-[420px] rounded-lg border border-slate-200 bg-white p-6">
            <span className="text-sm font-medium text-slate-600">Đang chuẩn bị nội dung...</span>
          </section>
        )}>
          <WeeklyMenuViewContent
            activeView={activeView}
            scope={weeklyScheduleScope}
            hasCommittedWeek={Boolean(committedMenu?.weekStartDate)}
            committedRows={committedLayoutRows}
            scheduleWorkflow={scheduleWorkflow}
            productionPlanWorkflow={productionPlanWorkflow}
            demandWorkflow={demandWorkflow}
            servingFeedback={scheduleFeedback}
            menuCostWorkflow={menuCostWorkflow}
            purchaseSummaryWorkflow={purchaseSummaryWorkflow}
            dishMaterialsWorkflow={dishMaterialsWorkflow}
          />
        </Suspense>
      </div>


      {importWorkflow.state.isOpen && <WeeklyMenuImportDialog workflow={importWorkflow} />}

      {scheduleWorkflow.state.isEditorOpen && <WeeklyScheduleEditorDialog workflow={scheduleWorkflow} />}

    </OperationalFrame>
  );
};

export default WeeklyMenuPage;
