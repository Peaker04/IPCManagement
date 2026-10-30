import { useMemo, useState } from 'react';
import { Tabs } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { toVietnameseDate } from '../../utils/dates';
import type { MrxQuantityPreview } from '../../api/mrxApi';
import type { WeeklyMenuData } from '../../api/weeklyMenuApi';
import type { ScheduleDayColumn, WeeklyScheduleMatrixRow, ProductionPlanItem } from '../../types';
import { WeeklyScheduleView } from './views/WeeklyScheduleView';
import { MrxShiftDishesModal } from './MrxShiftDishesModal';

export interface MrxBatchPreviewSectionProps {
  preview: MrxQuantityPreview;
  customerCode?: string;
  customerName?: string;
}

export interface PreviewMaterialItem {
  key: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  totalRequiredQuantity: number;
  grossPerServing: number;
  dishes: string[];
}

export interface ShiftDishDetail {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishSlot?: string | null;
  displayOrder: number;
  materials: Array<{
    ingredientCode: string;
    ingredientName: string;
    canonicalUnitName: string;
    grossQuantityPerServing: number;
    requiredQuantity: number;
  }>;
}

export interface PlanSummaryItem {
  id: string;
  planCode: string;
  serviceDate: string;
  shift: string;
  menuName: string;
  servings: number;
  dishes: string[];
  dishesDetails: ShiftDishDetail[];
  materialsCount: number;
}

function resolveSlotLabel(slot?: string | null): string {
  if (!slot) return 'Món mặn';
  const s = slot.toLowerCase();
  if (s.includes('soup') || s.includes('canh')) return 'Món canh';
  if (s.includes('veg') || s.includes('xào') || s.includes('rau')) return 'Món xào';
  if (s.includes('fruit') || s.includes('dessert') || s.includes('trái')) return 'Tráng miệng / Trái cây';
  if (s.includes('side') || s.includes('phụ')) return 'Món phụ';
  return 'Món mặn';
}

function buildWeeklyMenuDataFromPreview(
  preview: MrxQuantityPreview,
  customerCode: string,
  customerName: string
): WeeklyMenuData {
  const plans = preview.plans || [];
  const dates = Array.from(new Set(plans.map((p) => p.serviceDate))).sort();
  const scheduleDays: ScheduleDayColumn[] = dates.map((date, index) => {
    const d = new Date(`${date}T00:00:00Z`);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return {
      dayName: dayNames[d.getUTCDay()] || `Ngày ${index + 1}`,
      dateStr: toVietnameseDate(date),
      cells: [],
    };
  });

  const matrixMap = new Map<string, WeeklyScheduleMatrixRow>();
  for (const plan of plans) {
    for (const line of plan.lines) {
      const shiftLabel = line.shift === 'MORNING' ? 'CA SÁNG' : line.shift === 'AFTERNOON' ? 'CA CHIỀU' : line.shift;
      for (const dish of line.dishes) {
        const isVegetarian = Boolean(
          (dish.dishSlot && (dish.dishSlot.toLowerCase().includes('veg') || dish.dishSlot.toLowerCase().includes('chay'))) ||
          dish.dishName.toLowerCase().includes('chay')
        );
        const variantLabel = isVegetarian ? 'CHAY' : 'MẶN';
        const sectionTitle = `MENU ${variantLabel} ${shiftLabel}`;
        const slotLabel = resolveSlotLabel(dish.dishSlot);
        const rowKey = `${sectionTitle} - ${slotLabel}`;
        const existing = matrixMap.get(rowKey) || {
          sectionTitle,
          slotLabel,
          days: {},
        };
        existing.days[plan.serviceDate] = dish.dishName;
        matrixMap.set(rowKey, existing);
      }
    }
  }

  const productionPlans: ProductionPlanItem[] = [];
  for (const plan of plans) {
    for (const line of plan.lines) {
      productionPlans.push({
        planId: line.quantityPlanLineId,
        planCode: plan.planCode,
        dishId: line.dishes[0]?.dishId || '',
        dishName: line.dishes[0]?.dishName || '',
        shiftName: line.shift,
        plannedServings: line.finalServings,
        serviceDate: plan.serviceDate,
        status: 'completed',
      });
    }
  }

  return {
    customerId: '',
    customerCode,
    customerName,
    weekStartDate: dates[0] || '',
    mealTargetPrice: 0,
    scheduleDays,
    matrixRows: Array.from(matrixMap.values()),
    demandRows: [],
    productionPlans,
    dishCosts: [],
    dailyMaterials: [],
  };
}

