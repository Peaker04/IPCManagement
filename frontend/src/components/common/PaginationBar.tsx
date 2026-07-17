import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uiCopy } from '@/lib/uiCopy';
import { getPaginationMeta } from '@/lib/paginationMeta';

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationBar({ page, pageSize, totalItems, onPageChange, className }: PaginationBarProps) {
  const meta = getPaginationMeta(page, pageSize, totalItems);

  if (meta.totalItems <= meta.pageSize) {
    return null;
  }

  return (
    <nav className={cn('ipc-pagination-bar', className)} aria-label="Phân trang danh sách">
      <div className="ipc-pagination-range">
        {meta.rangeLabel}
      </div>
      <div className="ipc-pagination-actions">
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={!meta.hasPrevious}
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
          aria-label={`${uiCopy.actions.previousPage}, trang ${Math.max(1, meta.page - 1)} trong ${meta.totalPages}`}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="ipc-pagination-page" aria-live="polite">
          Trang {meta.page}/{meta.totalPages}
        </span>
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(Math.min(meta.totalPages, meta.page + 1))}
          aria-label={`${uiCopy.actions.nextPage}, trang ${Math.min(meta.totalPages, meta.page + 1)} trong ${meta.totalPages}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
