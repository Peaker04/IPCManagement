import { useState } from 'react';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { SplitView } from '../../../components/workbench/SplitView';
import { Tabs } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import type { DishCostSummaryItem } from '../../../types';
import { clsx } from 'clsx';

export interface MenuCostViewProps {
  data: WeeklyMenuData;
}

export function MenuCostView({ data }: MenuCostViewProps) {
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedDishId, setSelectedDishId] = useState<string>(
    data.dishCosts[0]?.dishId || 'd1'
  );
  const [detailTab, setDetailTab] = useState<'dish-bom' | 'daily-materials'>('dish-bom');

  const currentDay = data.scheduleDays[dayIndex] || data.scheduleDays[0];

  const DETAIL_TABS = [
    { id: 'dish-bom', label: 'Định mức BOM món đang chọn' },
    { id: 'daily-materials', label: 'Tổng nguyên liệu ngày', count: data.dailyMaterials.length },
  ];

  const selectedDish = data.dishCosts.find((d) => d.dishId === selectedDishId) || data.dishCosts[0];

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
                onClick={() => setDayIndex((prev) => Math.max(0, prev - 1))}
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
                onClick={() => setDayIndex((prev) => Math.min(data.scheduleDays.length - 1, prev + 1))}
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
              <span className="text-slate-500">BOM:</span>
              <strong className="text-slate-900 font-semibold">{data.dishCosts.length} món</strong>
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
                37.445.061 ₫
              </strong>
            </span>
          </>
        }
        rightActions={
          <Button variant="outline" size="sm" className="text-xs font-medium">
            Xuất bảng chi phí
          </Button>
        }
      />

      {/* Zone 3: SplitView (7 cols left dish list | 5 cols right with 2 tabs) */}
      <SplitView
        masterWidthClass="w-7/12"
        master={
          <div className="flex-1 min-h-0 flex flex-col bg-white">
            <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Danh sách món ăn & Chi phí giá vốn
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Bấm vào dòng để xem phân rã BOM
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-sm border-collapse table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="h-10 px-4 w-[36%]">Món ăn</th>
                    <th className="h-10 px-3 w-[18%]">Phân loại</th>
                    <th className="h-10 px-3 w-[16%] text-right">Giá bán</th>
                    <th className="h-10 px-3 w-[16%] text-right">Giá vốn BOM</th>
                    <th className="h-10 px-4 w-[14%] text-center">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {data.dishCosts.map((dish: DishCostSummaryItem) => {
                    const isSelected = selectedDish?.dishId === dish.dishId;
                    return (
                      <tr
                        key={dish.dishId}
                        onClick={() => setSelectedDishId(dish.dishId)}
                        className={clsx(
                          'h-10 transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-blue-50/80 font-medium'
                            : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-900 text-sm truncate">
                              {dish.dishName}
                            </span>
                            <IdentifierText value={dish.dishCode} copyable={false} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 truncate text-sm">
                          {dish.categoryName}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Num value={dish.servingTargetPrice} format="currency" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Num
                            value={dish.calculatedCost}
                            format="currency"
                            className="font-bold text-slate-900"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
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

            {/* Tab 1: Định mức BOM món đang chọn */}
            {detailTab === 'dish-bom' && selectedDish && (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 mr-1">Món đang chọn:</span>
                    <strong className="text-slate-900 font-semibold">{selectedDish.dishName}</strong>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {selectedDish.bomLines.length} nguyên liệu
                  </Badge>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full text-left text-sm border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="h-10 px-4 w-[34%]">Nguyên liệu</th>
                        {/* Cột ĐVT rộng rãi (w-[20%] / min-w-[70px]) không bao giờ tràn chữ Kilogram */}
                        <th className="h-10 px-3 w-[20%] text-center">ĐVT</th>
                        <th className="h-10 px-3 w-[22%] text-right">Định mức/suất</th>
                        <th className="h-10 px-4 w-[24%] text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {selectedDish.bomLines.map((line) => (
                        <tr key={line.ingredientId} className="h-10 hover:bg-slate-50">
                          <td className="px-4 py-2 truncate">
                            <span className="font-medium text-slate-900 text-sm">{line.ingredientName}</span>
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 font-mono text-xs">
                            {line.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 text-sm">
                            <Num value={line.quantityPerServing} decimals={3} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Num value={line.lineCost} format="currency" className="font-semibold text-slate-900" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Tổng nguyên liệu ngày (29) — thay thế hoàn toàn thẻ <details> ở đáy trang */}
            {detailTab === 'daily-materials' && (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    Tổng hợp 29 nguyên liệu cho toàn bộ ca ngày {currentDay.dateStr}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {data.dailyMaterials.length} mặt hàng
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full text-left text-sm border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="h-10 px-4 w-[45%]">Nguyên liệu</th>
                        <th className="h-10 px-3 w-[18%] text-center">ĐVT</th>
                        <th className="h-10 px-4 w-[37%] text-right">Tổng khối lượng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {data.dailyMaterials.map((mat) => (
                        <tr key={mat.materialId} className="h-10 hover:bg-slate-50">
                          <td className="px-4 py-2 truncate">
                            <span className="font-medium text-slate-900 text-sm">{mat.materialName}</span>
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 font-mono text-xs">
                            {mat.unit}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900 text-sm">
                            <Num value={mat.totalQuantity} format="quantity" />
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
