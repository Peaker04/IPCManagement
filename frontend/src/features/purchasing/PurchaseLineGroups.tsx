import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApiTypes';
import { Button } from '@/components/ui/button';
import { TableViewport } from '@/components/common';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDateOnly, formatQuantityWithUnit } from '@/lib/formatters';

type PurchaseLine = PurchaseWorkbenchServiceDate['purchaseLines'][number];

type PurchaseLineGroup = {
  key: string;
  ingredientName: string;
  unitName: string;
  purchaseQty: number;
  lines: PurchaseLine[];
};

const groupPurchaseLines = (lines: PurchaseLine[]): PurchaseLineGroup[] => {
  const groups = new Map<string, PurchaseLineGroup>();
  lines.forEach((line) => {
    const key = `${line.ingredientId}__${line.unitId}`;
    const group = groups.get(key) ?? {
      key,
      ingredientName: line.ingredientName,
      unitName: line.unitName,
      purchaseQty: 0,
      lines: [],
    };
    group.purchaseQty += line.purchaseQty;
    group.lines.push(line);
    groups.set(key, group);
  });
  return Array.from(groups.values()).sort((left, right) => left.ingredientName.localeCompare(right.ingredientName, 'vi-VN'));
};

const uniqueText = (values: Array<string | null | undefined>, empty: string) => {
  const unique = Array.from(new Set(values.filter((value): value is string => Boolean(value))));
  if (unique.length === 0) return empty;
  if (unique.length === 1) return unique[0];
  return `${unique.length} giá trị`;
};

export function PurchaseLineGroups({
  lines,
  selectedLineId,
  onLineChange,
}: {
  lines: PurchaseLine[];
  selectedLineId?: string;
  onLineChange: (lineId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expandedGroupKey, setExpandedGroupKey] = useState<string>();
  const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');
  const groups = useMemo(
    () => groupPurchaseLines(lines).filter((group) => !normalizedSearch || group.lines.some((line) =>
      [line.ingredientName, line.supplierName, line.purchaseRequestLineId]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('vi-VN').includes(normalizedSearch)))),
    [lines, normalizedSearch],
  );

  return (
    <>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label className="grid max-w-xl gap-1 text-xs font-semibold text-slate-600" htmlFor="purchase-line-search">
          Tìm nguyên liệu, nhà cung cấp hoặc mã dòng nguồn
          <span className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input id="purchase-line-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 bg-white pl-9" />
          </span>
        </label>
      </div>
      <TableViewport ariaLabel="Nhóm dòng nguyên liệu cần mua" caption="Mỗi hàng là một nhóm nguyên liệu; mở nguồn để xử lý từng dòng chứng từ.">
      <table className="ipc-data-table min-w-[900px] table-fixed">
        <thead>
          <tr>
            <th>Nguyên liệu</th>
            <th>Số lượng mua</th>
            <th>Nhà cung cấp</th>
            <th>Bằng chứng hiện tại</th>
            <th>Giá đề xuất</th>
            <th>Ngày giao</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr><td colSpan={7} className="h-[320px] text-center text-slate-600">Không có dòng nguyên liệu khớp bộ lọc.</td></tr>
          ) : groups.flatMap((group) => {
            const expanded = expandedGroupKey === group.key;
            const readyCount = group.lines.filter((line) => line.currentSupplierDecision).length;
            const prices = group.lines.map((line) => line.currentSupplierDecision?.proposedUnitPrice).filter((value): value is number => value != null);
            const priceLabel = prices.length === 0
              ? 'Chưa có'
              : Math.min(...prices) === Math.max(...prices)
                ? formatCurrency(prices[0])
                : `${formatCurrency(Math.min(...prices))}–${formatCurrency(Math.max(...prices))}`;
            const summary = (
              <tr key={group.key} className={group.lines.some((line) => line.purchaseRequestLineId === selectedLineId) ? 'bg-blue-50/60' : undefined}>
                <td><span className="block font-semibold text-slate-900">{group.ingredientName}</span><span className="text-xs text-slate-500">{group.lines.length} dòng nguồn</span></td>
                <td>{formatQuantityWithUnit(group.purchaseQty, group.unitName, { maximumFractionDigits: 3 })}</td>
                <td>{uniqueText(group.lines.map((line) => line.supplierName), 'Chưa chọn nhà cung cấp')}</td>
                <td>{readyCount}/{group.lines.length} dòng đã xác nhận</td>
                <td>{priceLabel}</td>
                <td>{uniqueText(group.lines.map((line) => line.currentSupplierDecision?.proposedDeliveryDate ? formatDateOnly(line.currentSupplierDecision.proposedDeliveryDate) : null), 'Chưa có')}</td>
                <td>
                  <Button type="button" variant="outline" size="sm" className="min-h-9 whitespace-nowrap max-md:min-h-11" aria-expanded={group.lines.length > 1 ? expanded : undefined} onClick={() => group.lines.length === 1 ? onLineChange(group.lines[0].purchaseRequestLineId) : setExpandedGroupKey(expanded ? undefined : group.key)}>
                    {group.lines.length === 1 ? (readyCount ? 'Xem quyết định' : 'Xem bằng chứng') : (expanded ? 'Đóng nguồn' : `Xem ${group.lines.length} nguồn`)}
                  </Button>
                </td>
              </tr>
            );
            if (!expanded || group.lines.length === 1) return [summary];
            return [summary, (
              <tr key={`${group.key}-sources`}>
                <td colSpan={7} className="bg-slate-50 p-3">
                  <ul className="grid gap-2" aria-label={`Các dòng nguồn của ${group.ingredientName}`}>
                    {group.lines.map((line) => (
                      <li key={line.purchaseRequestLineId} className="grid gap-2 rounded-sm border border-slate-200 bg-white p-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <span className="min-w-0 text-xs text-slate-600"><strong className="text-slate-900">{line.purchaseQty} {line.unitName}</strong> · {line.supplierName || 'Chưa chọn NCC'}<span className="block break-all">{line.purchaseRequestLineId}</span></span>
                        <Button type="button" variant="outline" size="sm" className="min-h-9" aria-pressed={selectedLineId === line.purchaseRequestLineId} onClick={() => onLineChange(line.purchaseRequestLineId)}>Mở dòng nguồn</Button>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )];
          })}
        </tbody>
      </table>
      </TableViewport>
    </>
  );
}
