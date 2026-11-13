import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { InlineBanner } from '../ui/inline-banner';
import { Button } from '../ui/button';
import { WorkbenchSkeleton, type SkeletonGeometry } from './WorkbenchSkeleton';

export interface LocalizedBoundaryProps {
  isLoading?: boolean;
  loadingGeometry?: SkeletonGeometry;
  hasExistingData?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  retryPending?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
  className?: string;
}

export function LocalizedBoundary({
  isLoading,
  loadingGeometry = { kind: 'table', columns: 6, rows: 6 },
  hasExistingData = false,
  error,
  onRetry,
  retryPending = false,
  isEmpty,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription = 'Không có bản ghi nào phù hợp với bộ lọc hiện tại.',
  children,
  className,
}: LocalizedBoundaryProps) {
  const status = error instanceof ApiError ? error.status : undefined;
  const isRecoverableError = Boolean(error && hasExistingData && (status === undefined || status >= 500));
  if (isLoading && !hasExistingData) {
    return <WorkbenchSkeleton geometry={loadingGeometry} className={className} />;
  }

  if (error && !isRecoverableError) {
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
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retryPending} className="flex items-center gap-1.5">
            <RotateCcw size={14} />
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty && !isRecoverableError) {
    return (
      <div className={clsx('flex-1 min-h-[200px] w-full flex flex-col items-center justify-center p-6 bg-white text-center', className)}>
        <p className="text-sm font-semibold text-slate-700 mb-1">{emptyTitle}</p>
        <p className="text-xs text-slate-500 max-w-md">{emptyDescription}</p>
      </div>
    );
  }

  return <div className={clsx('flex-1 min-h-0 flex flex-col', className)}>
    {children}
    {isRecoverableError && <InlineBanner variant="error" title="Không thể làm mới dữ liệu"
      actionLabel={onRetry ? 'Thử lại' : undefined} onAction={onRetry} isActionLoading={retryPending}
      className="shrink-0 rounded-none border-x-0 border-b-0 transition-none">
      {error instanceof Error ? error.message : error}
    </InlineBanner>}
  </div>;
}
