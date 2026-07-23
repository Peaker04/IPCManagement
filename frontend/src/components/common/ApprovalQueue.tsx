import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { useLocalPagination } from '@/lib/useLocalPagination';
import { uiCopy } from '@/lib/uiCopy';
import { StatusBadge } from './StatusBadge';
import { formatQuantityWithUnit } from '@/lib/formatters';
import type { ApprovalRecord } from '@/features/workflow';
import { formatWorkflowStatus } from '@/features/workflow/workflowConfig';

interface ApprovalQueueProps {
  records: ApprovalRecord[];
  title?: ReactNode;
  actionForRecord?: (record: ApprovalRecord) => ReactNode;
  pageSize?: number;
  className?: string;
  selectedRecordId?: string;
}

const toneClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

const getTargetLabel = (targetType?: string) => {
  if (targetType === 'material-demand') return 'Nhu cầu nguyên liệu';
  if (targetType === 'purchase-price-exception') return 'Ngoại lệ giá';
  return null;
};

const formatCurrency = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('vi-VN')}%`;

const getEvidenceLabel = (value?: string | null) => {
  const normalized = value?.replaceAll(/[-_\s]/g, '').toUpperCase();
  if (normalized === 'EFFECTIVEQUOTATION') return 'Báo giá hiệu lực';
  if (normalized === 'LATESTVALIDRECEIPT') return 'Phiếu nhập hợp lệ gần nhất';
  return value || 'Chưa có loại bằng chứng';
};

export function ApprovalQueue({ records, title = 'Hàng đợi duyệt vận hành', actionForRecord, pageSize = 4, className, selectedRecordId }: ApprovalQueueProps) {
  const { page, rows: pageRecords, totalItems, setPage } = useLocalPagination(records, pageSize);

  if (!records.length) {
    return <div className={cn('ipc-approval-queue is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  return (
    <div className={cn('ipc-approval-queue', className)} role="region" aria-label="Hàng đợi duyệt vận hành">
      {title && <h4>{title}</h4>}
      {pageRecords.map((record) => {
        const targetLabel = getTargetLabel(record.targetType);
        const isMaterialDemand = record.targetType === 'material-demand';
        const isPriceException = record.targetType === 'purchase-price-exception';
        const visibleMaterials = record.materials.slice(0, 4);
        return (
        <article
          key={record.id}
          id={`approval-record-${record.id}`}
          tabIndex={-1}
          aria-current={selectedRecordId === record.id ? 'true' : undefined}
          className={cn(
            'ipc-approval-record',
            toneClasses[record.tone],
            selectedRecordId === record.id && 'ring-2 ring-blue-500 ring-offset-2',
          )}
        >
          {/* Zone 1: Title + Source + Action */}
          <div className="ipc-approval-zone-identity">
            <strong>{record.title}</strong>
            <p>{record.source}</p>
            {targetLabel && <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{targetLabel}</span>}
            <div
              className="ipc-approval-record-action"
              aria-label={`${actionForRecord ? 'Thao tác' : 'Hướng xử lý'} cho ${record.title}`}
            >
              {!actionForRecord && <span>{formatWorkflowStatus(record.nextAction)}</span>}
              {actionForRecord?.(record)}
            </div>
          </div>

          {/* Zone 2: Status + Reason */}
          <div className="ipc-approval-zone-status">
            <StatusBadge variant={record.tone}>{formatWorkflowStatus(record.status)}</StatusBadge>
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
                    Thời hạn xử lý: {(() => {
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
              <dt>{uiCopy.workflow.owner}:</dt>
              <dd>{record.owner}</dd>
            </div>
          </dl>

          {(isMaterialDemand || isPriceException) && (
            <dl className="grid gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2">
              {isMaterialDemand && (
                <>
                  <div><dt className="text-xs font-medium text-slate-500">Ngày phục vụ</dt><dd className="font-semibold text-slate-800">{record.serviceDate ?? 'Chưa có'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Phạm vi</dt><dd className="font-semibold text-slate-800">{record.scope === 'FULLDAY' ? 'Cả ngày (FULLDAY)' : record.scope ?? 'Chưa có'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Chứng từ nguồn</dt><dd className="font-mono text-xs font-semibold text-slate-800">{record.sourceDocumentCode ?? 'Chưa có'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Thiếu hụt</dt><dd className="font-semibold text-slate-800">{record.lineCount ?? record.materials.length} dòng thiếu</dd></div>
                </>
              )}
              {isPriceException && (
                <>
                  <div><dt className="text-xs font-medium text-slate-500">Nhà cung cấp</dt><dd className="font-semibold text-slate-800">{record.supplierName ?? 'Chưa có'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Nguyên liệu</dt><dd className="font-semibold text-slate-800">{record.materials[0]?.name ?? 'Chưa có'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Giá tham chiếu</dt><dd className="tabular-nums font-semibold text-slate-800">{record.referencePrice == null ? 'Chưa có' : formatCurrency(record.referencePrice)}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Giá đề xuất</dt><dd className="tabular-nums font-semibold text-slate-800">{record.proposedPrice == null ? 'Chưa có' : formatCurrency(record.proposedPrice)}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Chênh lệch do server tính</dt><dd className="tabular-nums font-semibold text-red-700">{record.variancePercent == null ? 'Chưa có' : formatSignedPercent(record.variancePercent)}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Bằng chứng</dt><dd className="font-semibold text-slate-800">{getEvidenceLabel(record.evidenceType)}{record.evidenceDate ? `, ngày ${record.evidenceDate}` : ''}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Đề xuất mua</dt><dd className="font-mono text-xs font-semibold text-slate-800">{record.source}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Phiên bản</dt><dd className="font-semibold text-slate-800">{record.proposalVersion == null ? 'Chưa có' : `Phiên bản ${record.proposalVersion}`}</dd></div>
                </>
              )}
            </dl>
          )}

          {/* Zone 4: Materials */}
          <ul className="ipc-approval-zone-materials">
            {visibleMaterials.map((material, materialIndex) => (
              <li key={`${record.id}-${material.name}-${material.unit}-${materialIndex}`}>
                <span>{material.name}</span>
                <strong>{formatQuantityWithUnit(material.quantity, material.unit)}</strong>
              </li>
            ))}
            {record.materials.length > visibleMaterials.length && (
              <li><span>Và {record.materials.length - visibleMaterials.length} nguyên liệu khác</span></li>
            )}
          </ul>
        </article>
        );
      })}
      <PaginationBar page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </div>
  );
}
