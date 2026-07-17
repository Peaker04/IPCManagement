import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uiCopy } from '@/lib/uiCopy';

interface PageStepperProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  label?: string;
  className?: string;
}

/**
 * Navigation for grouped pages (for example one production-plan page per day).
 * It intentionally has no item-count/range fields because the page represents
 * a domain group rather than a slice of rows.
 */
export function PageStepper({
  page,
  totalPages,
  onPageChange,
  ariaLabel = 'Điều hướng các trang',
  label,
  className,
}: PageStepperProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  if (safeTotalPages <= 1) {
    return null;
  }

  return (
    <nav className={cn('ipc-pagination-bar', className)} aria-label={ariaLabel}>
      <div className="ipc-pagination-range">
        {label ? `${label} · ` : ''}Trang {safePage}/{safeTotalPages}
      </div>
      <div className="ipc-pagination-actions">
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          aria-label={`${uiCopy.actions.previousPage}, trang ${Math.max(1, safePage - 1)} trong ${safeTotalPages}`}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="ipc-pagination-page" aria-live="polite">Trang {safePage}/{safeTotalPages}</span>
        <button
          type="button"
          className="ipc-pagination-button"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          aria-label={`${uiCopy.actions.nextPage}, trang ${Math.min(safeTotalPages, safePage + 1)} trong ${safeTotalPages}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
