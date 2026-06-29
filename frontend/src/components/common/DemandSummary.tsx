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
        <table className="ipc-data-table ipc-demand-table">
          <thead>
            <tr>
              <th>Nguyên liệu</th>
              <th>Nguồn</th>
              <th>Cần</th>
              <th>Khả dụng</th>
              <th>Dự trữ</th>
              <th>Trạng thái</th>
              <th>Tiếp theo</th>
            </tr>
          </thead>
          <tbody>
            {pageLines.map((line) => {
              const availableAfterReserve = line.available - line.reserved;
              const shortage = Math.max(line.required - availableAfterReserve, 0);

              return (
                <tr key={line.id}>
                  <td>{line.material}</td>
                  <td>{line.source}</td>
                  <td className="ipc-numeric-cell">
                    {formatQuantityWithUnit(line.required, line.unit)}
                  </td>
                  <td className="ipc-numeric-cell">
                    {formatQuantityWithUnit(availableAfterReserve, line.unit)}
                  </td>
                  <td className="ipc-numeric-cell">
                    {shortage > 0
                      ? `${formatQuantityWithUnit(shortage, line.unit)} thiếu`
                      : formatQuantityWithUnit(line.reserved, line.unit)}
                  </td>
                  <td className="ipc-badge-cell">
                    <StatusBadge variant={line.tone} className="ipc-table-badge ipc-table-badge--status">
                      {line.status}
                    </StatusBadge>
                  </td>
                  <td>{line.nextAction}</td>
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
