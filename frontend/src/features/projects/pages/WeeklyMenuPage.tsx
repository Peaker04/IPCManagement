import { useEffect, useMemo, useState } from 'react';
import { Scale, Edit, ShoppingCart, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setWeeklyMenu } from '../../coordination/coordinationSlice';
import { CommandBar, ContextStrip, FieldRow, InlineAlert, OperationalFrame, PaginationBar, SectionPanel, StatusBadge, Toolbar, ViewSwitcher } from '@/components/common';
import { TableViewport } from '@/components/common';
import type { DemandLine } from '@/features/workflow';
import { DAYS_OF_WEEK_WITH_DATES as DEFAULT_DAYS_OF_WEEK } from '@/lib/constants';
import { formatCurrency, formatQuantityWithUnit } from '@/lib/formatters';
import { useGetDishesCatalogQuery } from '../dishCatalogApi';
import {
  useGetCoordinationCustomersQuery,
  useGetCustomerContractsQuery,
  useGetCommittedWeeklyMenuQuery,
  useGetMealQuantityPlansQuery,
  useGetMenuSchedulesQuery,
} from '../../coordination/coordinationApi';
import {
  formatBomTierLabel,
  isBomPriceTier,
  normalizeBomPriceTier,
} from '../weeklyMenuPlanning';
import {
  formatImportDate,
  formatMaterialDishSource,
  formatMenuDishName,
  formatQuantityVariance,
  getStoredWeekStartDate,
  getShiftLabel,
  getVariantLabel,
  importSlotLabels,
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
  calculateTotalMaterialCost,
  getNormalizedSlotType,
  isWeeklyMenuRowContinuation,
  matchesShift,
  SECTIONS,
} from '../weekly-menu/model/scope';
import type {
  PurchaseSummaryMaterialEntry,
  WeeklyMenuView,
  WeeklyPlanRow,
} from '../weekly-menu/model/types';
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

