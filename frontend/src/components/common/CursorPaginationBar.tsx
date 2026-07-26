import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uiCopy } from '@/lib/uiCopy';

interface CursorPaginationBarProps {
  page: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Cursor pagination boundary. It deliberately exposes no total-page or
 * numeric-total fields because a cursor endpoint cannot safely provide them.
 */
export function CursorPaginationBar({
  page,
  hasNext,
  onPrevious,
  onNext,
  className,
  ariaLabel = 'Phân trang theo dữ liệu tiếp nối',
}: CursorPaginationBarProps) {
  const safePage = Math.max(1, page);

  return (
    <nav className={cn('ipc-pagination-bar', className)} aria-label={ariaLabel}>
      <div className="ipc-pagination-range">Trang {safePage}, tải theo cursor</div>
      <div className="ipc-pagination-actions">
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={safePage <= 1}
          onClick={onPrevious}
          aria-label={uiCopy.actions.previousPage}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="ipc-pagination-page" aria-live="polite">Trang {safePage}</span>
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={!hasNext}
          onClick={onNext}
          aria-label={uiCopy.actions.nextPage}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
