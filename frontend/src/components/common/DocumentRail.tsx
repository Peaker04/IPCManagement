import { type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { StatusBadge } from './StatusBadge';
import { useLocalPagination } from '@/lib/useLocalPagination';
import { uiCopy } from '@/lib/uiCopy';
import type { WorkflowDocument } from '@/features/workflow';
import { formatWorkflowStatus } from '@/features/workflow/workflowConfig';
import { useToast } from './useToast';

interface DocumentRailProps {
  documents: WorkflowDocument[];
  title?: ReactNode;
  actionForDocument?: (document: WorkflowDocument) => ReactNode;
  pageSize?: number;
  className?: string;
}

const toneClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function DocumentRail({ documents, title = 'Chứng từ vận hành', actionForDocument, pageSize = 4, className }: DocumentRailProps) {
  const { toast } = useToast();
  const pagination = useLocalPagination(documents, pageSize);

  if (!documents.length) {
    return <div className={cn('ipc-document-rail is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  const handleCopyDocumentId = async (documentId: string) => {
    try {
      await navigator.clipboard.writeText(documentId);
      toast({ title: 'Đã sao chép mã chứng từ', description: documentId, variant: 'success' });
    } catch {
      toast({ title: 'Không thể sao chép mã chứng từ', description: 'Trình duyệt không cho phép truy cập clipboard.', variant: 'warning' });
    }
  };

  return (
    <aside className={cn('ipc-document-rail', className)} aria-label="Danh sách chứng từ vận hành">
      {title && <h4>{title}</h4>}
      {pagination.rows.map((document) => (
        <article key={document.id} className={cn('ipc-document-card', toneClasses[document.tone])}>
          {/* Zone 1: Type + Title */}
          <div className="ipc-document-zone-identity">
            <span className="ipc-document-type-label">{document.type}</span>
            <strong>{document.title}</strong>
          </div>

          {/* Zone 2: Status + Summary */}
          <div className="ipc-document-zone-status">
            <StatusBadge variant={document.tone}>{formatWorkflowStatus(document.status)}</StatusBadge>
            <p>{document.summary}</p>
          </div>

          {/* Zone 3: Doc ID + Key-value lines */}
          <dl className="ipc-document-zone-detail">
            <div className="ipc-document-code-field">
              <dt>Mã chứng từ</dt>
              <dd>
                <span className="ipc-document-code" title={document.id}>
                  {document.id}
                </span>
                <button
                  type="button"
                  className="ipc-document-copy-button"
                  aria-label={`Sao chép mã chứng từ ${document.id}`}
                  title="Sao chép mã chứng từ"
                  onClick={() => void handleCopyDocumentId(document.id)}
                >
                  <Copy size={14} />
                </button>
              </dd>
            </div>
            {document.lines.map((line) => {
              const isLongValue = line.value.toString().length > 18;
              return (
                <div
                  key={`${document.id}-${line.label}`}
                  style={isLongValue ? { gridColumn: 'span 2', whiteSpace: 'normal' } : { whiteSpace: 'nowrap' }}
                >
                  <dt>{line.label}</dt>
                  <dd className={line.tone ? `is-${line.tone}` : undefined}>{line.value}</dd>
                </div>
              );
            })}
          </dl>

          {/* Zone 4: Người phụ trách */}
          <dl className="ipc-document-zone-owner" aria-label="Người phụ trách">
            <dt>{uiCopy.workflow.owner}</dt>
            <dd>{document.owner}</dd>
          </dl>

          {actionForDocument?.(document)}
        </article>
      ))}
      <PaginationBar page={pagination.page} pageSize={pageSize} totalItems={pagination.totalItems} onPageChange={pagination.setPage} />
    </aside>
  );
}
