import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
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
  const [page, setPage] = useState(1);

  if (!records.length) {
    return <div className={cn('ipc-approval-queue is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRecords = records.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className={cn('ipc-approval-queue', className)} role="region" aria-label="Hàng đợi duyệt vận hành">
      {title && <h4>{title}</h4>}
      {pageRecords.map((record, index) => (
        <article key={`${record.id}-${safePage}-${index}`} className={cn('ipc-approval-record', toneClasses[record.tone])}>
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
              <dd>{record.deadline}</dd>
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
      <PaginationBar page={safePage} pageSize={pageSize} totalItems={records.length} onPageChange={setPage} />
    </div>
  );
}
