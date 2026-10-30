import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxKitchenCooking } from '../../../api/mrxApi';

export interface DishGroup {
  key: string;
  serviceDate: string;
  weekday: string;
  shiftName: string;
  dishCode: string;
  dishName: string;
  servings: number;
  rows: Array<MrxKitchenCooking['rows'][number]>;
}

export interface MrxCookingDishListBranchProps {
  groups: DishGroup[];
}

export function MrxCookingDishListBranch({ groups }: MrxCookingDishListBranchProps) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4 bg-slate-50/50">
      {groups.map((group) => (
        <section
          key={group.key}
          aria-label={`Món ${group.dishName}`}
          className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs"
        >
          {/* Dish Header */}
          <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{group.dishName}</h3>
                <span className="text-xs font-mono text-slate-500">({group.dishCode})</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {group.weekday} · {toVietnameseDate(group.serviceDate)} · {group.shiftName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Số suất:</span>
              <strong className="text-sm font-bold font-mono text-slate-900 tabular-nums">{group.servings}</strong>
              <Badge variant="info" size="sm">suất</Badge>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="h-8 px-3 text-left w-[35%]">Nguyên liệu</th>
                  <th className="h-8 px-3 text-center w-[12%]">ĐVT</th>
                  <th className="h-8 px-3 text-right w-[18%]">Định mức / suất</th>
                  <th className="h-8 px-3 text-right w-[15%]">Hao hụt (%)</th>
                  <th className="h-8 px-3 text-right w-[20%]">Tổng lượng cần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.rows.map((row, idx) => (
                  <tr key={`${row.ingredientCode}-${idx}`} className="h-9 hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 text-sm text-slate-900 truncate">
                      <span className="font-medium">{row.ingredientName}</span>
                      <span className="ml-1.5 text-xs font-mono text-slate-400">
                        <IdentifierText value={row.ingredientCode} />
                      </span>
                    </td>
                    <td className="px-3 text-center font-mono text-xs text-slate-600">
                      {row.unitName || 'kg'}
                    </td>
                    <td className="px-3 text-right font-mono text-sm tabular-nums text-slate-800">
                      <Num value={row.bomQuantityPerServing} format="quantity" />
                    </td>
                    <td className="px-3 text-right font-mono text-xs tabular-nums text-slate-500">
                      {row.wasteRatePercent != null ? `${row.wasteRatePercent}%` : '—'}
                    </td>
                    <td className="px-3 text-right font-mono text-sm font-bold tabular-nums text-slate-900">
                      <Num value={row.totalRequiredQuantity} format="quantity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
