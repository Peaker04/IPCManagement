import { useMemo, useState } from 'react';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { toVietnameseDate } from '../../utils/dates';
import type { MrxQuantityPreview } from '../../api/mrxApi';

interface MrxBatchPreviewSectionProps {
  preview: MrxQuantityPreview;
}

interface PreviewMaterialItem {
  key: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  totalRequiredQuantity: number;
  grossPerServing: number;
  dishes: string[];
}

interface PlanSummaryItem {
  id: string;
  planCode: string;
  serviceDate: string;
  shift: string;
  menuName: string;
  servings: number;
  dishes: string[];
  materialsCount: number;
}

export function MrxBatchPreviewSection({ preview }: MrxBatchPreviewSectionProps) {
  const [previewTab, setPreviewTab] = useState<'materials' | 'plans'>('materials');

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
      cell: (row) => (
        <span className="text-sm text-slate-900 font-medium truncate block">
          {row.dishes.join(' · ')}
        </span>
      ),
    },
  ], []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Preview Sub-tabs */}
      <div className="h-10 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreviewTab('materials')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              previewTab === 'materials'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Phân rã nguyên liệu định lượng ({previewMaterials.length} mặt hàng)
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('plans')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              previewTab === 'plans'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kế hoạch món & suất theo ca ({planSummaries.length} ca)
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Tổng suất ăn tuần: <strong className="font-mono text-slate-900">{totalWeekServings.toLocaleString('vi-VN')} suất</strong>
        </div>
      </div>

      {previewTab === 'materials' ? (
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
    </div>
  );
}
