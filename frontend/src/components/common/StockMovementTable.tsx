import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { StatusBadge } from './StatusBadge';
import { DataTableShell } from './DataTableShell';
import type { StockMovement } from '@/features/workflow';

interface StockMovementTableProps {
  movements: StockMovement[];
  pageSize?: number;
  className?: string;
}

const movementLabel = {
  receipt: 'Nhập kho',
  issue: 'Xuất kho',
  supplemental: 'Xuất bổ sung',
  return: 'Trả kho',
  adjustment: 'Điều chỉnh',
};

const typeClasses = {
  receipt: 'bg-white text-slate-700 border-slate-200',
  issue: 'bg-white text-slate-700 border-slate-200',
  supplemental: 'bg-white text-slate-700 border-slate-200',
  return: 'bg-white text-slate-700 border-slate-200',
  adjustment: 'bg-white text-slate-700 border-slate-200',
};

export function StockMovementTable({ movements, pageSize = 8, className }: StockMovementTableProps) {
  const [page, setPage] = useState(1);

  if (!movements.length) {
    return <div className={cn('ipc-stock-movement-table is-empty text-slate-500 text-center py-8 border border-dashed border-slate-200 bg-slate-50 rounded-sm', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  const totalPages = Math.max(1, Math.ceil(movements.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageMovements = movements.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className={cn('ipc-stock-movement-table', className)}>
      <DataTableShell ariaLabel="Bảng biến động kho" className="ipc-stock-movement-shell">
        <table className="ipc-data-table ipc-stock-table">
          <thead>
            <tr>
              <th className="text-left">Chứng từ</th>
              <th>Loại</th>
              <th>Nguyên liệu</th>
              <th className="text-right">Số lượng</th>
              <th>Phụ trách</th>
              <th>Trạng thái</th>
              <th>Tiếp theo</th>
            </tr>
          </thead>
          <tbody>
            {pageMovements.map((movement) => (
              <tr key={movement.id} className="transition-colors hover:bg-slate-50/50">
                <td className="font-mono text-[13px] font-semibold text-slate-700 text-left">{movement.documentNo}</td>
                <td className="ipc-badge-cell">
                  <span className={cn('ipc-table-badge ipc-table-badge--type rounded-sm border text-[11.5px] font-semibold leading-normal', typeClasses[movement.type])}>
                    <span className="ipc-table-badge-dot" aria-hidden="true" />
                    <span className="ipc-table-badge-label">{movementLabel[movement.type]}</span>
                  </span>
                </td>
                <td className="font-medium text-slate-800">{movement.material}</td>
                <td className="text-right font-mono font-bold text-slate-900">
                  {movement.quantity} <span className="text-xs text-slate-400 font-sans font-normal">{movement.unit}</span>
                </td>
                <td>{movement.owner}</td>
                <td className="ipc-badge-cell">
                  <StatusBadge variant={movement.tone} className="ipc-table-badge ipc-table-badge--status">
                    {movement.status}
                  </StatusBadge>
                </td>
                <td className="text-slate-600 text-[13px]">{movement.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
      <PaginationBar page={safePage} pageSize={pageSize} totalItems={movements.length} onPageChange={setPage} />
    </div>
  );
}
