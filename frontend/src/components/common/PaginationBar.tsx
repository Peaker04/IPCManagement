import { useEffect, useMemo, useRef, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uiCopy } from '@/lib/uiCopy';
import { getPaginationMeta } from '@/lib/paginationMeta';

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
  isPending?: boolean;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  enablePageJump?: boolean;
}

export function PaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className,
  itemLabel,
  isPending = false,
  pageSizeOptions,
  onPageSizeChange,
  enablePageJump = true,
}: PaginationBarProps) {
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const requestedFocusRef = useRef<'previous' | 'next' | null>(null);
  const meta = getPaginationMeta(page, pageSize, totalItems);
  const normalizedPageSizes = useMemo(
    () => Array.from(new Set([meta.pageSize, ...(pageSizeOptions ?? [])].filter((value) => value > 0))).sort((a, b) => a - b),
    [meta.pageSize, pageSizeOptions],
  );

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
  }, [isPending, meta.hasNext, meta.hasPrevious, meta.page]);

  if (meta.totalItems <= meta.pageSize) {
    return null;
  }

  const showPageSize = Boolean(onPageSizeChange && pageSizeOptions?.length);
  const showPageJump = enablePageJump && meta.totalPages > 7;
  const rangeLabel = itemLabel ? `${meta.rangeLabel} ${itemLabel}` : meta.rangeLabel;
  const submitPageJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedPage = Number.parseInt(String(new FormData(event.currentTarget).get('page') ?? ''), 10);
    if (!Number.isFinite(requestedPage)) return;
    onPageChange(Math.min(meta.totalPages, Math.max(1, requestedPage)));
  };

  return (
    <nav
      className={cn('ipc-pagination-bar', isPending && 'is-pending', className)}
      aria-label="Phân trang danh sách"
      aria-busy={isPending || undefined}
    >
      <div className="ipc-pagination-range">
        {rangeLabel}
      </div>
      <div className="ipc-pagination-tools">
        {showPageSize && (
          <label className="ipc-pagination-size">
            <span>Số dòng</span>
            <select
              aria-label="Số dòng mỗi trang"
              value={meta.pageSize}
              disabled={isPending}
              onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
            >
              {normalizedPageSizes.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
        <div className="ipc-pagination-actions">
          <button
            ref={previousButtonRef}
            type="button"
            className="ipc-pagination-button"
            disabled={isPending || !meta.hasPrevious}
            onClick={() => {
              requestedFocusRef.current = 'previous';
              onPageChange(Math.max(1, meta.page - 1));
            }}
            aria-label={`${uiCopy.actions.previousPage}, trang ${Math.max(1, meta.page - 1)} trong ${meta.totalPages}`}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="ipc-pagination-page" aria-live="polite" aria-atomic="true">
            {isPending && <LoaderCircle className="ipc-pagination-spinner" size={14} aria-hidden="true" />}
            Trang {meta.page}/{meta.totalPages}
          </span>
          <button
            ref={nextButtonRef}
            type="button"
            className="ipc-pagination-button"
            disabled={isPending || !meta.hasNext}
            onClick={() => {
              requestedFocusRef.current = 'next';
              onPageChange(Math.min(meta.totalPages, meta.page + 1));
            }}
            aria-label={`${uiCopy.actions.nextPage}, trang ${Math.min(meta.totalPages, meta.page + 1)} trong ${meta.totalPages}`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {showPageJump && (
          <form className="ipc-pagination-jump" onSubmit={submitPageJump}>
            <input
              type="number"
              name="page"
              min={1}
              max={meta.totalPages}
              key={meta.page}
              defaultValue={meta.page}
              disabled={isPending}
              aria-label="Đi đến trang"
            />
            <button type="submit" disabled={isPending} aria-label="Đi đến trang đã nhập">Đi</button>
          </form>
        )}
      </div>
      {isPending && <span className="sr-only" role="status">Đang tải trang {meta.page}</span>}
    </nav>
  );
}
