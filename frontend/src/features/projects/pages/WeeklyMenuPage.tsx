import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setWeeklyMenu } from '../../coordination/coordinationSlice';
import { ContextStrip, OperationalFrame, ViewSwitcher } from '@/components/common';
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
import { WeeklyScheduleSection } from '../weekly-menu/schedule/WeeklyScheduleSection';
import type { WeeklyScheduleFeedback } from '../weekly-menu/schedule/types';
import { useWeeklyProductionPlan } from '../weekly-menu/production-plan/useWeeklyProductionPlan';
import { ProductionPlanSection } from '../weekly-menu/production-plan/ProductionPlanSection';
import { useMaterialDemand } from '../weekly-menu/demand/useMaterialDemand';
import { MaterialDemandSection } from '../weekly-menu/demand/MaterialDemandSection';
import { useMenuCost } from '../weekly-menu/cost/useMenuCost';
import { usePurchaseSummary } from '../weekly-menu/purchasing/usePurchaseSummary';
import { useDishMaterials } from '../weekly-menu/dish-materials/useDishMaterials';
import { buildWeeklyPlanRows } from '../weekly-menu/cost/weeklyPlanRowsModel';
import { WeeklyMenuCommandBar, WeeklyMenuPricingContext } from '../weekly-menu/shell/WeeklyMenuCommandBar';
import { WeeklyMenuAlerts } from '../weekly-menu/shell/WeeklyMenuAlerts';

const MenuCostSection = lazy(() => import('../weekly-menu/cost/MenuCostSection'));
const PurchaseSummarySection = lazy(() => import('../weekly-menu/purchasing/PurchaseSummarySection'));
const DishMaterialsSection = lazy(() => import('../weekly-menu/dish-materials/DishMaterialsSection'));

const ReadOnlySectionFallback = ({ label }: { label: string }) => (
  <section aria-busy="true" aria-live="polite" className="min-h-[560px] rounded-lg border border-slate-200 bg-white p-6">
    <span className="text-sm font-medium text-slate-600">Đang tải {label}...</span>
  </section>
);

const WeeklyMenuPage = () => {
  const dispatch = useAppDispatch();
  const reduxWeeklyMenu = useAppSelector((state) => state.coordination.weeklyMenu);
  const orders = useAppSelector((state) => state.coordination.orders);
  const lockedShifts = useAppSelector((state) => state.coordination.lockedShifts);
  const {
    data: catalogDishes = [],
    isLoading: isCatalogLoading,
    isError: isCatalogError,
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

  const [activeView, setActiveView] = useState<WeeklyMenuView>('schedule');
  const [menuFeedback, setMenuFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<WeeklyScheduleFeedback | null>(null);

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
  const productionPlanWorkflow = useWeeklyProductionPlan(weeklyScheduleScope);
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes]);
  const dishesByName = useMemo(
    () => new Map(catalogDishes.map((dish) => [normalizeDishMatchKey(dish.name), dish])),
    [catalogDishes],
  );

  const weeklyPlanRows = buildWeeklyPlanRows({
    committedRows: committedMenu?.rows ?? [],
    displayDays,
    weeklyMenu: scheduleWorkflow.state.weeklyMenu,
    dishesById,
    dishesByName,
    getServiceDate: scheduleWorkflow.presentation.getServiceDate,
    getSlotServingInfo: scheduleWorkflow.presentation.getSlotServingInfo,
    getLinePricing: scheduleWorkflow.presentation.getLinePricing,
  });
  const weeklyRowsWithBom = weeklyPlanRows.filter((row) => row.hasCatalogBom);
  const weeklyRowsMissingBom = weeklyPlanRows.filter((row) => !row.hasCatalogBom);
  const weeklyRowsMissingOperationalServings = weeklyPlanRows.filter((row) => row.portions <= 0);
  const invalidBomTierCount = invalidScheduleMenuPrices.length;
  const quickServingRows = scheduleWorkflow.presentation.buildQuickServingRows(weeklyPlanRows);
  const materialSummary = buildPlanRowsMaterialSummary(weeklyPlanRows, dishesById, dishesByName);

  const demandWorkflow = useMaterialDemand({
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
  const workflowStepItems: Array<{ label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = [
    { label: 'Menu', value: weeklyPlanRows.length.toString(), tone: weeklyPlanRows.length ? 'success' : 'neutral' },
    { label: 'Số lượng khách', value: weeklyRowsMissingOperationalServings.length ? `${weeklyRowsMissingOperationalServings.length} thiếu` : 'Đủ', tone: weeklyRowsMissingOperationalServings.length ? 'warning' : 'success' },
    { label: 'Định lượng', value: weeklyRowsMissingBom.length ? `${weeklyRowsMissingBom.length} thiếu BOM` : 'Đủ BOM', tone: weeklyRowsMissingBom.length ? 'danger' : 'success' },
    { label: 'Đề xuất mua', value: demandLines.length ? `${aggregatedDemandLines.length} dòng` : 'Chờ demand', tone: demandLines.length ? 'info' : 'neutral' },
    { label: 'Tồn kho/cảnh báo', value: invalidBomTierCount ? `${invalidBomTierCount} sai tier` : 'OK', tone: invalidBomTierCount ? 'danger' : 'success' },
  ];
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
    scopeKey: readOnlyScopeKey, sourceLabel, menuPrice, catalogDishes, weeklyRowsWithBom, dishesById,
  });
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
        activeTab={activeView}
        onTabChange={(tabId) => setActiveView(tabId as WeeklyMenuView)}
      />
      <ContextStrip items={workflowStepItems} />
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

      {activeView === 'schedule' && (
        <WeeklyScheduleSection
          scope={weeklyScheduleScope}
          customerValue={weeklyScheduleScope.customerLabel}
          weekValue={weeklyScheduleScope.weekLabel}
          hasCommittedWeek={Boolean(committedMenu?.weekStartDate)}
          rows={committedLayoutRows}
        />
      )}
      {activeView === 'production-plan' && (
        <ProductionPlanSection workflow={productionPlanWorkflow} />
      )}
      {activeView === 'demand' && (
        <MaterialDemandSection
          workflow={demandWorkflow}
          scheduleWorkflow={scheduleWorkflow}
          servingFeedback={scheduleFeedback}
        />
      )}

      {/* Phân tích định lượng & giá vốn 1 khay ăn (Step 2) */}
      {activeView === 'cost' && (
        <Suspense fallback={<ReadOnlySectionFallback label="giá vốn" />}>
          <MenuCostSection workflow={menuCostWorkflow} />
        </Suspense>
      )}

      {activeView === 'purchase-summary' && (
        <Suspense fallback={<ReadOnlySectionFallback label="tổng hợp mua" />}>
          <PurchaseSummarySection workflow={purchaseSummaryWorkflow} />
        </Suspense>
      )}

      {activeView === 'dish-materials' && (
        <Suspense fallback={<ReadOnlySectionFallback label="nguyên liệu món" />}>
          <DishMaterialsSection workflow={dishMaterialsWorkflow} />
        </Suspense>
      )}


      <WeeklyMenuImportDialog workflow={importWorkflow} />

      <WeeklyScheduleEditorDialog workflow={scheduleWorkflow} />

    </OperationalFrame>
  );
};

export default WeeklyMenuPage;
