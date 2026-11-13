import { getMrxShiftLabel } from '../../../constants/mrxConstants';
import { flushSync } from 'react-dom';
import { useEffect, useState } from 'react';
import { Boxes, SearchX } from 'lucide-react';
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
  emptyFilterState?: {
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
  };
}

export function MrxCookingDishListBranch({ groups, emptyFilterState }: MrxCookingDishListBranchProps) {
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
    master={groups.length > 0 ? <div>{groups.map(group => <section key={group.key} aria-label={`Món ${group.dishName} · ${group.menuVariant}`} className="border-b border-slate-200">
      <Button variant="ghost" className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-none px-3 py-2 text-left" aria-pressed={selected?.key === group.key} onClick={() => setSelectedKey(group.key)}>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{group.dishName}</span><span className="block text-xs font-normal text-slate-600">{toVietnameseDate(group.serviceDate)} · {getMrxShiftLabel(group.shiftName)} · <span>{group.menuVariant}</span></span></span>
        <span className="shrink-0 text-xs tabular-nums text-slate-700"><Num value={group.servings} decimals={0} /> suất</span>
      </Button>
    </section>)}</div> : emptyFilterState ? (
      <div className="flex-1 min-h-0 h-full flex flex-col items-center justify-center p-8 text-center bg-white">
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
          <SearchX size={22} strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{emptyFilterState.title}</h3>
        <p className="text-xs text-slate-500 max-w-xs mb-3 leading-relaxed">{emptyFilterState.description}</p>
        <Button variant="outline" size="xs" onClick={emptyFilterState.onAction}>
          {emptyFilterState.actionLabel}
        </Button>
      </div>
    ) : null}
    detail={selected ? <CookingDishDetail group={selected} /> : <CookingDishEmptyDetail />}
  />;
}

function CookingDishEmptyDetail() {
  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-white">
      <section className="flex-1 min-h-0 flex flex-col border-b border-slate-200">
        <div className="min-h-[52px] px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-semibold text-slate-600">Chi tiết nguyên liệu theo món</span>
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto">
          <table className="w-full h-full min-w-[640px] text-sm border-collapse table-fixed">
            <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200">
              <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="h-8 px-3 text-left w-[35%]">Nguyên liệu</th>
                <th className="h-8 px-3 text-center w-[12%]">ĐVT</th>
                <th className="h-8 px-3 text-right w-[18%]">Định mức / suất</th>
                <th className="h-8 px-3 text-right w-[15%]">Hao hụt (%)</th>
                <th className="h-8 px-3 text-right w-[20%]">Tổng lượng cần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="h-full">
                <td colSpan={5} className="h-full p-8 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
                      <Boxes size={22} strokeWidth={1.75} />
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                      Chọn món hoặc điều chỉnh bộ lọc để xem định mức nguyên liệu.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CookingDishDetail({ group }: { group: DishGroup }) {
  return (
    <div className="min-h-0 bg-white">
        <section
          aria-label={`Nguyên liệu ${group.dishName} · ${group.menuVariant}`}
          className="border-b border-slate-200"
        >
          {/* Dish Header */}
          <div className="min-h-[52px] px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Nguyên liệu · {group.dishName}</h3>
                <span className="text-xs font-semibold text-slate-600">{group.menuVariant}</span>
                {group.dishCode?.trim() && <span className="text-xs font-mono text-slate-500">({group.dishCode})</span>}
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
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200">
                <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="h-8 px-3 text-left w-[35%]">Nguyên liệu</th>
                  <th className="h-8 px-3 text-center w-[12%]">ĐVT</th>
                  <th className="h-8 px-3 text-right w-[18%]">Định mức / suất</th>
                  <th className="h-8 px-3 text-right w-[15%]">Hao hụt (%)</th>
                  <th className="h-8 px-3 text-right w-[20%]">Tổng lượng cần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.rows.map((row, idx) => (
                  <tr key={`${row.ingredientCode}-${idx}`} className="h-9 hover:bg-slate-50/60">
                    <td className="sticky left-0 bg-white px-3 text-sm text-slate-900">
                      <span className="font-medium">{row.ingredientName}</span>
                      {row.ingredientCode?.trim() && <span className="ml-1.5 text-xs font-mono text-slate-400">
                        <IdentifierText value={row.ingredientCode} />
                      </span>}
                    </td>
                    <td className="px-3 text-center font-mono text-xs text-slate-600">
                      {row.unitName || 'Chưa rõ đơn vị'}
                    </td>
                    <td className="px-3 text-right font-mono text-sm tabular-nums text-slate-800" title={row.quantityUnavailableReasonCode ? 'Thiếu bằng chứng quy đổi đóng băng; tổng lượng cần vẫn theo nguồn đã lưu.' : undefined}>
                      <Num value={row.bomQuantityPerServing} format="rate" />
                    </td>
                    <td className="px-3 text-right font-mono text-xs tabular-nums text-slate-500">
                      <Num value={row.wasteRatePercent} format="rate" suffix={row.wasteRatePercent != null ? '%' : ''} />
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
