import { useMemo } from 'react';
import type { ColumnDef } from '../../components/workbench/DataGrid';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import type { ReconciliationLineItem } from '../../api/reconciliationApi';

export function useReconciliationColumns({
  statusLabels,
  isCompleted,
  onSelectDispositionLine,
  onSelectDetailLine,
}: {
  statusLabels: Record<string, string>;
  isCompleted: boolean;
  onSelectDispositionLine: (row: ReconciliationLineItem) => void;
  onSelectDetailLine?: (row: ReconciliationLineItem) => void;
}): ColumnDef<ReconciliationLineItem>[] {
  return useMemo<ColumnDef<ReconciliationLineItem>[]>(() => [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '16%',
      cell: (row) => <IdentifierText value={row.materialCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '28%',
      cell: (row) => (
        <button
          type="button"
          onClick={() => onSelectDetailLine?.(row)}
          className="font-semibold text-slate-900 text-sm truncate hover:text-blue-600 hover:underline cursor-pointer text-left block w-full"
          title="Bấm để xem chi tiết đối soát của nguyên liệu này"
        >
          {row.materialName}
        </button>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unit}</span>,
    },
    {
      id: 'required',
      header: 'Nhu cầu đã khóa',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="quantity" />,
    },
    {
      id: 'issued',
      header: 'Đã xuất theo sổ',
      width: '14%',
      align: 'right',
      cell: (row) => row.issuedQuantity == null ? <span className="text-slate-400 font-mono text-xs">Chưa xuất</span> : <Num value={row.issuedQuantity} format="quantity" />,
    },
    {
      id: 'difference',
      header: 'Chênh lệch xuất',
      width: '14%',
      align: 'right',
      cell: (row) => row.issuedRequiredDifference == null ? <span className="text-slate-400 font-mono text-xs">—</span> : (
        <Num
          value={row.issuedRequiredDifference}
          format="quantity"
          prefix={row.issuedRequiredDifference > 0 ? '+' : ''}
          className={row.issuedRequiredDifference === 0 ? 'text-slate-600' : 'text-amber-700 font-semibold'}
        />
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái dòng',
      width: '14%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.disposition ? 'success' : row.triggers.length > 0 ? 'warning' : 'neutral'} size="sm">
          {row.issuedQuantity == null ? 'Chưa có phiếu xuất' : (statusLabels[row.status] || row.status)}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '14%',
      align: 'right',
      cell: (row) => {
        if (row.disposition) {
          return (
            <Button
              variant="outline"
              size="xs"
              onClick={() => onSelectDispositionLine(row)}
              aria-label={`Xem hướng xử lý ${row.materialName}`}
            >
              Xem hướng xử lý
            </Button>
          );
        }
        if (row.issuedRequiredDifference != null && row.issuedRequiredDifference !== 0) {
          return (
            <Button
              variant="default"
              size="xs"
              onClick={() => onSelectDispositionLine(row)}
              aria-label={`Xử lý chênh lệch ${row.materialName}`}
              disabled={isCompleted}
            >
              Xử lý chênh lệch
            </Button>
          );
        }
        return (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onSelectDetailLine?.(row)}
            aria-label={`Xem chi tiết ${row.materialName}`}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Chi tiết
          </Button>
        );
      },
    },
  ], [statusLabels, isCompleted, onSelectDispositionLine, onSelectDetailLine]);
}
