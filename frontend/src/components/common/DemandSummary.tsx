import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { StatusBadge } from './StatusBadge';
import { DataTableShell } from './DataTableShell';
import { formatQuantityWithUnit } from '@/lib/formatters';
import type { DemandLine } from '@/features/workflow';

interface DemandSummaryProps {
  lines: DemandLine[];
  pageSize?: number;
  className?: string;
}

const formatVariance = (value: number, unit: string) => {
  if (value > 0) return `+${formatQuantityWithUnit(value, unit)}`;
  if (value < 0) return `-${formatQuantityWithUnit(Math.abs(value), unit)}`;
  return formatQuantityWithUnit(0, unit);
};

export function DemandSummary({ lines, pageSize = 8, className }: DemandSummaryProps) {
  const [page, setPage] = useState(1);

  if (!lines.length) {
    return <div className={cn('ipc-demand-summary is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageLines = lines.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className={cn('ipc-demand-summary', className)}>
      <DataTableShell className="ipc-demand-summary-shell" ariaLabel="Bảng tổng hợp nhu cầu nguyên liệu">
        <table className="ipc-data-table ipc-demand-table ipc-status-action-table table-fixed w-full">
          <thead>
            <tr>
              <th style={{ width: '18%' }} className="whitespace-nowrap text-left">Nguyên liệu</th>
              <th style={{ width: '22%' }} className="whitespace-nowrap text-left">Nguồn</th>
              <th style={{ width: '12%' }} className="whitespace-nowrap text-right">Cần</th>
              <th style={{ width: '12%' }} className="whitespace-nowrap text-right">Khả dụng</th>
              <th style={{ width: '12%' }} className="whitespace-nowrap text-right">Chênh lệch</th>
              <th style={{ width: '12%' }} className="whitespace-nowrap text-center">Trạng thái</th>
              <th style={{ width: '12%' }} className="whitespace-nowrap text-center">Tiếp theo</th>
            </tr>
          </thead>
          <tbody>
            {pageLines.map((line, index) => {
              const availableAfterReserve = line.available - line.reserved;
              const variance = availableAfterReserve - line.required;

              return (
                <tr key={`${line.id}-${safePage}-${index}`}>
                  <td className="truncate" title={line.material}>{line.material}</td>
                  <td className="truncate" title={line.source}>{line.source}</td>
                  <td className="ipc-numeric-cell text-right whitespace-nowrap">
                    {formatQuantityWithUnit(line.required, line.unit)}
                  </td>
                  <td className="ipc-numeric-cell text-right whitespace-nowrap">
                    {formatQuantityWithUnit(availableAfterReserve, line.unit)}
                  </td>
                  <td className={cn(
                    'ipc-numeric-cell text-right whitespace-nowrap font-semibold',
                    variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700',
                  )}>
                    {formatVariance(variance, line.unit)}
                  </td>
                  <td className="ipc-badge-cell text-center whitespace-nowrap">
                    <StatusBadge variant={line.tone} className="ipc-table-badge ipc-table-badge--status">
                      {line.status}
                    </StatusBadge>
                  </td>
                  <td className="text-center whitespace-nowrap">{line.nextAction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
      <PaginationBar page={safePage} pageSize={pageSize} totalItems={lines.length} onPageChange={setPage} />
    </div>
  );
}
