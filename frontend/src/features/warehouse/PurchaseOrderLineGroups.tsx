import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { PurchaseOrderLineDto } from '@/api/workflowApiTypes';
import { Button } from '@/components/ui/button';
import { TableViewport } from '@/components/common';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import { formatWorkflowStatus } from '@/lib/workflowConfig';

type PurchaseOrderLineGroup = {
  key: string;
  ingredientName: string;
  unitName: string;
  orderedQty: number;
  receivedQty: number;
  lines: PurchaseOrderLineDto[];
};

const groupOrderLines = (lines: PurchaseOrderLineDto[]): PurchaseOrderLineGroup[] => {
  const groups = new Map<string, PurchaseOrderLineGroup>();
  lines.forEach((line) => {
    const key = `${line.ingredientId}__${line.unitId}`;
    const group = groups.get(key) ?? { key, ingredientName: line.ingredientName, unitName: line.unitName, orderedQty: 0, receivedQty: 0, lines: [] };
    group.orderedQty += line.orderedQty;
    group.receivedQty += line.receivedQty;
    group.lines.push(line);
    groups.set(key, group);
  });
  return Array.from(groups.values()).sort((left, right) => left.ingredientName.localeCompare(right.ingredientName, 'vi-VN'));
};

const requirementsFor = (line: PurchaseOrderLineDto) => [
  line.lotNumberRequired ? 'số lô' : null,
  line.manufactureDateRequired ? 'ngày sản xuất' : null,
  line.expiryDateRequired ? 'hạn sử dụng' : null,
].filter(Boolean) as string[];

const activeReceiptLabel = (line: PurchaseOrderLineDto) => line.activeReceiptCode
  ? `Đang chờ xử lý ở ${line.activeReceiptCode}${line.activeReceiptStatus ? ` (${formatWorkflowStatus(line.activeReceiptStatus)})` : ''}`
  : undefined;

export function PurchaseOrderLineGroups({ lines, canReceive, onReceive }: { lines: PurchaseOrderLineDto[]; canReceive: boolean; onReceive: (line: PurchaseOrderLineDto) => void }) {
  const [search, setSearch] = useState('');
  const [expandedGroupKey, setExpandedGroupKey] = useState<string>();
  const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');
  const groups = useMemo(() => groupOrderLines(lines).filter((group) => !normalizedSearch || group.lines.some((line) =>
    [line.ingredientName, line.purchaseOrderLineId].some((value) => value.toLocaleLowerCase('vi-VN').includes(normalizedSearch)))), [lines, normalizedSearch]);

  return (
    <>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label className="grid max-w-xl gap-1 text-xs font-semibold text-slate-600" htmlFor="purchase-order-line-search">
          Tìm nguyên liệu hoặc mã dòng đơn mua
          <span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input id="purchase-order-line-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 bg-white pl-9" /></span>
        </label>
      </div>
      <TableViewport ariaLabel="Nhóm dòng đơn mua chờ nhập kho" caption="Mỗi hàng là một nhóm nguyên liệu; mở nguồn để kiểm tra và ghi nhận nhập kho.">
      <table className="ipc-data-table min-w-[900px]">
        <thead><tr><th>Nguyên liệu</th><th>Đã nhận / đặt</th><th>Đơn giá đặt</th><th>Bằng chứng bắt buộc</th><th>Thao tác</th></tr></thead>
        <tbody>
          {groups.length === 0 ? <tr><td colSpan={5} className="h-40 text-center text-slate-600">Không có dòng đơn mua khớp bộ lọc.</td></tr> : groups.flatMap((group) => {
            const expanded = expandedGroupKey === group.key;
            const remaining = Math.max(group.orderedQty - group.receivedQty, 0);
            const prices = group.lines.map((line) => line.unitPrice);
            const requirements = Array.from(new Set(group.lines.flatMap(requirementsFor)));
            const blockerCount = group.lines.filter((line) => line.blockerReason).length;
            const activeReceiptCount = group.lines.filter((line) => line.activeReceiptId).length;
            const summary = (
              <tr key={group.key}>
                <td><span className="block font-semibold text-slate-900">{group.ingredientName}</span><span className="text-xs text-slate-500">{group.lines.length} dòng nguồn</span></td>
                <td>{group.receivedQty}/{group.orderedQty} {group.unitName}<span className="block text-xs text-slate-500">Còn {remaining} {group.unitName}</span></td>
                <td>{Math.min(...prices) === Math.max(...prices) ? formatCurrency(prices[0]) : `${formatCurrency(Math.min(...prices))}–${formatCurrency(Math.max(...prices))}`}</td>
                <td>{requirements.join(', ') || 'Không có yêu cầu bổ sung'}{blockerCount > 0 && <span className="block text-xs text-red-700">{blockerCount} dòng đang bị chặn</span>}{activeReceiptCount > 0 && <span className="block text-xs text-amber-800">{activeReceiptCount} dòng đã có phiếu chờ xử lý</span>}</td>
                <td>{group.lines.length === 1 ? (canReceive && <Button type="button" size="sm" disabled={remaining <= 0 || Boolean(group.lines[0].blockerReason) || Boolean(group.lines[0].activeReceiptId)} onClick={() => onReceive(group.lines[0])}>{remaining <= 0 ? 'Đã nhận đủ' : activeReceiptLabel(group.lines[0]) ?? 'Ghi nhận nhập kho'}</Button>) : <Button type="button" variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpandedGroupKey(expanded ? undefined : group.key)}>{expanded ? 'Đóng nguồn' : `Xem ${group.lines.length} nguồn`}</Button>}</td>
              </tr>
            );
            if (!expanded || group.lines.length === 1) return [summary];
            return [summary, <tr key={`${group.key}-sources`}><td colSpan={5} className="bg-slate-50 p-3"><ul className="grid gap-2" aria-label={`Các dòng đơn mua nguồn của ${group.ingredientName}`}>{group.lines.map((line) => {
              const lineRemaining = Math.max(line.orderedQty - line.receivedQty, 0);
              return <li key={line.purchaseOrderLineId} className="grid gap-2 rounded-sm border border-slate-200 bg-white p-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><span className="text-xs text-slate-600"><strong className="text-slate-900">{line.receivedQty}/{line.orderedQty} {line.unitName}</strong> · {formatCurrency(line.unitPrice)}<span className="block break-all">{line.purchaseOrderLineId}</span>{line.blockerReason && <span className="block text-red-700">{line.blockerReason}</span>}{activeReceiptLabel(line) && <span className="block text-amber-800">{activeReceiptLabel(line)}</span>}</span>{canReceive && <Button type="button" size="sm" disabled={lineRemaining <= 0 || Boolean(line.blockerReason) || Boolean(line.activeReceiptId)} onClick={() => onReceive(line)}>{lineRemaining <= 0 ? 'Đã nhận đủ' : activeReceiptLabel(line) ?? 'Ghi nhận dòng này'}</Button>}</li>;
            })}</ul></td></tr>];
          })}
        </tbody>
      </table>
      </TableViewport>
    </>
  );
}
