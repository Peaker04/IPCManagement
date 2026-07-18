import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { StatusBadge } from './StatusBadge';
import { TableViewport } from './TableViewport';
import { formatQuantityWithUnit } from '@/lib/formatters';
import type { DemandLine } from '@/features/workflow';
import { useLocalPagination } from '@/lib/useLocalPagination';
import { formatWorkflowStatus } from '@/features/workflow/workflowConfig';

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

const shortenStatus = (status: string) => {
  const normalized = status.trim().toLocaleLowerCase('vi-VN');

  if (!normalized) return 'Chưa rõ';
  if (normalized.includes('tạo lại') || normalized.includes('sinh lại')) return 'Cần sinh lại';
  if (normalized.includes('duyệt giá')) return 'Duyệt giá';
  if (normalized.includes('thiếu')) return 'Thiếu hàng';
  if (normalized.includes('tồn kho đủ')) return 'Đủ hàng';

  return formatWorkflowStatus(status);
};

const shortenNextAction = (action: string) => {
  const normalized = action.trim().toLocaleLowerCase('vi-VN');

  if (!normalized) return 'Chưa rõ';
  if (normalized.includes('sinh lại')) return 'Sinh lại';
  if (normalized.includes('tạo lại demand')) return 'Tạo lại demand';
  if (normalized.includes('kiểm tra giá')) return 'Kiểm tra giá';
  if (normalized.includes('chọn nhà cung cấp')) return 'Chọn NCC';
  if (normalized.includes('đặt mua')) return 'Đặt mua';
  if (normalized.includes('đề xuất mua')) return 'Đề xuất mua';
  if (normalized.includes('phiếu xuất kho')) return 'Xuất kho';
  if (normalized.includes('không cần')) return 'Không cần';

  return action.length > 24 ? `${action.slice(0, 21).trim()}...` : action;
};

export function DemandSummary({ lines, pageSize = 8, className }: DemandSummaryProps) {
  const { page, rows: pageLines, totalItems, setPage } = useLocalPagination(lines, pageSize);

  if (!lines.length) {
    return <div className={cn('ipc-demand-summary is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  return (
    <div className={cn('ipc-demand-summary', className)}>
      <TableViewport className="ipc-demand-summary-shell" ariaLabel="Bảng tổng hợp nhu cầu nguyên liệu" caption="Tổng hợp nhu cầu nguyên liệu theo ngày và ca">
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
                <tr key={`${line.id}-${page}-${index}`}>
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
                    <StatusBadge
                      variant={line.tone}
                      className="ipc-table-badge ipc-table-badge--status ipc-demand-status-badge"
                    >
                      <span title={line.status}>{shortenStatus(line.status)}</span>
                    </StatusBadge>
                  </td>
                  <td className="text-center whitespace-nowrap">
                    <span className={cn('ipc-demand-next-action', `is-${line.tone}`)} title={line.nextAction}>
                      {shortenNextAction(line.nextAction)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </div>
  );
}
