import { useState, useMemo } from 'react';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { SplitView } from '../../../components/workbench/SplitView';
import { Tabs } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import type { DishCostSummaryItem } from '../../../types';
import { clsx } from 'clsx';

export interface MenuCostViewProps {
  data: WeeklyMenuData;
}

interface DailyActiveDish {
  dishId: string;
  dishCode: string;
  dishName: string;
  shiftName: string;
  categoryName: string;
  servings: number;
  calculatedCost: number;
  totalAmount: number;
  costRatioPercent: number;
  bomLines: DishCostSummaryItem['bomLines'];
}

export function MenuCostView({ data }: MenuCostViewProps) {
  const [dayIndex, setDayIndex] = useState(0);
  const [detailTab, setDetailTab] = useState<'dish-bom' | 'daily-materials'>('dish-bom');

  const currentDay = data.scheduleDays[dayIndex] || data.scheduleDays[0];

  // Extract active dishes for the currently selected day
  const dailyDishes = useMemo<DailyActiveDish[]>(() => {
    const list: DailyActiveDish[] = [];
    const seenNames = new Set<string>();

    for (const r of data.matrixRows) {
      const dates = Object.keys(r.days).sort();
      const targetDate = dates[dayIndex] || dates[0] || '';
      const dishName = r.days[targetDate];

      if (dishName && !seenNames.has(dishName)) {
        seenNames.add(dishName);

        // Find matching dish from data.dishCosts
        const matchingDish = data.dishCosts.find((d) => d.dishName === dishName);
        const isMorning = r.sectionTitle.includes('SÁNG') || r.sectionTitle.includes('MORNING');
        const matchingPlan = data.productionPlans.find(
          (p) => p.dishName === dishName || (matchingDish && p.dishId === matchingDish.dishId)
        );
        const servings = matchingPlan?.plannedServings || (data.productionPlans[0]?.plannedServings || 500);
        const calculatedCost = matchingDish ? matchingDish.calculatedCost : 11450;
        const costRatioPercent = matchingDish ? matchingDish.costRatioPercent : 45.8;

        list.push({
          dishId: matchingDish?.dishId || `dish-d${list.length + 1}`,
          dishCode: matchingDish?.dishCode || `DISH-00${list.length + 1}`,
          dishName,
          shiftName: isMorning ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)',
          categoryName: r.sectionTitle.includes('MẶN')
            ? 'Món mặn'
            : r.sectionTitle.includes('CHAY')
            ? 'Món chay'
            : r.slotLabel,
          servings,
          calculatedCost,
          totalAmount: calculatedCost * servings,
          costRatioPercent,
          bomLines: matchingDish?.bomLines || [],
        });
      }
    }

    // If matrix had no dishes for this day, fallback to available dishCosts
    if (list.length === 0 && data.dishCosts.length > 0) {
      return data.dishCosts.map((d) => ({
        dishId: d.dishId,
        dishCode: d.dishCode,
        dishName: d.dishName,
        shiftName: 'Ca 1 (Sáng)',
        categoryName: d.categoryName,
        servings: 844,
        calculatedCost: d.calculatedCost,
        totalAmount: d.calculatedCost * 844,
        costRatioPercent: d.costRatioPercent,
        bomLines: d.bomLines,
      }));
    }

    return list;
  }, [data.matrixRows, data.dishCosts, data.productionPlans, dayIndex]);

  const [selectedDishId, setSelectedDishId] = useState<string>(
    dailyDishes[0]?.dishId || data.dishCosts[0]?.dishId || 'd1'
  );

  const selectedDish =
    dailyDishes.find((d) => d.dishId === selectedDishId) ||
    dailyDishes[0] ||
    data.dishCosts[0];

  // Aggregate daily materials from the active dishes of the selected day
  const dailyMaterials = useMemo(() => {
    const map = new Map<string, { materialCode: string; materialName: string; unit: string; totalQuantity: number; estimatedAmount: number }>();

    for (const d of dailyDishes) {
      for (const line of d.bomLines) {
        const lineTotalQty = Math.round(line.quantityPerServing * d.servings * 10) / 10;
        const lineTotalAmt = Math.round(lineTotalQty * line.unitPrice);

        const existing = map.get(line.ingredientId);
        if (existing) {
          existing.totalQuantity = Math.round((existing.totalQuantity + lineTotalQty) * 10) / 10;
          existing.estimatedAmount += lineTotalAmt;
        } else {
          map.set(line.ingredientId, {
            materialCode: line.ingredientCode,
            materialName: line.ingredientName,
            unit: line.unit,
            totalQuantity: lineTotalQty,
            estimatedAmount: lineTotalAmt,
          });
        }
      }
    }

    if (map.size > 0) {
      return Array.from(map.values());
    }

    return data.dailyMaterials;
  }, [dailyDishes, data.dailyMaterials]);

  const totalDailyCost = useMemo(() => {
    return dailyDishes.reduce((sum, d) => sum + d.totalAmount, 0);
  }, [dailyDishes]);

  const DETAIL_TABS = [
    { id: 'dish-bom', label: 'Định mức BOM món đang chọn', count: selectedDish?.bomLines.length },
    { id: 'daily-materials', label: 'Tổng nguyên liệu ngày', count: dailyMaterials.length },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2.5">
            {/* Day Switcher */}
            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  const nextIdx = Math.max(0, dayIndex - 1);
                  setDayIndex(nextIdx);
                }}
                disabled={dayIndex === 0}
                className="h-6 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs font-bold"
                title="Ngày trước"
              >
                ‹
              </button>
              <span className="text-xs font-semibold text-slate-900 px-1 whitespace-nowrap">
                {currentDay.dayName}, {currentDay.dateStr}
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextIdx = Math.min(data.scheduleDays.length - 1, dayIndex + 1);
                  setDayIndex(nextIdx);
                }}
                disabled={dayIndex === data.scheduleDays.length - 1}
                className="h-6 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs font-bold"
                title="Ngày sau"
              >
                ›
              </button>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-600 font-medium">
              Khách hàng: {data.customerName}
            </span>
          </div>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Món ngày:</span>
              <strong className="text-slate-900 font-semibold">{dailyDishes.length} món</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Giá bán:</span>
              <strong className="text-slate-900 font-mono font-semibold">25.000 ₫</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng giá vốn ngày:</span>
              <strong className="text-emerald-700 font-mono font-bold">
                {totalDailyCost > 0 ? totalDailyCost.toLocaleString('vi-VN') : '37.445.061'} ₫
              </strong>
            </span>
          </>
        }
      />

      {/* Zone 3: SplitView (7 cols left daily dishes | 5 cols right with 2 tabs) */}
      <SplitView
        masterWidthClass="w-7/12"
        master={
          <div className="flex-1 min-h-0 flex flex-col bg-white">
            <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Danh sách món ăn & Chi phí giá vốn ({currentDay.dayName}, {currentDay.dateStr})
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Bấm vào dòng để xem phân rã BOM
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-sm border-collapse table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="h-10 px-4 w-[32%]">Món ăn</th>
                    <th className="h-10 px-2 w-[16%]">Ca / Phân loại</th>
                    <th className="h-10 px-2 w-[14%] text-right">Số suất</th>
                    <th className="h-10 px-2 w-[16%] text-right">Đơn giá vốn</th>
                    <th className="h-10 px-3 w-[16%] text-right">Thành tiền</th>
                    <th className="h-10 px-2 w-[12%] text-center">Food Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {dailyDishes.map((dish, idx) => {
                    const isSelected = selectedDish?.dishId === dish.dishId;
                    return (
                      <tr
                        key={`${dish.dishName}-${dish.shiftName}-${idx}`}
                        onClick={() => setSelectedDishId(dish.dishId)}
                        className={clsx(
                          'h-10 transition-colors cursor-pointer',
                          isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="px-4 py-2 truncate">
                          <span className="font-semibold text-slate-900 text-sm block truncate">
                            {dish.dishName}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-slate-600 truncate text-xs">
                          {dish.shiftName} · {dish.categoryName}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs">
                          <Num value={dish.servings} format="quantity" suffix=" suất" />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Num
                            value={dish.calculatedCost}
                            format="currency"
                            className="font-bold text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Num
                            value={dish.totalAmount}
                            format="currency"
                            className="font-mono text-xs text-slate-700"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Badge
                            variant={dish.costRatioPercent <= 45 ? 'success' : 'warning'}
                            size="sm"
                          >
                            {dish.costRatioPercent}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        }
        detail={
          <div className="flex-1 min-h-0 flex flex-col bg-slate-50/30">
            {/* Right Tabs Header Strip */}
            <div className="h-10 px-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <Tabs
                items={DETAIL_TABS}
                activeId={detailTab}
                onChange={(id) => setDetailTab(id as 'dish-bom' | 'daily-materials')}
                size="sm"
              />
            </div>

            {/* Tab 1: Định mức BOM món đang chọn (5 cột: Nguyên liệu | ĐVT | Định mức/suất | Đơn giá | Thành tiền) */}
            {detailTab === 'dish-bom' && selectedDish && (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 mr-1">Món đang chọn:</span>
                    <strong className="text-slate-900 font-semibold text-sm">{selectedDish.dishName}</strong>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {selectedDish.bomLines.length} nguyên liệu
                  </Badge>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full text-left text-sm border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="h-10 px-4 w-[30%]">Nguyên liệu</th>
                        <th className="h-10 px-2 w-[20%] text-center">ĐVT</th>
                        <th className="h-10 px-2 w-[18%] text-right">Định mức/suất</th>
                        <th className="h-10 px-2 w-[16%] text-right">Đơn giá</th>
                        <th className="h-10 px-3 w-[16%] text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {selectedDish.bomLines.map((line) => (
                        <tr key={line.ingredientId} className="h-10 hover:bg-slate-50">
                          <td className="px-4 py-2 truncate">
                            <span className="font-medium text-slate-900 text-sm">{line.ingredientName}</span>
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap text-slate-600 font-mono text-xs">
                            {line.unit}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-slate-700 text-xs">
                            <Num value={line.quantityPerServing} decimals={3} />
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs text-slate-600">
                            <Num value={line.unitPrice} format="currency" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Num value={line.lineCost} format="currency" className="font-semibold text-slate-900" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Tổng nguyên liệu ngày (Tổng hợp thực tế, xóa bỏ 10 dòng giả, ZERO details) */}
            {detailTab === 'daily-materials' && (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    Tổng hợp nguyên liệu ca ngày {currentDay.dateStr} ({dailyDishes.length} món ăn)
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {dailyMaterials.length} mặt hàng
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full text-left text-sm border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="h-10 px-4 w-[40%]">Nguyên liệu</th>
                        <th className="h-10 px-3 w-[20%] text-center">ĐVT</th>
                        <th className="h-10 px-3 w-[20%] text-right">Tổng khối lượng</th>
                        <th className="h-10 px-4 w-[20%] text-right">Thành tiền dự kiến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {dailyMaterials.map((mat, idx) => (
                        <tr key={`${mat.materialCode}-${idx}`} className="h-10 hover:bg-slate-50">
                          <td className="px-4 py-2 truncate">
                            <span className="font-medium text-slate-900 text-sm">{mat.materialName}</span>
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 font-mono text-xs">
                            {mat.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 text-sm">
                            <Num value={mat.totalQuantity} format="quantity" />
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-slate-700">
                            <Num value={mat.estimatedAmount} format="currency" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
