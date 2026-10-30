import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useDeferredSkeleton } from '../../hooks/useDeferredSkeleton';

export interface LocalizedBoundaryProps {
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
  className?: string;
}

export function LocalizedBoundary({
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription = 'Không có bản ghi nào phù hợp với bộ lọc hiện tại.',
  children,
  className,
}: LocalizedBoundaryProps) {
  const isDeferredLoading = useDeferredSkeleton(Boolean(isLoading), 150, 250);

  if (isDeferredLoading) {
    return (
      <div
        data-testid="localized-skeleton"
        className={clsx('flex-1 min-h-[200px] w-full p-4 flex flex-col gap-3 animate-pulse bg-white', className)}
      >
        <div className="h-9 w-full bg-slate-100 rounded border border-slate-200/60" />
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full bg-slate-50 rounded border border-slate-100 flex items-center px-4 gap-4">
              <div className="h-3 w-1/6 bg-slate-200 rounded" />
              <div className="h-3 w-1/3 bg-slate-200 rounded" />
              <div className="h-3 w-1/4 bg-slate-200 rounded" />
              <div className="h-3 w-1/6 bg-slate-200 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading && !isDeferredLoading) {
    return <div className={clsx('flex-1 min-h-[200px] w-full bg-white', className)} aria-busy="true" />;
  }

  if (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Đã xảy ra lỗi tải dữ liệu';
    return (
      <div
        role="alert"
        className={clsx('flex-1 min-h-[200px] w-full flex flex-col items-center justify-center p-6 bg-white text-center', className)}
      >
        <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-2">
          <AlertCircle size={20} strokeWidth={2} />
        </div>
        <p className="text-sm font-semibold text-slate-800 mb-1">Không thể tải dữ liệu bảng</p>
        <p className="text-xs text-slate-500 max-w-md mb-3">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="flex items-center gap-1.5">
            <RotateCcw size={14} />
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={clsx('flex-1 min-h-[200px] w-full flex flex-col items-center justify-center p-6 bg-white text-center', className)}>
        <p className="text-sm font-semibold text-slate-700 mb-1">{emptyTitle}</p>
        <p className="text-xs text-slate-500 max-w-md">{emptyDescription}</p>
      </div>
    );
  }

  return <>{children}</>;
}