export function MrxBatchPreviewSection({ preview, customerCode, customerName }: MrxBatchPreviewSectionProps) {
  const [previewTab, setPreviewTab] = useState<'schedule' | 'materials' | 'plans'>('schedule');
  const [selectedShiftPlan, setSelectedShiftPlan] = useState<PlanSummaryItem | null>(null);

  const weeklyMenuData = useMemo<WeeklyMenuData | null>(() => {
    if (!preview?.plans || preview.plans.length === 0) return null;
    return buildWeeklyMenuDataFromPreview(preview, customerCode || '—', customerName || 'Khách hàng');
  }, [preview, customerCode, customerName]);

  const previewMaterials = useMemo<PreviewMaterialItem[]>(() => {
    if (!preview?.plans) return [];
    const map = new Map<string, PreviewMaterialItem>();

    for (const plan of preview.plans) {
      for (const line of plan.lines) {
        for (const dish of line.dishes) {
          for (const mat of dish.materials) {
            const key = mat.ingredientCode || mat.ingredientId;
            const existing = map.get(key);
            if (existing) {
              existing.totalRequiredQuantity += mat.requiredQuantity;
              if (!existing.dishes.includes(dish.dishName)) {
                existing.dishes.push(dish.dishName);
              }
            } else {
              map.set(key, {
                key,
                ingredientCode: mat.ingredientCode,
                ingredientName: mat.ingredientName,
                unit: mat.canonicalUnitName || mat.sourceUnitName || 'kg',
                totalRequiredQuantity: mat.requiredQuantity,
                grossPerServing: mat.grossQuantityPerServing,
                dishes: [dish.dishName],
              });
            }
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRequiredQuantity - a.totalRequiredQuantity);
  }, [preview]);

  const planSummaries = useMemo<PlanSummaryItem[]>(() => {
    if (!preview?.plans) return [];
    const list: PlanSummaryItem[] = [];
    for (const plan of preview.plans) {
      for (const line of plan.lines) {
        list.push({
          id: line.quantityPlanLineId,
          planCode: plan.planCode,
          serviceDate: plan.serviceDate,
          shift: line.shift === 'MORNING' ? 'Ca 1 (Sáng)' : line.shift === 'AFTERNOON' ? 'Ca 2 (Chiều)' : line.shift,
          menuName: line.menuName,
          servings: line.finalServings,
          dishes: line.dishes.map((d) => d.dishName),
          dishesDetails: line.dishes.map((d) => ({
            dishId: d.dishId,
            dishCode: d.dishCode,
            dishName: d.dishName,
            dishSlot: d.dishSlot,
            displayOrder: d.displayOrder,
            materials: d.materials.map((m) => ({
              ingredientCode: m.ingredientCode,
              ingredientName: m.ingredientName,
              canonicalUnitName: m.canonicalUnitName || m.sourceUnitName || 'kg',
              grossQuantityPerServing: m.grossQuantityPerServing,
              requiredQuantity: m.requiredQuantity,
            })),
          })),
          materialsCount: line.dishes.reduce((sum, d) => sum + d.materials.length, 0),
        });
      }
    }
    return list;
  }, [preview]);

  const totalWeekServings = useMemo(() => {
    return planSummaries.reduce((sum, p) => sum + p.servings, 0);
  }, [planSummaries]);

  const materialColumns = useMemo<ColumnDef<PreviewMaterialItem>[]>(() => [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '18%',
      cell: (row) => <IdentifierText value={row.ingredientCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '32%',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.ingredientName}</span>
          <span className="text-xs text-slate-500 truncate">Món sử dụng: {row.dishes.join(', ')}</span>
        </div>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-700">{row.unit}</span>,
    },
    {
      id: 'gross',
      header: 'Định mức / suất',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.grossPerServing} format="quantity" decimals={4} />,
    },
    {
      id: 'total',
      header: 'Tổng lượng cần đóng băng',
      width: '20%',
      align: 'right',
      cell: (row) => (
        <Num value={row.totalRequiredQuantity} format="quantity" suffix={` ${row.unit}`} className="font-bold text-slate-900 text-sm" />
      ),
    },
  ], []);

  const planColumns = useMemo<ColumnDef<PlanSummaryItem>[]>(() => [
    {
      id: 'code',
      header: 'Mã kế hoạch',
      width: '20%',
      cell: (row) => <IdentifierText value={row.planCode} />,
    },
    {
      id: 'date',
      header: 'Ngày phục vụ',
      width: '16%',
      cell: (row) => <span className="font-mono text-xs font-semibold">{toVietnameseDate(row.serviceDate)}</span>,
    },
    {
      id: 'shift',
      header: 'Ca sản xuất',
      width: '16%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.shift}</span>,
    },
    {
      id: 'servings',
      header: 'Số suất kế hoạch',
      width: '16%',
      align: 'right',
      cell: (row) => (
        <span className="font-mono text-sm font-bold text-slate-900">
          <Num value={row.servings} format="quantity" suffix=" suất" />
        </span>
      ),
    },
    {
      id: 'dishes',
      header: 'Món ăn trong ca',
      width: '32%',
      align: 'center',
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setSelectedShiftPlan(row)}
          className="h-7 px-3 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 border-slate-300"
        >
          <span>Xem ma trận món ({row.dishesDetails.length} món)</span>
        </Button>
      ),
    },
  ], []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Preview Sub-tabs */}
      <div className="h-11 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <Tabs
          items={[
            { id: 'schedule', label: 'Thực đơn tuần' },
            { id: 'materials', label: 'Định lượng nguyên liệu' },
            { id: 'plans', label: 'Kế hoạch theo ca' },
          ]}
          activeId={previewTab}
          onChange={(id) => setPreviewTab(id as 'schedule' | 'materials' | 'plans')}
          size="sm"
        />
        <div className="text-xs text-slate-500">
          Tổng suất ăn tuần: <strong className="font-mono text-slate-900">{totalWeekServings.toLocaleString('vi-VN')} suất</strong>
        </div>
      </div>

      {previewTab === 'schedule' ? (
        weeklyMenuData ? (
          <WeeklyScheduleView data={weeklyMenuData} showSubbar={false} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <p className="text-xs">Đang tải ma trận thực đơn tuần…</p>
          </div>
        )
      ) : previewTab === 'materials' ? (
        <DataGrid
          data={previewMaterials}
          columns={materialColumns}
          keyExtractor={(row) => row.key}
          emptyMessage="Chưa có dữ liệu phân rã nguyên liệu định lượng."
        />
      ) : (
        <DataGrid
          data={planSummaries}
          columns={planColumns}
          keyExtractor={(row) => row.id}
          emptyMessage="Chưa có dữ liệu kế hoạch món và suất ăn."
        />
      )}

      <MrxShiftDishesModal
        isOpen={Boolean(selectedShiftPlan)}
        onClose={() => setSelectedShiftPlan(null)}
        plan={selectedShiftPlan}
      />
    </div>
  );
}
