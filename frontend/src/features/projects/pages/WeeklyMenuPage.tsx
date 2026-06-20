import { useState, useMemo, Fragment } from 'react';
import { Calendar, Scale, Lock, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { updateWeeklyMenuDish, setMenuPrice, setLossRate } from '../../coordination/coordinationSlice';
import { CommandBar, ContextStrip, DataTableShell, DemandSummary, DocumentRail, FieldRow, InlineAlert, OperationalFrame, SectionPanel, Toolbar, ViewSwitcher } from '@/components/common';
import { useGetIngredientDemandQuery, useGetWorkflowDocumentsQuery } from '@/features/workflow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DAYS_OF_WEEK_WITH_DATES as DAYS_OF_WEEK } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { useGetDishesCatalogQuery } from '../dishCatalogApi';
import type { CatalogDish } from '../dishCatalogApi';
import type { WeeklyMenuState } from '../../coordination/types';

interface MaterialSummaryEntry {
  theory: number;
  actual: number;
  unit: string;
  referencePrice: number;
}

type MaterialSummary = Record<string, MaterialSummaryEntry>;

const tableHeadClass = 'text-center';
const tableCellClass = 'text-center';

const getDishSearchText = (dish: CatalogDish): string =>
  [
    dish.name,
    dish.code,
    dish.dishType,
    dish.dishGroup,
    ...dish.menuSlots,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const matchesShift = (dish: CatalogDish, shift: 'morning' | 'afternoon') => {
  const text = getDishSearchText(dish);
  if (shift === 'morning') {
    return text.includes('sáng') || text.includes('morning') || !text.includes('chiều');
  }

  return text.includes('chiều') || text.includes('afternoon') || !text.includes('sáng');
};

const matchesCategory = (dish: CatalogDish, category: 'savory' | 'vegetarian') => {
  const text = getDishSearchText(dish);
  const isVegetarian = text.includes('chay') || text.includes('vegetarian');
  return category === 'vegetarian' ? isVegetarian : !isVegetarian;
};

const SECTIONS = [
  { label: 'MENU MẶN CA SÁNG', slotType: 'morningSavory' as const, category: 'savory' as const, shift: 'morning' as const },
  { label: 'MENU CHAY CA SÁNG', slotType: 'morningVegetarian' as const, category: 'vegetarian' as const, shift: 'morning' as const },
  { label: 'MENU MẶN - CA CHIỀU', slotType: 'afternoonSavory' as const, category: 'savory' as const, shift: 'afternoon' as const },
  { label: 'MENU CHAY - CA CHIỀU', slotType: 'afternoonVegetarian' as const, category: 'vegetarian' as const, shift: 'afternoon' as const }
] as const;

const getDishComponents = (dish?: CatalogDish): { sub1: string; sub2: string; rau: string; canh: string; fruit: string } => {
  const names = dish?.ingredients.map((ingredient) => ingredient.name).filter(Boolean) ?? [];
  return {
    sub1: names[0] ?? 'Theo catalog',
    sub2: names[1] ?? 'Theo catalog',
    rau: names[2] ?? 'Theo catalog',
    canh: names[3] ?? 'Theo catalog',
    fruit: 'Theo thực đơn',
  };
};



type WeeklyMenuView = 'schedule' | 'demand' | 'cost';

const buildMaterialSummary = (
  weeklyMenu: WeeklyMenuState,
  dishesById: Map<string, CatalogDish>,
  priceRatio: number,
  lossRate: number,
): MaterialSummary => {
  const summary: MaterialSummary = {};

  Object.values(weeklyMenu).forEach((slots) => {
    const activeSlots = [
      slots.morningSavory,
      slots.morningVegetarian,
      slots.afternoonSavory,
      slots.afternoonVegetarian,
    ];

    activeSlots.forEach((slot) => {
      if (!slot) return;
      const dish = dishesById.get(slot.dishId);
      if (!dish) {
        return;
      }

      dish.ingredients.forEach((ingredient) => {
        if (!summary[ingredient.name]) {
          summary[ingredient.name] = {
            theory: 0,
            actual: 0,
            unit: ingredient.unit,
            referencePrice: ingredient.referencePrice,
          };
        }
        summary[ingredient.name].theory += ingredient.grossQtyPerServing * slot.portions;
      });
    });
  });

  return Object.fromEntries(
    Object.entries(summary).map(([name, data]) => [
      name,
      {
        theory: data.theory,
        actual: data.theory * priceRatio * (1 + lossRate / 100),
        unit: data.unit,
        referencePrice: data.referencePrice,
      },
    ]),
  ) as MaterialSummary;
};

const calculateTotalMaterialCost = (materialSummary: MaterialSummary): number =>
  Object.values(materialSummary).reduce((total, data) => total + data.actual * data.referencePrice, 0);

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

  // Đơn giá chuẩn là 35,000 đ
  const standardPrice = 35000;
  const menuPrice = useAppSelector((state) => state.coordination.menuPrice);
  const lossRate = useAppSelector((state) => state.coordination.lossRate);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [activeView, setActiveView] = useState<WeeklyMenuView>('schedule');
  const [warehouseExportFeedback, setWarehouseExportFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const { data: demandLines = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes]);

  const getSectionDishes = (section: (typeof SECTIONS)[number]) =>
    catalogDishes.filter((dish) => matchesShift(dish, section.shift) && matchesCategory(dish, section.category));

  const getSectionDefaultDish = (section: (typeof SECTIONS)[number]) =>
    getSectionDishes(section)[0] ?? catalogDishes[0];

  // Modal state for bulk editing the entire menu
  const [isEditingMenu, setIsEditingMenu] = useState<boolean>(false);
  const [tempWeeklyMenu, setTempWeeklyMenu] = useState<WeeklyMenuState>({});

  const handleOpenEdit = () => {
    const clone: WeeklyMenuState = {};
    DAYS_OF_WEEK.forEach((day) => {
      clone[day.key] = {
        morningSavory: { ...weeklyMenu[day.key]?.morningSavory },
        morningVegetarian: { ...weeklyMenu[day.key]?.morningVegetarian },
        afternoonSavory: { ...weeklyMenu[day.key]?.afternoonSavory },
        afternoonVegetarian: { ...weeklyMenu[day.key]?.afternoonVegetarian },
      };
    });
    setTempWeeklyMenu(clone);
    setIsEditingMenu(true);
  };

  const handleSaveEdit = () => {
    DAYS_OF_WEEK.forEach((day) => {
      SECTIONS.forEach((sec) => {
        const isLocked = !!lockedShifts[`${day.key}-${sec.slotType.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'}`];
        if (isLocked) return; // Skip updating locked shifts

        const currentDishId = weeklyMenu[day.key]?.[sec.slotType]?.dishId || getSectionDefaultDish(sec)?.id;
        const newDishId = tempWeeklyMenu[day.key]?.[sec.slotType]?.dishId;
        if (newDishId && newDishId !== currentDishId) {
          dispatch(updateWeeklyMenuDish({
            day: day.key,
            slotType: sec.slotType,
            dishId: newDishId,
          }));
        }
      });
    });

    setIsEditingMenu(false);
  };

  // Merge dishId from Redux with portions calculated from active customer orders
  const weeklyMenu = (() => {
    const merged: WeeklyMenuState = {};

    DAYS_OF_WEEK.forEach(({ key: day }) => {
      const slots = reduxWeeklyMenu[day];
      if (!slots) return;

      // Morning portions
      const morningOrders = orders.filter((o) => o.dayOfWeek === day && o.shift === 'Ca Sáng');
      const isMorningLocked = !!lockedShifts[`${day}-Ca Sáng`];
      const morningPortions = morningOrders.reduce(
        (sum, o) => sum + (isMorningLocked ? o.actualQuantity : o.forecastQuantity),
        0,
      );

      // Afternoon portions
      const afternoonOrders = orders.filter((o) => o.dayOfWeek === day && o.shift === 'Ca Chiều');
      const isAfternoonLocked = !!lockedShifts[`${day}-Ca Chiều`];
      const afternoonPortions = afternoonOrders.reduce(
        (sum, o) => sum + (isAfternoonLocked ? o.actualQuantity : o.forecastQuantity),
        0,
      );

      // Savory is 85%, Vegetarian is 15%
      const morningSavoryPortions = Math.round(morningPortions * 0.85);
      const morningVegetarianPortions = morningPortions - morningSavoryPortions;

      const afternoonSavoryPortions = Math.round(afternoonPortions * 0.85);
      const afternoonVegetarianPortions = afternoonPortions - afternoonSavoryPortions;

      merged[day] = {
        morningSavory: {
          dishId: dishesById.has(slots.morningSavory?.dishId ?? '')
            ? slots.morningSavory.dishId
            : getSectionDefaultDish(SECTIONS[0])?.id ?? '',
          portions: morningSavoryPortions,
        },
        morningVegetarian: {
          dishId: dishesById.has(slots.morningVegetarian?.dishId ?? '')
            ? slots.morningVegetarian.dishId
            : getSectionDefaultDish(SECTIONS[1])?.id ?? '',
          portions: morningVegetarianPortions,
        },
        afternoonSavory: {
          dishId: dishesById.has(slots.afternoonSavory?.dishId ?? '')
            ? slots.afternoonSavory.dishId
            : getSectionDefaultDish(SECTIONS[2])?.id ?? '',
          portions: afternoonSavoryPortions,
        },
        afternoonVegetarian: {
          dishId: dishesById.has(slots.afternoonVegetarian?.dishId ?? '')
            ? slots.afternoonVegetarian.dishId
            : getSectionDefaultDish(SECTIONS[3])?.id ?? '',
          portions: afternoonVegetarianPortions,
        },
      };
    });

    return merged;
  })();

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

    setWarehouseExportFeedback({
      title: 'Đã kết xuất báo cáo gửi kho',
      message: `Tổng chi phí mua hàng tạm tính ${formatCurrency(totalCostInfo)} đã được ghi nhận cho báo cáo nguyên liệu tuần.`,
      variant: 'info',
    });
  };

  // Tính hệ số đơn giá suất ăn (Giảm giá giảm định lượng theo tỉ lệ: 35k = 100%)
  const priceRatio = useMemo(() => {
    return Math.max(0.1, Math.min(1.5, menuPrice / standardPrice));
  }, [menuPrice]);

  // Portion cost analysis logic (Step 2)
  const analyzedDish = useMemo(() => {
    return catalogDishes.find((d) => d.id === selectedDishId) || catalogDishes[0];
  }, [catalogDishes, selectedDishId]);

  const analyzedIngredients = useMemo(() => {
    if (!analyzedDish) return [];
    return analyzedDish.ingredients.map((ing) => {
      const theoryQty = ing.grossQtyPerServing;
      const actualQty = theoryQty * priceRatio * (1 + lossRate / 100);
      const supplierPrice = ing.referencePrice;
      const cost = actualQty * supplierPrice;
      return {
        name: ing.name,
        unit: ing.unit,
        theoryQty,
        actualQty,
        supplierName: 'Catalog backend',
        supplierPrice,
        cost,
      };
    });
  }, [analyzedDish, priceRatio, lossRate]);

  const totalTrayCost = useMemo(() => {
    return analyzedIngredients.reduce((sum, ing) => sum + ing.cost, 0);
  }, [analyzedIngredients]);

  const foodCostPercent = useMemo(() => {
    if (menuPrice <= 0) return 0;
    return (totalTrayCost / menuPrice) * 100;
  }, [totalTrayCost, menuPrice]);

  const grossProfit = useMemo(() => {
    return menuPrice - totalTrayCost;
  }, [menuPrice, totalTrayCost]);

  const materialSummary = buildMaterialSummary(weeklyMenu, dishesById, priceRatio, lossRate);
  const totalCostInfo = calculateTotalMaterialCost(materialSummary);


  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <div className="ipc-weekly-command-actions flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenEdit}
                className="ipc-button ipc-button-ghost ipc-button-bounded font-semibold"
              >
                <Edit size={14} className="text-[var(--ipc-slate-500)]" />
                Chỉnh sửa thực đơn
              </button>
              <button
                type="button"
                onClick={handleExportWarehouseReport}
                className="ipc-button ipc-button-success ipc-button-bounded"
              >
                Xuất báo cáo gửi kho
              </button>
            </div>
          }
        >
          <FieldRow label="Đơn giá suất ăn bình quân (đ)" hint="Định mức 35K = 100% định lượng">
            <input
              type="number"
              value={menuPrice}
              onChange={(e) => dispatch(setMenuPrice(Math.max(5000, Number(e.target.value))))}
              className="ipc-input"
              step="1000"
            />
          </FieldRow>
          <FieldRow label="Tỷ lệ hao hụt sơ chế (%)" hint="Bù lượng hao hụt khi làm sạch">
            <input
              type="number"
              value={lossRate}
              onChange={(e) => dispatch(setLossRate(Math.max(0, Number(e.target.value))))}
              className="ipc-input"
              min="0"
              max="50"
            />
          </FieldRow>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-5 text-slate-700 self-end h-[38px] flex items-center">
            Hệ số thực tế: &nbsp;<b>{(priceRatio * (1 + lossRate / 100) * 100).toFixed(1)}%</b>
          </div>
        </CommandBar>
      }
    >
      <ViewSwitcher
        ariaLabel="Chọn góc nhìn kế hoạch tuần"
        tabs={[
          { id: 'schedule', label: 'Kế hoạch tuần' },
          { id: 'demand', label: 'KHSX và nhu cầu' },
          { id: 'cost', label: 'Giá vốn' },
        ]}
        activeTab={activeView}
        onTabChange={(tabId) => setActiveView(tabId as WeeklyMenuView)}
      />
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
      {isCatalogEmpty && (
        <InlineAlert title="Catalog món ăn đang trống" variant="warning">
          Chưa có món ăn hoạt động nào từ API, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
        </InlineAlert>
      )}

      {activeView === 'schedule' && (
        <div className="flex flex-col gap-4">
          <SectionPanel title="Bảng Lên Thực Đơn & Nhập Suất Ăn Tuần" icon={<Calendar size={18} color="#475569" />}>
            <DataTableShell className="ipc-weekly-menu-shell" ariaLabel="Bảng thực đơn tuần có thể cuộn">
              <table className="ipc-data-table ipc-schedule-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} w-[120px] min-w-[120px] max-w-[120px] border-r border-slate-200 bg-slate-100`}>Buổi / Ca</th>
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <th
                        key={day.key}
                        className={cn(
                          tableHeadClass,
                          'border-r border-slate-200 transition-colors',
                          idx % 2 === 1 ? 'bg-slate-100' : 'bg-slate-50'
                        )}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 py-1">
                          <span className="font-bold text-slate-800 text-[13px]">{day.label}</span>
                          <span className="text-[10.5px] text-slate-500 font-medium">{day.date}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((section) => {
                    const rowTypes = [
                      { key: 'main', label: section.category === 'savory' ? 'Món mặn chính' : 'Món chay chính' },
                      { key: 'sub1', label: 'Phụ 1' },
                      { key: 'sub2', label: 'Phụ 2' },
                      { key: 'rau', label: 'Rau' },
                      { key: 'canh', label: 'Canh' },
                      { key: 'fruit', label: 'Trái cây' }
                    ] as const;

                    return (
                      <Fragment key={section.label}>
                        {/* Clean neutral section header row with thick divider */}
                        <tr>
                          <td
                            colSpan={7}
                            className={cn(
                              'bg-slate-200 py-2.5 text-center text-[12.5px] font-bold uppercase tracking-wide text-slate-900 border-r border-b border-slate-300',
                              section.slotType !== 'morningSavory' && 'border-t-2 border-t-slate-500'
                            )}
                          >
                            {section.label}
                          </td>
                        </tr>
                        
                        {rowTypes.map((row) => (
                          <tr key={`${section.label}-${row.key}`}>
                            {/* Label Column */}
                            <td className="border-r border-slate-200 bg-slate-50 align-middle font-semibold text-slate-800 text-[12px] p-2 text-center w-[120px] min-w-[120px] max-w-[120px]">
                              {row.label}
                            </td>
                            
                            {/* Day Columns */}
                            {DAYS_OF_WEEK.map((day, idx) => {
                              const slot = weeklyMenu[day.key]?.[section.slotType];
                              const dish = dishesById.get(slot?.dishId ?? '') ?? getSectionDefaultDish(section);
                              const components = getDishComponents(dish);
                              const isEvenCol = idx % 2 === 1;

                              if (row.key === 'main') {
                                return (
                                  <td
                                    key={day.key}
                                    className={cn(
                                      'border-r border-slate-200 text-center align-middle p-2 text-[12.5px] font-semibold text-slate-800',
                                      isEvenCol ? 'bg-slate-50/60' : 'bg-white'
                                    )}
                                  >
                                    {dish?.name ?? 'Chưa có catalog'}
                                  </td>
                                );
                              } else if (row.key === 'fruit') {
                                return (
                                  <td
                                    key={day.key}
                                    className={cn(
                                      'border-r border-slate-200 text-center align-middle p-2 text-[12.5px] font-medium text-slate-600',
                                      isEvenCol ? 'bg-slate-50/60' : 'bg-white'
                                    )}
                                  >
                                    {components.fruit}
                                  </td>
                                );
                              } else {
                                // sub1, sub2, rau, canh
                                return (
                                  <td
                                    key={day.key}
                                    className={cn(
                                      'border-r border-slate-200 text-center align-middle p-2 text-[12.5px] text-slate-700',
                                      isEvenCol ? 'bg-slate-50/60' : 'bg-white'
                                    )}
                                  >
                                    {components[row.key]}
                                  </td>
                                );
                              }
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>
        </div>
      )}

      {activeView === 'demand' && (
        <SectionPanel title="KHSX, kiểm tồn kho và nhu cầu xuất" icon={<Scale size={18} color="#475569" />}>
          <div className="flex flex-col gap-3">
            <DemandSummary lines={demandLines} />
            <DocumentRail
              documents={workflowDocuments.filter((document) =>
                ['KHSX', 'Danh sách mua thêm', 'Phiếu xuất'].includes(document.type),
              )}
              title="KHSX và chứng từ đầu ra"
            />
          </div>
        </SectionPanel>
      )}

      {/* Phân tích định lượng & giá vốn 1 khay ăn (Step 2) */}
      {activeView === 'cost' && (
        <>
          {foodCostPercent > 85 && (
            <InlineAlert
              title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!"
              variant="danger"
              className="mb-4"
            >
              Tỉ lệ giá vốn hiện tại đạt <b>{foodCostPercent.toFixed(1)}%</b>, vượt ngưỡng an toàn tối đa (85%). Nhân viên điều phối hoặc Bếp trưởng cần điều chỉnh giảm hao hụt sơ chế hoặc xem xét tăng đơn giá bán suất ăn của ca này.
            </InlineAlert>
          )}
          <SectionPanel
            title="Phân Tích Định Lượng & Giá Vốn 1 Khay Ăn"
            icon={<Scale size={18} color="#475569" />}
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-slate-600">Món phân tích:</span>
                <select
                  value={analyzedDish?.id ?? ''}
                  onChange={(e) => setSelectedDishId(e.target.value)}
                  className="ipc-select w-[220px] text-[13.5px]"
                  disabled={catalogDishes.length === 0}
                >
                  <optgroup label="Ca Sáng">
                    {catalogDishes.filter(d => matchesShift(d, 'morning')).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Ca Chiều">
                    {catalogDishes.filter(d => matchesShift(d, 'afternoon')).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </optgroup>
                  {catalogDishes.length === 0 && <option value="">Chưa có catalog</option>}
                </select>
              </div>
            }
          >
            {/* Khối thống kê biên lợi nhuận */}
            <div className="mb-6 mt-4">
              <ContextStrip
                items={[
                  { label: 'Đơn giá bán/suất', value: formatCurrency(menuPrice), tone: 'neutral' },
                  { label: 'Giá vốn nguyên liệu / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
                  {
                    label: 'Tỷ lệ giá vốn (Food Cost %)',
                    value: `${foodCostPercent.toFixed(1)}%`,
                    tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'success'
                  },
                  {
                    label: 'Lợi nhuận gộp / khay (Dự kiến)',
                    value: formatCurrency(Math.round(grossProfit)),
                    tone: grossProfit >= 0 ? 'success' : 'danger'
                  },
                ]}
              />
            </div>

        {/* Bảng chi tiết định lượng và chi phí từng nguyên liệu trong khay */}
        <DataTableShell className="ipc-cost-table-shell" ariaLabel="Bảng giá vốn nguyên liệu một khay">
          <table className="ipc-data-table ipc-cost-table">
            <thead>
              <tr>
                <th className={`${tableHeadClass} text-left`}>Nguyên liệu</th>
                <th className={tableHeadClass}>ĐV</th>
                <th className={tableHeadClass}>LT / suất</th>
                <th className={tableHeadClass}>TT / suất</th>
                <th className={tableHeadClass}>Nguồn giá</th>
                <th className={tableHeadClass}>Đơn giá</th>
                <th className={tableHeadClass}>Thành tiền / khay</th>
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
                  <td className={`${tableCellClass} font-medium text-green-800`}>{ing.supplierName}</td>
                  <td className={tableCellClass}>{formatCurrency(ing.supplierPrice)}</td>
                  <td className={`${tableCellClass} font-bold text-slate-950`}>
                    {formatCurrency(Math.round(ing.cost))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
          </SectionPanel>

          {/* Bảng tính định lượng tổng hợp nguyên liệu */}
          <SectionPanel
            title="Bảng Tính Định Lượng Tổng Hợp & Đề Xuất Mua Hàng"
            icon={<Scale size={18} color="#475569" />}
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
            <DataTableShell className="ipc-cost-table-shell" ariaLabel="Bảng định lượng tổng hợp và đề xuất mua hàng">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} text-left`}>Nguyên liệu</th>
                    <th className={tableHeadClass}>ĐV</th>
                    <th className={tableHeadClass}>LT</th>
                    <th className={tableHeadClass}>TT</th>
                    <th className={tableHeadClass}>Nguồn giá</th>
                    <th className={tableHeadClass}>Đơn giá</th>
                    <th className={tableHeadClass}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(materialSummary).map(([name, data]) => {
                    if (data.theory === 0) return null;

                    const rowCost = data.actual * data.referencePrice;

                    return (
                      <tr key={name} className="table-row">
                        <td className={`${tableCellClass} text-left font-bold`}>{name}</td>
                        <td className={tableCellClass}>{data.unit}</td>
                        <td className={tableCellClass}>{data.theory.toFixed(2)}</td>
                        <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>
                          {data.actual.toFixed(2)}
                        </td>
                        <td className={`${tableCellClass} font-medium text-green-800`}>Catalog backend</td>
                        <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td>
                        <td className={`${tableCellClass} font-bold`}>{formatCurrency(rowCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>
        </>
      )}

      {/* Dialog for global menu edit */}
      {isEditingMenu && (
        <Dialog open={isEditingMenu} onOpenChange={(open) => !open && setIsEditingMenu(false)}>
          <DialogContent className="ipc-weekly-dialog max-w-5xl">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-slate-900 font-bold text-lg">
                Chỉnh sửa Thực đơn tuần (T2 - T7)
              </DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 flex flex-col gap-6">
              {SECTIONS.map((sec) => (
                <div key={sec.label} className="border-b border-slate-200 pb-5 last:border-0 last:pb-0">
                  <h3 className="mb-3 rounded bg-slate-50 px-3 py-1.5 text-[13px] font-bold uppercase text-slate-800">
                    {sec.label}
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {DAYS_OF_WEEK.map((day) => {
                      const isLocked = !!lockedShifts[`${day.key}-${sec.slotType.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'}`];
                      const slot = tempWeeklyMenu[day.key]?.[sec.slotType];
                      
                      return (
                        <div key={day.key} className="p-2 border border-slate-200 rounded-md bg-white flex flex-col gap-1.5 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-semibold text-slate-700">{day.label}</span>
                            <span className="text-[10px] text-slate-400">{day.date}</span>
                          </div>
                          
                          {isLocked ? (
                            <div className="flex h-9 items-center justify-center gap-1.5 rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                              <Lock size={10} className="text-slate-400" />
                              <span>Đã khóa</span>
                            </div>
                          ) : (
                            <select
                              value={slot?.dishId || getSectionDefaultDish(sec)?.id || ''}
                              onChange={(e) => {
                                setTempWeeklyMenu((prev) => ({
                                  ...prev,
                                  [day.key]: {
                                    ...prev[day.key],
                                    [sec.slotType]: {
                                      ...prev[day.key]?.[sec.slotType],
                                      portions: prev[day.key]?.[sec.slotType]?.portions ?? 0,
                                      dishId: e.target.value,
                                    },
                                  },
                                }));
                              }}
                              className="ipc-select text-[12px] h-9 p-1 w-full"
                              disabled={getSectionDishes(sec).length === 0}
                            >
                              {getSectionDishes(sec).map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                              {getSectionDishes(sec).length === 0 && <option value="">Chưa có catalog</option>}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsEditingMenu(false)}
                className="ipc-button ipc-button-ghost"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="ipc-button ipc-button-primary"
              >
                Lưu thay đổi
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </OperationalFrame>
  );
};

export default WeeklyMenuPage;
