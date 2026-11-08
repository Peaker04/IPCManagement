import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useDeferredSkeleton } from '../../hooks/useDeferredSkeleton';
import { WorkbenchSkeleton, type SkeletonGeometry } from './WorkbenchSkeleton';

export interface LocalizedBoundaryProps {
  isLoading?: boolean;
  loadingGeometry?: SkeletonGeometry;
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
  loadingGeometry = { kind: 'table', columns: 6, rows: 6 },
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
    return <WorkbenchSkeleton geometry={loadingGeometry} className={className} />;
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
