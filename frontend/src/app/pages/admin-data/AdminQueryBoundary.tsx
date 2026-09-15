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

function BlockingAdminState({ entry, loadingFallback }: { entry: AdminQueryEntry; loadingFallback?: ReactNode }) {
  const { label, view } = entry;
  if (view.phase === 'forbidden') {
    return <InlineAlert title={`Không có quyền xem ${label}`} variant="danger"><span role="alert">{view.message}</span></InlineAlert>;
  }
  if (view.phase === 'error') {
    return <QueryErrorAlert title={`Không tải được ${label}`} isRetrying={view.isRetrying} onRetry={view.retry}>{view.message} Dữ liệu quản trị chưa được xác nhận.</QueryErrorAlert>;
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title={`Chưa khởi tạo ${label}`} variant="info">{view.instruction}</InlineAlert>;
  }
  return loadingFallback ?? (
    <div className="flex flex-col gap-2" aria-busy="true">
      <p className="text-xs font-medium text-slate-600">Đang tải {label}</p>
      <TableSkeleton columns={6} rows={6} ariaLabel={`Đang tải ${label}...`} />
    </div>
  );
}

export function AdminQueryBoundary({ queries, children, loadingFallback, minHeight = 'min-h-0' }: AdminQueryBoundaryProps) {
  const validQueries = queries.filter(({ view }) => Boolean(view));
  const blocking = validQueries.find(({ view }) => view.phase === 'forbidden')
    ?? validQueries.find(({ view }) => view.phase === 'error')
    ?? validQueries.find(({ view }) => view.phase === 'uninitialized')
    ?? validQueries.find(({ view }) => view.phase === 'loading');
  const refreshingLabels = validQueries
    .filter(({ view }) => view.phase === 'ready' && view.isRefreshing)
    .map(({ label }) => label);

  return (
    <div className={cn('relative grid', minHeight)}>
      <div className="relative z-10 col-start-1 row-start-1">
        {blocking
          ? <BlockingAdminState entry={blocking} loadingFallback={loadingFallback} />
          : refreshingLabels.length > 0
            ? <RefreshStatus ariaLabel={`Đang cập nhật ${refreshingLabels.join(', ')}`}>Đang cập nhật dữ liệu quản trị</RefreshStatus>
            : null}
      </div>
      <div
        className={cn('col-start-1 row-start-1', blocking && 'invisible')}
        inert={Boolean(blocking) || undefined}
        aria-hidden={Boolean(blocking) || undefined}
      >
        {children}
      </div>
    </div>
  );
}
