import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationBar({ page, pageSize, totalItems, onPageChange, className }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <nav className={cn('ipc-pagination-bar', className)} aria-label="Phân trang danh sách">
      <div className="ipc-pagination-range">
        Hiển thị {start}-{end} / {totalItems}
      </div>
      <div className="ipc-pagination-actions">
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label={`Trang trước, trang ${Math.max(1, page - 1)} trong ${totalPages}`}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="ipc-pagination-page" aria-live="polite">
          Trang {page}/{totalPages}
        </span>
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label={`Trang sau, trang ${Math.min(totalPages, page + 1)} trong ${totalPages}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
