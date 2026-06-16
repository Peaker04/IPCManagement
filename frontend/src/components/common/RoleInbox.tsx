import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DataTableShell } from './DataTableShell';
import { PaginationBar } from './PaginationBar';
import { StatusBadge } from './StatusBadge';
import type { RoleInboxItem } from '@/features/workflow';

interface RoleInboxProps {
  items: RoleInboxItem[];
  title?: ReactNode;
  actionForItem?: (item: RoleInboxItem) => ReactNode;
  emptyText?: string;
  pageSize?: number;
  className?: string;
}

const toneClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function RoleInbox({
  items,
  title = 'Việc đang chờ theo vai trò',
  actionForItem,
  emptyText = 'Chưa có dữ liệu để hiển thị',
  pageSize = 4,
  className,
}: RoleInboxProps) {
  const [page, setPage] = useState(1);

  if (!items.length) {
    return <div className={cn('ipc-role-inbox is-empty', className)}>{emptyText}</div>;
  }

  const hasActions = Boolean(actionForItem);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className={cn('ipc-role-inbox', className)}>
      {title && <h4>{title}</h4>}
      <DataTableShell className="ipc-logistics-table-shell" ariaLabel="Bảng hàng đợi theo vai trò">
        <table className="ipc-data-table ipc-logistics-table ipc-role-inbox-table">
          <thead>
            <tr>
              <th className="text-left">Việc / chứng từ</th>
              <th className="text-center">Hạn xử lý</th>
              <th className="text-left">Phụ trách</th>
              {hasActions ? <th className="text-right">Thao tác</th> : null}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={item.id} className={cn('ipc-logistics-row', toneClasses[item.tone])}>
                <td className="text-left">
                  <div className="ipc-work-cell">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                </td>
                <td className="ipc-badge-cell text-left">
                  <StatusBadge variant={item.tone} className="ipc-due-badge ipc-table-badge ipc-table-badge--due">
                    {item.due}
                  </StatusBadge>
                </td>
                <td className="text-left">
                  <span className="ipc-muted-cell">{item.owner}</span>
                </td>
                {hasActions ? <td className="ipc-row-action-cell">{actionForItem?.(item)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
      <PaginationBar page={safePage} pageSize={pageSize} totalItems={items.length} onPageChange={setPage} />
    </div>
  );
}
