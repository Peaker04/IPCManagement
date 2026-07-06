import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { StatusBadge } from './StatusBadge';
import type { WorkflowDocument } from '@/features/workflow';

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

export function DocumentRail({ documents, title = 'Chứng từ workflow', actionForDocument, pageSize = 4, className }: DocumentRailProps) {
  const [page, setPage] = useState(1);
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null);

  if (!documents.length) {
    return <div className={cn('ipc-document-rail is-empty', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageDocuments = documents.slice((safePage - 1) * pageSize, safePage * pageSize);
  const handleCopyDocumentId = async (documentId: string) => {
    try {
      await navigator.clipboard.writeText(documentId);
      setCopiedDocumentId(documentId);
      window.setTimeout(() => {
        setCopiedDocumentId((current) => (current === documentId ? null : current));
      }, 1400);
    } catch {
      setCopiedDocumentId(null);
    }
  };

  return (
    <aside className={cn('ipc-document-rail', className)} aria-label="Danh sách chứng từ workflow">
      {title && <h4>{title}</h4>}
      {pageDocuments.map((document) => (
        <article key={document.id} className={cn('ipc-document-card', toneClasses[document.tone])}>
          {/* Zone 1: Type + Title */}
          <div className="ipc-document-zone-identity">
            <span className="ipc-document-type-label">{document.type}</span>
            <strong>{document.title}</strong>
          </div>

          {/* Zone 2: Status + Summary */}
          <div className="ipc-document-zone-status">
            <StatusBadge variant={document.tone}>{document.status}</StatusBadge>
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
                  {copiedDocumentId === document.id ? <Check size={14} /> : <Copy size={14} />}
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

          {/* Zone 4: Owner */}
          <div className="ipc-document-zone-owner">
            <dt>Phụ trách</dt>
            <dd>{document.owner}</dd>
          </div>

          {actionForDocument?.(document)}
        </article>
      ))}
      <PaginationBar page={safePage} pageSize={pageSize} totalItems={documents.length} onPageChange={setPage} />
    </aside>
  );
}