const tableHeadClass = 'text-center';
const tableCellClass = 'text-center';
const PURCHASE_SUMMARY_PAGE_SIZE = 10;

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

  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [activeView, setActiveView] = useState<WeeklyMenuView>('schedule');
  const [selectedCostDayKey, setSelectedCostDayKey] = useState<string | null>(null);
  const [purchaseSummaryPageIndex, setPurchaseSummaryPageIndex] = useState(0);
  const [warehouseExportFeedback, setWarehouseExportFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<WeeklyScheduleFeedback | null>(null);

  const resetScopedWeeklyMenuUi = () => {
    dispatch(setWeeklyMenu({}));
    setSelectedCostDayKey(null);
    setPurchaseSummaryPageIndex(0);
    setSelectedDishId('');
    setWarehouseExportFeedback(null);
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
    onMenuFeedback: setWarehouseExportFeedback,
    onQuickServingFeedback: setScheduleFeedback,
  });
  const productionPlanWorkflow = useWeeklyProductionPlan(weeklyScheduleScope);
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes]);
  const dishesByName = useMemo(
    () => new Map(catalogDishes.map((dish) => [normalizeDishMatchKey(dish.name), dish])),
    [catalogDishes],
  );

  const weeklyMenu = scheduleWorkflow.state.weeklyMenu;
  const getServiceDateIso = scheduleWorkflow.presentation.getServiceDate;
  const getSlotServingInfo = scheduleWorkflow.presentation.getSlotServingInfo;
  const getLinePricing = scheduleWorkflow.presentation.getLinePricing;

  const weeklyPlanRows: WeeklyPlanRow[] = committedMenu?.rows?.length ? committedMenu.rows
    .filter((row, index, rows) => !isWeeklyMenuRowContinuation(row, index, rows))
    .map((row, index) => {
    const catalogDish = (row.dishId ? dishesById.get(row.dishId) : undefined) ?? dishesByName.get(normalizeDishMatchKey(row.dishName));
    const day = displayDays.find((item) => item.key === row.dayKey);
    const slotType = getNormalizedSlotType(row);
    const servingsInfo = getSlotServingInfo(row.dayKey, slotType);
    const calculatedPortions = weeklyMenu[row.dayKey]?.[slotType]?.portions ?? servingsInfo.portions;
    const portions = calculatedPortions > 0 ? calculatedPortions : servingsInfo.importedPortions;
    const serviceDate = row.serviceDate.split('T')[0];
    const linePricing = getLinePricing(serviceDate, row.dbShiftName);

    return {
      key: `import-${row.serviceDate}-${row.sourceSection}-${row.slot}-${index}`,
      dayKey: row.dayKey,
      dayLabel: day?.label ?? row.dayKey.toUpperCase(),
      date: formatImportDate(row.serviceDate),
      serviceDate,
      sectionLabel: row.sourceSection,
      shiftLabel: getShiftLabel(row.dbShiftName),
      menuTypeLabel: getVariantLabel(row.variant),
      slotLabel: row.slotLabel || importSlotLabels[row.slot] || row.slot,
      dishId: catalogDish?.id ?? row.dishId ?? '',
      dishName: formatMenuDishName(row.dishName),
      portions,
      importedPortions: servingsInfo.importedPortions,
      servingsStatus: servingsInfo.status,
      servingsStatusLabel: servingsInfo.statusLabel,
      hasConfirmedServings: servingsInfo.hasConfirmedServings,
      hasCatalogBom: Boolean(catalogDish?.ingredients.length),
      menuPrice: linePricing.menuPrice,
      bomRatePercent: linePricing.bomRatePercent,
      quantityFactor: linePricing.quantityFactor,
    };
  }) : displayDays.flatMap((day) => {
    const rows: WeeklyPlanRow[] = [];

    SECTIONS.forEach((section) => {
      const slot = weeklyMenu[day.key]?.[section.slotType];
      if (!slot) return;

      const importedMainDish = slot.customComponents?.main?.trim();
      const catalogDish = dishesById.get(slot.dishId) ?? dishesByName.get(normalizeDishMatchKey(importedMainDish));
      const dishName = formatMenuDishName(importedMainDish || catalogDish?.name || 'Chưa có món');

      if (dishName === 'Chưa có món') return;
      const serviceDate = getServiceDateIso(day.key) || parseDisplayDateToIso(day.date) || day.date;
      const shiftName = section.shift === 'morning' ? 'MORNING' : 'AFTERNOON';
      const linePricing = getLinePricing(serviceDate, shiftName);
      const servingsInfo = getSlotServingInfo(day.key, section.slotType);
      const portions = servingsInfo.portions > 0 ? servingsInfo.portions : servingsInfo.importedPortions;

      rows.push({
        key: `${day.key}-${section.slotType}`,
        dayKey: day.key,
        dayLabel: day.label,
        date: day.date,
        serviceDate,
        sectionLabel: section.label,
        shiftLabel: section.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
        menuTypeLabel: section.category === 'vegetarian' ? 'Chay' : 'Mặn',
        slotLabel: 'Món chính',
        dishId: catalogDish?.id ?? slot.dishId,
        dishName,
        portions,
        importedPortions: servingsInfo.importedPortions,
        servingsStatus: servingsInfo.status,
        servingsStatusLabel: servingsInfo.statusLabel,
        hasConfirmedServings: servingsInfo.hasConfirmedServings,
        hasCatalogBom: Boolean(catalogDish?.ingredients.length),
        menuPrice: linePricing.menuPrice,
        bomRatePercent: linePricing.bomRatePercent,
        quantityFactor: linePricing.quantityFactor,
      });
    });

    return rows;
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
  const weeklyPlanCatalogDishIds = new Set(weeklyRowsWithBom.map((row) => row.dishId));
  const workflowStepItems: Array<{ label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = [
    { label: 'Menu', value: weeklyPlanRows.length.toString(), tone: weeklyPlanRows.length ? 'success' : 'neutral' },
    { label: 'Số lượng khách', value: weeklyRowsMissingOperationalServings.length ? `${weeklyRowsMissingOperationalServings.length} thiếu` : 'Đủ', tone: weeklyRowsMissingOperationalServings.length ? 'warning' : 'success' },
    { label: 'Định lượng', value: weeklyRowsMissingBom.length ? `${weeklyRowsMissingBom.length} thiếu BOM` : 'Đủ BOM', tone: weeklyRowsMissingBom.length ? 'danger' : 'success' },
    { label: 'Đề xuất mua', value: demandLines.length ? `${aggregatedDemandLines.length} dòng` : 'Chờ demand', tone: demandLines.length ? 'info' : 'neutral' },
    { label: 'Tồn kho/cảnh báo', value: invalidBomTierCount ? `${invalidBomTierCount} sai tier` : 'OK', tone: invalidBomTierCount ? 'danger' : 'success' },
  ];
  const costDayPages = displayDays
    .map((day) => ({
      ...day,
      rows: weeklyPlanRows.filter((row) => row.dayKey === day.key),
    }))
    .filter((day) => day.rows.length > 0);
  const selectedCostDayIndex = selectedCostDayKey
    ? costDayPages.findIndex((day) => day.key === selectedCostDayKey)
    : -1;
  const todayCostDayIndex = activeServiceDay
    ? costDayPages.findIndex((day) => day.key === activeServiceDay.key)
    : -1;
  const safeCostDayPageIndex = costDayPages.length === 0
    ? 0
    : selectedCostDayIndex >= 0
      ? selectedCostDayIndex
      : todayCostDayIndex >= 0
        ? todayCostDayIndex
        : 0;
  const activeCostDay = costDayPages[safeCostDayPageIndex];
  const costPageRows = activeCostDay?.rows ?? [];

  const handleExportWarehouseReport = () => {
    // Collect active materials
    const activeMaterials = Object.entries(materialSummary)
      .map(([name, data]) => {
        if (data.theory === 0) return null;
        const cost = data.actual * data.referencePrice;
        return {
          name,
          unit: data.unit,
          theory: data.theory.toFixed(2),
          actual: data.actual.toFixed(2),
          supplier: 'Catalog backend',
          price: data.referencePrice,
          cost,
        };
      })
      .filter(Boolean);

    if (activeMaterials.length === 0) {
      setWarehouseExportFeedback({
        title: 'Chưa có nguyên liệu để gửi kho',
        message: 'Các ca trong tuần đang có số suất bằng 0 nên chưa sinh nhu cầu xuất kho.',
        variant: 'warning',
      });
      return;
    }

    // Build CSV content
    const customerCode = customers.find((c) => c.customerId === effectiveMenuCustomerId)?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN';
    const weekStr = committedMenuWeekStartDate || '2026-06-15';

    let csvContent = '\uFEFF'; // Add BOM for UTF-8 in Excel
    csvContent += 'Tuần,Khách hàng,Nguyên liệu,Số lượng LT,Số lượng TT,Đơn vị,Đơn giá (đ),Thành tiền (đ)\n';

    activeMaterials.forEach((m) => {
      if (!m) return;
      csvContent += `"${weekStr}","${customerCode}","${m.name.replace(/"/g, '""')}","${m.theory}","${m.actual}","${m.unit}","${m.price}","${Math.round(m.cost)}"\n`;
    });

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_cao_gui_kho_${customerCode}_tuan_${weekStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setWarehouseExportFeedback({
      title: 'Đã xuất báo cáo gửi kho thành công',
      message: `Tệp báo cáo 'Bao_cao_gui_kho_${customerCode}_tuan_${weekStr}.csv' đã được tải xuống máy tính của bạn.`,
      variant: 'info',
    });
  };

  const getDishUnitCost = (dishId: string, quantityFactor = 1) => {
    const dish = dishesById.get(dishId);
    if (!dish || !dish.ingredients.length) return 0;
    const cost = dish.ingredients.reduce((sum, ing) => {
      const actualQty = ing.grossQtyPerServing * quantityFactor;
      return sum + actualQty * ing.referencePrice;
    }, 0);
    return Math.round(cost);
  };
  const activeDayRowsWithBom = costPageRows.filter((row) => row.hasCatalogBom);
  const activeDayRowsMissingBom = costPageRows.filter((row) => !row.hasCatalogBom);
  const activeDayCostTotal = activeDayRowsWithBom.reduce(
    (sum, row) => sum + getDishUnitCost(row.dishId, row.quantityFactor) * row.portions,
    0,
  );

  // Portion cost analysis logic (Step 2)
  const analyzedDish =
    catalogDishes.find((d) => d.id === selectedDishId) ||
    weeklyRowsWithBom.map((row) => dishesById.get(row.dishId)).find(Boolean) ||
    catalogDishes[0];

  const analyzedIngredients = analyzedDish
    ? analyzedDish.ingredients.map((ing) => {
      const theoryQty = ing.grossQtyPerServing;
      const actualQty = theoryQty;
      const supplierPrice = ing.referencePrice;
      const cost = actualQty * supplierPrice;
      return {
        name: ing.name,
        unit: ing.unit,
        theoryQty,
        actualQty,
        supplierPrice,
        cost,
      };
    })
    : [];

  const totalTrayCost = analyzedIngredients.reduce((sum, ing) => sum + ing.cost, 0);
  const foodCostPercent = menuPrice <= 0 ? 0 : (totalTrayCost / menuPrice) * 100;
  const grossProfit = menuPrice - totalTrayCost;

  const activeDayMaterialSummary = buildPlanRowsMaterialSummary(costPageRows, dishesById, dishesByName);
  const activeDayMaterialCost = calculateTotalMaterialCost(activeDayMaterialSummary);
  const totalCostInfo = calculateTotalMaterialCost(materialSummary);
  const materialSummaryEntries = Object.entries(materialSummary).filter(([, data]) => data.theory > 0);
  const purchaseSummaryUsesDemand = demandLines.length > 0;
  const purchaseSummaryTotalItems = purchaseSummaryUsesDemand ? aggregatedDemandLines.length : materialSummaryEntries.length;
  const purchaseSummaryTotalPages = Math.max(1, Math.ceil(purchaseSummaryTotalItems / PURCHASE_SUMMARY_PAGE_SIZE));
  const safePurchaseSummaryPageIndex = Math.min(purchaseSummaryPageIndex, purchaseSummaryTotalPages - 1);
  const purchaseSummaryPageStartIndex = safePurchaseSummaryPageIndex * PURCHASE_SUMMARY_PAGE_SIZE;
  const purchaseDemandPageRows: DemandLine[] = purchaseSummaryUsesDemand
    ? aggregatedDemandLines.slice(purchaseSummaryPageStartIndex, purchaseSummaryPageStartIndex + PURCHASE_SUMMARY_PAGE_SIZE)
    : [];
  const purchaseSummaryMaterialPageRows: PurchaseSummaryMaterialEntry[] = purchaseSummaryUsesDemand
    ? []
    : materialSummaryEntries.slice(purchaseSummaryPageStartIndex, purchaseSummaryPageStartIndex + PURCHASE_SUMMARY_PAGE_SIZE);
  const purchaseSummaryShortageCount = aggregatedDemandLines.filter((line) => {
    const availableAfterReserve = line.available - line.reserved;
    return Math.max(line.required - availableAfterReserve, 0) > 0;
  }).length;
  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button
                type="button"
                onClick={scheduleWorkflow.actions.openEditor}
                className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap"
              >
                <Edit size={14} className="text-[var(--ipc-slate-500)]" />
                Chỉnh sửa thực đơn
              </button>

              <button
                type="button"
                onClick={importWorkflow.actions.open}
                disabled={importWorkflow.status.isImporting}
                className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap"
              >
                <Upload size={14} className="text-[var(--ipc-slate-500)]" />
                {importWorkflow.status.isImporting ? 'Đang nhập...' : 'Nhập Excel'}
              </button>

              <button
                type="button"
                onClick={handleExportWarehouseReport}
                className="ipc-button ipc-button-success whitespace-nowrap"
              >
                Xuất báo cáo gửi kho
              </button>
            </>
          }
        >
          <FieldRow label="Khách hàng">
            <select
              value={selectedMenuCustomerId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedMenuCustomerId(cid);
                setCommittedMenuWeekStartDate('');
                resetScopedWeeklyMenuUi();
                if (cid) {
                  window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, cid);
                } else {
                  window.localStorage.removeItem(LAST_WEEKLY_MENU_CUSTOMER_KEY);
                }
                window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
              }}
              className="ipc-select min-w-[200px]"
              disabled={isCustomerLoading}
            >
              <option value="">Chọn khách hàng</option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerCode} - {c.customerName}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Tuần bắt đầu">
            <input
              type="date"
              value={displayedWeekStartDate}
              onChange={(e) => {
                const date = e.target.value;
                setCommittedMenuWeekStartDate(date);
                resetScopedWeeklyMenuUi();
                if (date) {
                  window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, date);
                } else {
                  window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
                }
              }}
              className="ipc-input"
            />
          </FieldRow>
        </CommandBar>
      }
      context={
        <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-sm lg:grid-cols-3">
          <FieldRow label="Định mức BOM cố định" className="[&_.ipc-field-label]:min-h-[18px]">
            <div className="ipc-input flex h-10 items-center justify-between bg-white text-sm font-semibold text-blue-700">
              <span>{formatBomTierLabel(menuPrice)}</span>
              <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase text-blue-600">
                Đang dùng
              </span>
            </div>
          </FieldRow>
          <FieldRow label="Nguồn định mức" className="[&_.ipc-field-label]:min-h-[18px]">
            <div className="ipc-input flex h-10 items-center bg-white text-sm font-semibold text-slate-800">
              {menuPriceSource}
            </div>
          </FieldRow>
          <FieldRow label="BOM áp dụng" className="[&_.ipc-field-label]:min-h-[18px]">
            <div className="ipc-input flex h-10 items-center bg-white text-sm font-semibold text-emerald-700">
              Theo tier cố định, 100%
            </div>
          </FieldRow>
        </div>
      }
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
      {invalidBomTierCount > 0 && (
        <InlineAlert title="Đơn giá chưa khớp tier BOM" variant="danger">
          Có {invalidBomTierCount} lịch/ca không thuộc 25k, 30k hoặc 34k. Hệ thống sẽ chặn sinh demand để tránh dùng sai định lượng.
        </InlineAlert>
      )}
      {warehouseExportFeedback && (
        <InlineAlert title={warehouseExportFeedback.title} variant={warehouseExportFeedback.variant}>
          {warehouseExportFeedback.message}
        </InlineAlert>
      )}
      {isCatalogLoading && (
        <InlineAlert title="Đang tải catalog món ăn" variant="info">
          Hệ thống đang lấy danh sách món và định lượng BOM từ API.
        </InlineAlert>
      )}
      {isCatalogError && (
        <InlineAlert title="Chưa tải được catalog món ăn" variant="warning">
          Kiểm tra backend hoặc quyền truy cập catalog trước khi phân tích giá vốn.
        </InlineAlert>
      )}
      {isCommittedMenuFetching && effectiveMenuCustomerId && (
        <InlineAlert title="Đang tải thực đơn khách hàng" variant="info">
          Hệ thống đang lấy menu, KHSX và giá vốn theo khách hàng đang chọn.
        </InlineAlert>
      )}
      {isCatalogEmpty && (
        <InlineAlert title="Catalog món ăn đang trống" variant="warning">
          Chưa có món ăn hoạt động nào từ API, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
        </InlineAlert>
      )}

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
        <>
          <SectionPanel
            title="Giá vốn theo ngày từ kế hoạch tuần"
            icon={<Scale size={18} color="var(--ipc-slate-600)" />}
          >
            <div className="mb-6 mt-4">
              <ContextStrip
                items={[
                  {
                    label: 'Nguồn tính',
                    value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                    tone: 'neutral',
                  },
                  {
                    label: 'Ngày đang tính',
                    value: activeCostDay ? `${activeCostDay.label} ${activeCostDay.date}` : 'Chưa có ngày',
                    tone: activeCostDay ? 'info' : 'neutral',
                  },
                  { label: 'Dòng trong ngày', value: costPageRows.length.toString(), tone: 'neutral' },
                  { label: 'Đã có BOM', value: activeDayRowsWithBom.length.toString(), tone: 'success' },
                  {
                    label: 'Chờ gắn BOM',
                    value: activeDayRowsMissingBom.length.toString(),
                    tone: activeDayRowsMissingBom.length > 0 ? 'warning' : 'success',
                  },
                  { label: 'Đơn giá bán/suất', value: formatCurrency(menuPrice), tone: 'neutral' },
                  { label: 'Tổng giá vốn ngày', value: formatCurrency(activeDayCostTotal), tone: activeDayCostTotal > 0 ? 'success' : 'neutral' },
                ]}
              />
            </div>

            <TableViewport caption="Món trong kế hoạch tuần và giá vốn liên kết" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng món kế hoạch tuần liên kết giá vốn">
              <table className="ipc-data-table ipc-cost-table table-fixed w-full">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Ngày</th>
                    <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Ca</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Dòng</th>
                    <th style={{ width: '24%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Suất</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá vốn</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái giá vốn</th>
                  </tr>
                </thead>
                <tbody>
                  {costPageRows.map((row) => {
                    const unitCost = getDishUnitCost(row.dishId, row.quantityFactor);
                    const totalCost = unitCost * row.portions;
                    return (
                      <tr key={`cost-${row.key}`} className="table-row">
                        <td className={`${tableCellClass} text-left font-semibold`}>
                          {row.dayLabel}
                          <div className="text-[12px] font-normal text-slate-500">{row.date}</div>
                        </td>
                        <td className={tableCellClass}>{row.shiftLabel}</td>
                        <td className={`${tableCellClass} text-left`}>{row.slotLabel}</td>
                        <td className={`${tableCellClass} text-left font-semibold`}>{row.dishName}</td>
                        <td className={tableCellClass}>{row.portions.toLocaleString('vi-VN')}</td>
                        <td className={tableCellClass}>
                          {row.hasCatalogBom ? formatCurrency(unitCost) : '-'}
                        </td>
                        <td className={`${tableCellClass} font-semibold`}>
                          {row.hasCatalogBom ? formatCurrency(totalCost) : '-'}
                        </td>
                        <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>
                          {row.hasCatalogBom ? 'Tính bằng BOM catalog' : 'Chờ gắn BOM'}
                        </td>
                      </tr>
                    );
                  })}
                  {costPageRows.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={8}>
                        Chưa có kế hoạch ngày để liên kết giá vốn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <div className="mb-5 mt-3 flex min-h-[38px] items-center justify-end gap-2">
              <span className="mr-2 text-sm font-medium text-slate-600">
                {activeCostDay
                  ? `${activeCostDay.label} ${activeCostDay.date} (${safeCostDayPageIndex + 1}/${costDayPages.length})`
                  : 'Chưa có ngày'}
              </span>
              <button
                type="button"
                className="ipc-button ipc-button-ghost"
                disabled={safeCostDayPageIndex <= 0}
                onClick={() => setSelectedCostDayKey(costDayPages[Math.max(0, safeCostDayPageIndex - 1)]?.key ?? null)}
              >
                Ngày trước
              </button>
              <button
                type="button"
                className="ipc-button ipc-button-primary"
                disabled={safeCostDayPageIndex >= costDayPages.length - 1}
                onClick={() => setSelectedCostDayKey(costDayPages[Math.min(costDayPages.length - 1, safeCostDayPageIndex + 1)]?.key ?? null)}
              >
                Ngày sau
              </button>
            </div>

            <TableViewport caption="Nguyên liệu theo món đang hiển thị trong ngày" className="ipc-cost-table-shell h-[360px] max-h-[360px]" ariaLabel="Bảng nguyên liệu ngày theo món đang hiển thị">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Nguyên liệu</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>ĐV</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>LT ngày</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>TT ngày</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Món trong kế hoạch</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Đơn giá</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Thành tiền ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(activeDayMaterialSummary).map(([name, data]) => {
                    if (data.theory === 0) return null;

                    const rowCost = data.actual * data.referencePrice;
                    const dishSource = formatMaterialDishSource(data.dishNames);

                    return (
                      <tr key={`day-material-${name}`} className="table-row">
                        <td className={`${tableCellClass} text-left font-bold`}>{name}</td>
                        <td className={tableCellClass}>{data.unit}</td>
                        <td className={tableCellClass}>{data.theory.toFixed(2)}</td>
                        <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>
                          {data.actual.toFixed(2)}
                        </td>
                        <td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>
                          {dishSource}
                        </td>
                        <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td>
                        <td className={`${tableCellClass} font-bold`}>{formatCurrency(rowCost)}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(activeDayMaterialSummary).length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                        Chưa có nguyên liệu cho ngày này. Kiểm tra các món đã gắn BOM catalog.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <div className="mt-3 flex min-h-[32px] items-center justify-end text-sm font-medium text-slate-600">
              Tổng nguyên liệu ngày: <span className="ml-2 text-lg font-bold text-green-800">{formatCurrency(activeDayMaterialCost)}</span>
            </div>
          </SectionPanel>

        </>
      )}

      {activeView === 'purchase-summary' && (
        <SectionPanel
          title="Bảng Tính Định Lượng Tổng Hợp & Đề Xuất Mua Hàng"
          icon={<ShoppingCart size={18} color="var(--ipc-slate-600)" />}
          badge={
            <Toolbar>
              <div className="text-sm font-medium text-slate-600">
                Tổng chi phí tối ưu: <span className="text-lg font-bold text-green-800">{formatCurrency(totalCostInfo)}</span>
              </div>
              <button
                onClick={handleExportWarehouseReport}
                className="ipc-button ipc-button-success ipc-button-bounded"
              >
                Xuất Báo Cáo Gửi Kho
              </button>
            </Toolbar>
          }
        >
          <div className="mb-4">
            <ContextStrip
              items={[
                {
                  label: 'Khách hàng',
                  value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                  tone: 'neutral',
                },
                {
                  label: 'Tuần',
                  value: committedMenu?.weekStartDate ? `${formatImportDate(committedMenu.weekStartDate)} - ${formatImportDate(committedMenu.weekEndDate)}` : 'Chưa có menu',
                  tone: committedMenu?.weekStartDate ? 'info' : 'neutral',
                },
                {
                  label: 'Nguyên liệu',
                  value: purchaseSummaryUsesDemand
                    ? aggregatedDemandLines.length.toString()
                    : Object.keys(materialSummary).length.toString(),
                  tone: 'info',
                },
                {
                  label: 'Thiếu sau kiểm tồn',
                  value: purchaseSummaryUsesDemand ? purchaseSummaryShortageCount.toString() : '-',
                  tone: purchaseSummaryShortageCount > 0 ? 'danger' : purchaseSummaryUsesDemand ? 'success' : 'neutral',
                },
              ]}
            />
          </div>

          {!purchaseSummaryUsesDemand && (
            <InlineAlert title="Chưa có số thiếu/đủ sau kiểm tồn" variant="warning" className="mb-3">
              Bảng dưới đây mới là định lượng theo BOM. Bấm Tạo demand từ KHSX ở tab KHSX và nhu cầu để backend kiểm tồn kho và trả ra Cần, Tồn khả dụng, Thiếu/Đủ.
            </InlineAlert>
          )}

          <TableViewport caption="Định lượng tổng hợp và đề xuất mua hàng" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng định lượng tổng hợp và đề xuất mua hàng">
            <table className={cn('ipc-data-table ipc-cost-table table-fixed w-full', purchaseSummaryUsesDemand && 'ipc-status-action-table')}>
              <thead>
                {purchaseSummaryUsesDemand ? (
                  <tr>
                    <th style={{ width: '15%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
                    <th style={{ width: '25%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguồn</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Cần</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Tồn khả dụng</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Chênh lệch</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-center whitespace-nowrap`}>Tiếp theo</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: '20%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
                    <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>ĐV</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>LT</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>TT</th>
                    <th style={{ width: '30%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {purchaseDemandPageRows.map((line, index) => {
                  const availableAfterReserve = line.available - line.reserved;
                  const variance = availableAfterReserve - line.required;

                  return (
                    <tr key={`${line.id}-${safePurchaseSummaryPageIndex}-${index}`} className="table-row">
                      <td className={`${tableCellClass} text-left font-bold`}>{line.material}</td>
                      <td className={`${tableCellClass} text-left font-medium text-slate-800`}>{line.source}</td>
                      <td className={tableCellClass}>{formatQuantityWithUnit(line.required, line.unit)}</td>
                      <td className={tableCellClass}>{formatQuantityWithUnit(availableAfterReserve, line.unit)}</td>
                      <td className={`${tableCellClass} font-bold ${variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {formatQuantityVariance(variance, line.unit)}
                      </td>
                      <td className="ipc-badge-cell">
                        <StatusBadge variant={line.tone} className="ipc-table-badge ipc-table-badge--status">
                          {line.status}
                        </StatusBadge>
                      </td>
                      <td className={`${tableCellClass} text-left`}>{line.nextAction}</td>
                    </tr>
                  );
                })}
                {purchaseSummaryMaterialPageRows.map(([name, data]) => {
                  const rowCost = data.actual * data.referencePrice;
                  const dishSource = formatMaterialDishSource(data.dishNames);

                  return (
                    <tr key={name} className="table-row">
                      <td className={`${tableCellClass} text-left font-bold`}>{name}</td>
                      <td className={tableCellClass}>{data.unit}</td>
                      <td className={tableCellClass}>{data.theory.toFixed(2)}</td>
                      <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>
                        {data.actual.toFixed(2)}
                      </td>
                      <td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>
                        {dishSource}
                      </td>
                      <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td>
                      <td className={`${tableCellClass} font-bold`}>{formatCurrency(rowCost)}</td>
                    </tr>
                  );
                })}
                {purchaseSummaryTotalItems === 0 && (
                  <tr>
                    <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                      Chưa có nguyên liệu tổng hợp. Kiểm tra menu tuần và BOM catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            className="mt-3"
            page={safePurchaseSummaryPageIndex + 1}
            pageSize={PURCHASE_SUMMARY_PAGE_SIZE}
            totalItems={purchaseSummaryTotalItems}
            onPageChange={(nextPage) => setPurchaseSummaryPageIndex(nextPage - 1)}
          />
        </SectionPanel>
      )}

      {activeView === 'dish-materials' && (
        <>
          {foodCostPercent > 85 && (
            <InlineAlert
              title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!"
              variant="danger"
              className="mb-4"
            >
              Tỉ lệ giá vốn hiện tại đạt <b>{foodCostPercent.toFixed(1)}%</b>, vượt ngưỡng an toàn tối đa (85%). Kiểm tra lại BOM theo tier, giá nguyên liệu hoặc đơn giá bán suất ăn của ca này.
            </InlineAlert>
          )}
          <SectionPanel
            title="Nguyên liệu món phân tích"
            icon={<Scale size={18} color="var(--ipc-slate-600)" />}
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-slate-600 whitespace-nowrap">Món phân tích:</span>
                <select
                  value={analyzedDish?.id ?? ''}
                  onChange={(e) => setSelectedDishId(e.target.value)}
                  className="ipc-select w-[280px] text-[13.5px]"
                  disabled={catalogDishes.length === 0}
                >
                  <optgroup label="Ca Sáng">
                    {catalogDishes.filter(d => matchesShift(d, 'morning')).map((d, index) => (
                      <option key={`morning-${d.id}-${index}`} value={d.id}>
                        {d.name}{weeklyPlanCatalogDishIds.has(d.id) ? ' - trong KH tuần' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ca Chiều">
                    {catalogDishes.filter(d => matchesShift(d, 'afternoon')).map((d, index) => (
                      <option key={`afternoon-${d.id}-${index}`} value={d.id}>
                        {d.name}{weeklyPlanCatalogDishIds.has(d.id) ? ' - trong KH tuần' : ''}
                      </option>
                    ))}
                  </optgroup>
                  {catalogDishes.length === 0 && <option value="">Chưa có catalog</option>}
                </select>
              </div>
            }
          >
            <div className="mb-6 mt-4">
              <ContextStrip
                items={[
                  {
                    label: 'Nguồn tính',
                    value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                    tone: 'neutral',
                  },
                  {
                    label: 'Món trong kế hoạch',
                    value: analyzedDish?.name ?? 'Chưa chọn',
                    tone: analyzedDish ? 'info' : 'neutral',
                  },
                  { label: 'Đơn giá bán/suất', value: formatCurrency(menuPrice), tone: 'neutral' },
                  { label: 'Giá vốn nguyên liệu / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
                  {
                    label: 'Tỷ lệ giá vốn (Food Cost %)',
                    value: `${foodCostPercent.toFixed(1)}%`,
                    tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'success',
                  },
                  {
                    label: 'Lợi nhuận gộp / khay (Dự kiến)',
                    value: formatCurrency(Math.round(grossProfit)),
                    tone: grossProfit >= 0 ? 'success' : 'danger',
                  },
                ]}
              />
            </div>

            <TableViewport caption="Giá vốn nguyên liệu cho một khay" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng giá vốn nguyên liệu một khay">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Nguyên liệu</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>ĐV</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>LT / suất</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>TT / suất</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Món trong kế hoạch</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Đơn giá</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Thành tiền / khay</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedIngredients.map((ing) => (
                    <tr key={ing.name} className="table-row">
                      <td className={`${tableCellClass} text-left font-bold`}>{ing.name}</td>
                      <td className={tableCellClass}>{ing.unit}</td>
                      <td className={tableCellClass}>{ing.theoryQty.toFixed(3)}</td>
                      <td className={`${tableCellClass} font-bold text-blue-600`}>
                        {ing.actualQty.toFixed(3)}
                      </td>
                      <td className={`${tableCellClass} text-left font-medium text-slate-800`}>
                        {analyzedDish?.name ?? 'Chưa chọn'}
                      </td>
                      <td className={tableCellClass}>{formatCurrency(ing.supplierPrice)}</td>
                      <td className={`${tableCellClass} font-bold text-slate-950`}>
                        {formatCurrency(Math.round(ing.cost))}
                      </td>
                    </tr>
                  ))}
                  {analyzedIngredients.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                        Chưa có nguyên liệu cho món đang chọn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
          </SectionPanel>
        </>
      )}


      <WeeklyMenuImportDialog workflow={importWorkflow} />

      <WeeklyScheduleEditorDialog workflow={scheduleWorkflow} />

    </OperationalFrame>
  );
};

export default WeeklyMenuPage;
