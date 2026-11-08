import { getMrxShiftLabel } from '../../../constants/mrxConstants';
import { flushSync } from 'react-dom';
import { useEffect, useState } from 'react';
import { SplitView } from '../../../components/workbench/SplitView';
import { Button } from '../../../components/ui/button';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxKitchenCooking } from '../../../api/mrxApi';

export interface DishGroup {
  key: string;
  serviceDate: string;
  weekday: string;
  shiftName: string;
  menuVariant: string;
  dishCode: string;
  dishName: string;
  servings: number;
  rows: Array<MrxKitchenCooking['rows'][number]>;
}

export interface MrxCookingDishListBranchProps {
  groups: DishGroup[];
}

export function MrxCookingDishListBranch({ groups }: MrxCookingDishListBranchProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  const selected = groups.find(group => group.key === selectedKey) ?? groups[0];
  if (printing) return <div>{groups.map(group => <CookingDishDetail key={group.key} group={group} />)}</div>;
  return <SplitView
    masterWidthClass="w-full lg:w-5/12"
    hasActiveDetail={Boolean(selectedKey && groups.some(group => group.key === selectedKey))}
    onBackToMaster={() => setSelectedKey(null)}
    master={<div>{groups.map(group => <section key={group.key} aria-label={`Món ${group.dishName} · ${group.menuVariant}`} className="border-b border-slate-200">
      <Button variant="ghost" className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-none px-3 py-2 text-left" aria-pressed={selected?.key === group.key} onClick={() => setSelectedKey(group.key)}>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{group.dishName}</span><span className="block text-xs font-normal text-slate-600">{toVietnameseDate(group.serviceDate)} · {getMrxShiftLabel(group.shiftName)} · <span>{group.menuVariant}</span></span></span>
      </Button>
    </section>)}</div>}
    detail={selected ? <CookingDishDetail group={selected} /> : <p className="p-4 text-sm">Chọn món để xem nguyên liệu.</p>}
  />;
}

function CookingDishDetail({ group }: { group: DishGroup }) {
  return (
    <div className="min-h-0 bg-white">
        <section
          aria-label={`Nguyên liệu ${group.dishName} · ${group.menuVariant}`}
          className="border-b border-slate-200"
        >
          {/* Dish Header */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Nguyên liệu · {group.dishName}</h3>
                <span className="text-xs font-semibold text-slate-600">{group.menuVariant}</span>
                <span className="text-xs font-mono text-slate-500">({group.dishCode})</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {group.weekday} · {toVietnameseDate(group.serviceDate)} · {getMrxShiftLabel(group.shiftName)}
              </p>
            </div>
            <p className="text-sm text-slate-700 whitespace-nowrap">
              <strong className="font-semibold tabular-nums"><Num value={group.servings} decimals={0} /></strong> suất
            </p>
          </div>

          {/* Ingredients Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm border-collapse table-fixed">
              <thead className="sticky top-0 z-20">
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
                    <td className="sticky left-0 bg-white px-3 text-sm text-slate-900">
                      <span className="font-medium">{row.ingredientName}</span>
                      <span className="ml-1.5 text-xs font-mono text-slate-400">
                        <IdentifierText value={row.ingredientCode} />
                      </span>
                    </td>
                    <td className="px-3 text-center font-mono text-xs text-slate-600">
                      {row.unitName || 'Chưa rõ đơn vị'}
                    </td>
                    <td className="px-3 text-right font-mono text-sm tabular-nums text-slate-800" title={row.quantityUnavailableReasonCode ? 'Thiếu bằng chứng quy đổi đóng băng; tổng lượng cần vẫn theo nguồn đã lưu.' : undefined}>
                      <Num value={row.bomQuantityPerServing} format="rate" />
                    </td>
                    <td className="px-3 text-right font-mono text-xs tabular-nums text-slate-500">
                      {row.wasteRatePercent != null ? `${row.wasteRatePercent}%` : '—'}
                    </td>
                    <td className="px-3 text-right font-mono text-sm font-bold tabular-nums text-slate-900">
                      <Num value={row.totalRequiredQuantity} format="plain" decimals={6} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
