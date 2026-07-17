import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { usePaginatedRows } from '@/lib/usePaginatedRows';
import { StatusBadge } from './StatusBadge';
import { formatQuantityWithUnit } from '@/lib/formatters';
import type { ApprovalRecord } from '@/features/workflow';

interface ApprovalQueueProps {
  records: ApprovalRecord[];
  title?: ReactNode;
  actionForRecord?: (record: ApprovalRecord) => ReactNode;
  pageSize?: number;
  className?: string;
}

const toneClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function ApprovalQueue({ records, title = 'Hàng đợi duyệt vận hành', actionForRecord, pageSize = 4, className }: ApprovalQueueProps) {
  const { page, rows: pageRecords, totalItems, setPage } = usePaginatedRows(records, pageSize);

  if (!records.length) {
    return <div className={cn('ipc-approval-queue is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  return (
    <div className={cn('ipc-approval-queue', className)} role="region" aria-label="Hàng đợi duyệt vận hành">
      {title && <h4>{title}</h4>}
      {pageRecords.map((record, index) => (
        <article key={`${record.id}-${page}-${index}`} className={cn('ipc-approval-record', toneClasses[record.tone])}>
          {/* Zone 1: Title + Source + Action */}
          <div className="ipc-approval-zone-identity">
            <strong>{record.title}</strong>
            <p>{record.source}</p>
            <div className="ipc-approval-record-action" aria-label={`Hành động kế tiếp cho ${record.title}`}>
              <span>{record.nextAction}</span>
              {actionForRecord?.(record)}
            </div>
          </div>

          {/* Zone 2: Status + Reason */}
          <div className="ipc-approval-zone-status">
            <StatusBadge variant={record.tone}>{record.status}</StatusBadge>
            <p>{record.reason}</p>
          </div>

          {/* Zone 3: Metadata */}
          <dl className="ipc-approval-zone-meta">
            <div>
              <dt>Gửi bởi:</dt>
              <dd>{record.submittedBy}</dd>
            </div>
            <div>
              <dt>Hạn:</dt>
              <dd className="flex items-center">
                {record.deadline}
                {record.slaDeadline && (
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded border ml-2",
                    (() => {
                      const diffMs = new Date(record.slaDeadline).getTime() - new Date().getTime();
                      if (diffMs <= 0) return "bg-red-50 text-red-700 border-red-200";
                      if (diffMs / (1000 * 60 * 60) <= 4) return "bg-yellow-50 text-yellow-700 border-yellow-200";
                      return "bg-green-50 text-green-700 border-green-200";
                    })()
                  )}>
                    SLA: {(() => {
                      const diffMs = new Date(record.slaDeadline).getTime() - new Date().getTime();
                      if (diffMs <= 0) return "Quá hạn";
                      const hours = Math.floor(diffMs / (1000 * 60 * 60));
                      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      return `${hours}g ${mins}p`;
                    })()}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Phụ trách:</dt>
              <dd>{record.owner}</dd>
            </div>
          </dl>

          {/* Zone 4: Materials */}
          <ul className="ipc-approval-zone-materials">
            {record.materials.map((material, materialIndex) => (
              <li key={`${record.id}-${material.name}-${materialIndex}`}>
                <span>{material.name}</span>
                <strong>{formatQuantityWithUnit(material.quantity, material.unit)}</strong>
              </li>
            ))}
          </ul>
        </article>
      ))}
      <PaginationBar page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </div>
  );
}
