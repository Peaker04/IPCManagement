import { useMemo } from 'react';
import type { ColumnDef } from '../../components/workbench/DataGrid';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { formatMaterialName } from '../../utils/formatters';
import type { ReconciliationLineItem } from '../../api/reconciliationApi';

function formatCanonicalUnit(unit?: string | null): string {
  if (!unit) return '';
  const lower = unit.toLowerCase().trim();
  if (lower === 'kilogram' || lower === 'kg') return 'kg';
  if (lower === 'gram' || lower === 'g') return 'g';
  if (lower === 'piece' || lower === 'cái') return 'cái';
  return unit;
}

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
      width: '13%',
      minWidth: '125px',
      cell: (row) => <IdentifierText value={row.materialCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '21%',
      minWidth: '150px',
      cell: (row) => (
        <button
          type="button"
          onClick={() => onSelectDetailLine?.(row)}
          className="font-semibold text-slate-900 text-sm truncate hover:text-blue-600 hover:underline cursor-pointer text-left block w-full"
          title="Bấm để xem chi tiết đối soát của nguyên liệu này"
        >
          {formatMaterialName(row.materialName)}
        </button>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '6%',
      minWidth: '55px',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{formatCanonicalUnit(row.unit)}</span>,
    },
    {
      id: 'required',
      header: 'Nhu cầu đã khóa',
      width: '14%',
      minWidth: '135px',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="quantity" />,
    },
    {
      id: 'issued',
      header: 'Đã xuất theo sổ',
      width: '14%',
      minWidth: '135px',
      align: 'right',
      cell: (row) => row.issuedQuantity == null ? <span className="text-slate-400 font-mono text-xs">Chưa xuất</span> : <Num value={row.issuedQuantity} format="quantity" />,
    },
    {
      id: 'difference',
      header: 'Chênh lệch xuất',
      width: '14%',
      minWidth: '145px',
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
      minWidth: '145px',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.disposition ? 'success' : (row.triggers?.length ?? 0) > 0 ? 'warning' : 'neutral'} size="sm">
          {row.issuedQuantity == null ? 'Chưa có phiếu xuất' : (statusLabels[row.status] || row.status)}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '12%',
      minWidth: '110px',
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
