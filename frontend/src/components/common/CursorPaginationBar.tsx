import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uiCopy } from '@/lib/uiCopy';

interface CursorPaginationBarProps {
  page: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
  ariaLabel?: string;
  isPending?: boolean;
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
  isPending = false,
}: CursorPaginationBarProps) {
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const requestedFocusRef = useRef<'previous' | 'next' | null>(null);
  const safePage = Math.max(1, page);

  useEffect(() => {
    if (isPending || !requestedFocusRef.current) return;

    const preferredButton = requestedFocusRef.current === 'previous'
      ? previousButtonRef.current
      : nextButtonRef.current;
    const fallbackButton = requestedFocusRef.current === 'previous'
      ? nextButtonRef.current
      : previousButtonRef.current;

    if (preferredButton && !preferredButton.disabled) {
      preferredButton.focus();
    } else if (fallbackButton && !fallbackButton.disabled) {
      fallbackButton.focus();
    }

    requestedFocusRef.current = null;
  }, [hasNext, isPending, safePage]);

  return (
    <nav
      className={cn('ipc-pagination-bar', isPending && 'is-pending', className)}
      aria-label={ariaLabel}
      aria-busy={isPending || undefined}
    >
      <div className="ipc-pagination-range">
        {hasNext ? 'Dữ liệu tiếp nối' : 'Đã tải hết dữ liệu'}
      </div>
      <div className="ipc-pagination-actions">
        <button
          ref={previousButtonRef}
          type="button"
          className="ipc-pagination-button"
          disabled={isPending || safePage <= 1}
          onClick={() => {
            requestedFocusRef.current = 'previous';
            onPrevious();
          }}
          aria-label={uiCopy.actions.previousPage}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="ipc-pagination-page" aria-live="polite" aria-atomic="true">
          {isPending && <LoaderCircle className="ipc-pagination-spinner" size={14} aria-hidden="true" />}
          Trang {safePage}
        </span>
        <button
          ref={nextButtonRef}
          type="button"
          className="ipc-pagination-button"
          disabled={isPending || !hasNext}
          onClick={() => {
            requestedFocusRef.current = 'next';
            onNext();
          }}
          aria-label={uiCopy.actions.nextPage}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {isPending && <span className="sr-only" role="status">Đang tải trang {safePage}</span>}
    </nav>
  );
}
