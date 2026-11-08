import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';
import { IdentifierText } from './IdentifierText';
import { TableViewport } from './TableViewport';
import { formatDateOnly, formatQuantityWithUnit } from '@/lib/formatters';
import type { DemandLine } from '@/types/workflow';
import { formatWorkflowStatus } from '@/lib/workflowConfig';

interface DemandSummaryProps {
  lines: DemandLine[];
  className?: string;
  sourceLabel?: string;
  showServiceDate?: boolean;
  renderAction?: (line: DemandLine) => ReactNode;
}

const formatVariance = (value: number, unit: string) => {
  if (value > 0) return `+${formatQuantityWithUnit(value, unit)}`;
  if (value < 0) return `-${formatQuantityWithUnit(Math.abs(value), unit)}`;
  return formatQuantityWithUnit(0, unit);
};

const shortenStatus = (status: string) => {
  const normalized = status.trim().toLocaleLowerCase('vi-VN');

  if (!normalized) return 'Chưa rõ';
  if (normalized.includes('tạo lại') || normalized.includes('sinh lại') || normalized.includes('lỗi thời')) return 'Cần sinh lại';
  if (normalized.includes('duyệt giá') || normalized.includes('ngoại lệ')) return 'Duyệt giá';
  if (normalized.includes('thiếu') || normalized.includes('chưa đủ')) return 'Thiếu hàng';
  if (normalized.includes('bếp xác nhận') || normalized.includes('chờ bếp')) return 'Chờ Bếp nhận';
  if (normalized.includes('tồn kho đủ') || normalized.includes('đủ') || normalized.includes('hoàn tất')) return 'Đủ hàng';

  return formatWorkflowStatus(status);
};

const shortenNextAction = (action: string) => {
  const normalized = action.trim().toLocaleLowerCase('vi-VN');

  if (!normalized) return 'Chưa rõ';
  if (normalized.includes('sinh lại') || normalized.includes('tạo lại')) return 'Sinh lại';
  if (normalized.includes('kiểm tra giá')) return 'Kiểm tra giá';
  if (normalized.includes('chọn nhà cung cấp')) return 'Chọn NCC';
  if (normalized.includes('đặt mua')) return 'Đặt mua';
  if (normalized.includes('đề xuất mua')) return 'Đề xuất mua';
  if (normalized.includes('phiếu xuất kho') || normalized.includes('xuất kho')) return 'Xuất kho';
  if (normalized.includes('không cần')) return 'Không cần';

  return action.length > 24 ? `${action.slice(0, 21).trim()}...` : action;
};

export function DemandSummary({ lines, className, sourceLabel = 'Nguồn', showServiceDate = false, renderAction }: DemandSummaryProps) {
  if (!lines.length) {
    return (
      <EmptyState
        title="Chưa có nhu cầu nguyên liệu."
        className={cn('ipc-demand-summary is-empty !min-h-0 !items-stretch !justify-start !p-4 !text-left', className)}
      />
    );
  }

  return (
    <div className={cn('ipc-demand-summary', className)}>
      <TableViewport className="ipc-demand-summary-shell" ariaLabel="Bảng tổng hợp nhu cầu nguyên liệu" caption={showServiceDate ? 'Tổng hợp theo từng ngày trong khoảng đang xem' : 'Tổng hợp trong ngày đang xem'}>
        <table className="ipc-data-table ipc-erp-grid-table ipc-demand-table ipc-status-action-table table-fixed w-full min-w-[980px]">
          <thead>
            <tr>
              {showServiceDate && <th style={{ width: '10%' }} className="whitespace-nowrap text-left">Ngày</th>}
              <th style={{ width: showServiceDate ? '14%' : '18%' }} className="whitespace-nowrap text-left">Nguyên liệu</th>
              <th style={{ width: showServiceDate ? '18%' : '24%' }} className="whitespace-nowrap text-left">{sourceLabel}</th>
              <th style={{ width: showServiceDate ? '10%' : '11%' }} className="whitespace-nowrap text-right">Cần</th>
              <th style={{ width: showServiceDate ? '10%' : '11%' }} className="whitespace-nowrap text-right">Đã cấp</th>
              <th style={{ width: showServiceDate ? '10%' : '11%' }} className="whitespace-nowrap text-right">Chênh lệch</th>
              <th style={{ width: showServiceDate ? '13%' : '12%' }} className="whitespace-nowrap text-center">Trạng thái</th>
              <th style={{ width: showServiceDate ? '15%' : '13%' }} className="whitespace-nowrap text-center">Hướng xử lý</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const availableAfterReserve = line.available - line.reserved;
              const variance = availableAfterReserve - line.required;

              return (
                <tr key={`${line.id}-${index}`}>
                  {showServiceDate && <td className="whitespace-nowrap">{line.serviceDate ? formatDateOnly(line.serviceDate) : 'Chưa xác định'}</td>}
                  <td className="font-medium text-slate-900"><IdentifierText value={line.material} className="font-sans" /></td>
                  <td className="text-slate-600"><IdentifierText value={line.source} /></td>
                  <td className="ipc-numeric-cell text-right tabular-nums whitespace-nowrap">
                    {formatQuantityWithUnit(line.required, line.unit)}
                  </td>
                  <td className="ipc-numeric-cell text-right tabular-nums whitespace-nowrap">
                    {formatQuantityWithUnit(availableAfterReserve, line.unit)}
                  </td>
                  <td className={cn(
                    'ipc-numeric-cell text-right tabular-nums whitespace-nowrap font-semibold',
                    variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700',
                  )}>
                    {formatVariance(variance, line.unit)}
                  </td>
                  <td className="ipc-badge-cell text-center whitespace-nowrap">
                    <StatusBadge
                      variant={line.tone}
                      size="sm"
                      tooltip={line.status}
                      className="ipc-table-badge ipc-table-badge--status ipc-demand-status-badge"
                    >
                      {shortenStatus(line.status)}
                    </StatusBadge>
                  </td>
                  <td className="text-center whitespace-nowrap">
                    {renderAction?.(line) ?? (line.actionHref ? (
                      <Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={line.actionHref}>
                        {shortenNextAction(line.nextAction)}
                      </Link>
                    ) : (
                      <span className={cn('ipc-demand-next-action', `is-${line.tone}`)} title={line.nextAction}>
                        {shortenNextAction(line.nextAction)}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableViewport>
    </div>
  );
}
