import type { ReactNode } from 'react';
import { QueryErrorAlert, InlineAlert, RefreshStatus, TableSkeleton } from '@/components/common';
import type { QueryView } from '@/lib/queryView';
import { cn } from '@/lib/utils';

export interface AdminQueryEntry {
  label: string;
  view: QueryView<unknown>;
}

interface AdminQueryBoundaryProps {
  queries: AdminQueryEntry[];
  children: ReactNode;
  loadingFallback?: ReactNode;
  minHeight?: string;
}

/**
 * AdminQueryBoundary - Standardized Layout-Preserving Boundary (Rule C1, C6, E1, E8)
 * Ensures toolbar, search, filter, and headers never unmount during loading.
 * When loading, preserves min-height and prevents layout shift.
 */
export function AdminQueryBoundary({
  queries,
  children,
  loadingFallback,
  minHeight = 'min-h-[420px]',
}: AdminQueryBoundaryProps) {
  const validQueries = queries.filter(({ view }) => Boolean(view));
  const forbidden = validQueries.find(({ view }) => view.phase === 'forbidden');
  if (forbidden?.view.phase === 'forbidden') {
    return (
      <div className={cn('relative flex flex-col', minHeight)}>
        <InlineAlert title={`Không có quyền xem ${forbidden.label}`} variant="danger">
          <span role="alert">{forbidden.view.message}</span>
        </InlineAlert>
      </div>
    );
  }

  const failed = validQueries.find(({ view }) => view.phase === 'error');
  if (failed?.view.phase === 'error') {
    return (
      <div className={cn('relative flex flex-col', minHeight)}>
        <QueryErrorAlert
          title={`Không tải được ${failed.label}`}
          isRetrying={failed.view.isRetrying}
          onRetry={failed.view.retry}
        >
          {failed.view.message} Dữ liệu quản trị chưa được xác nhận.
        </QueryErrorAlert>
      </div>
    );
  }

  const uninitialized = validQueries.find(({ view }) => view.phase === 'uninitialized');
  if (uninitialized?.view.phase === 'uninitialized') {
    return (
      <div className={cn('relative flex flex-col', minHeight)}>
        <InlineAlert title={`Chưa khởi tạo ${uninitialized.label}`} variant="info">
          {uninitialized.view.instruction}
        </InlineAlert>
      </div>
    );
  }

  const loading = validQueries.find(({ view }) => view.phase === 'loading');
  if (loading) {
    if (loadingFallback) {
      return (
        <div className={cn('relative flex flex-col', minHeight)} aria-busy="true">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Đang tải {loading.label}
          </div>
          {loadingFallback}
        </div>
      );
    }

    return (
      <div className={cn('relative flex flex-col gap-2', minHeight)} aria-busy="true">
        <p className="text-xs font-medium text-slate-600">Đang tải {loading.label}</p>
        <TableSkeleton columns={6} rows={6} ariaLabel={`Đang tải ${loading.label}...`} />
      </div>
    );
  }

  const refreshingLabels = validQueries
    .filter(({ view }) => view.phase === 'ready' && view.isRefreshing)
    .map(({ label }) => label);

  return (
    <div className={cn('relative flex flex-col gap-3', minHeight)}>
      {refreshingLabels.length > 0 && <RefreshStatus ariaLabel={`Đang cập nhật ${refreshingLabels.join(', ')}`}>Đang cập nhật dữ liệu quản trị</RefreshStatus>}
      {children}
    </div>
  );
}
