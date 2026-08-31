import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert, TableSkeleton } from '@/components/common';
import type { QueryView } from '@/lib/queryView';

interface ReportQueryBoundaryProps {
  view: QueryView<unknown>;
  children: ReactNode;
}

export function ReportQueryBoundary({ view, children }: ReportQueryBoundaryProps) {
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title="Không có quyền xem báo cáo" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert
        title="Không tải được dữ liệu báo cáo"
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        {view.message} Không thể kết luận báo cáo đang trống.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title="Chưa khởi tạo báo cáo" variant="info">{view.instruction}</InlineAlert>;
  }
  if (view.phase === 'loading') {
    return (
      <TableSkeleton
        columns={6}
        rows={8}
        ariaLabel="Đang tải dữ liệu báo cáo..."
      />
    );
  }

  return (
    <div className="relative">
      {view.isRefreshing && (
        <span className="pointer-events-none absolute right-3 top-2 z-10 rounded-sm bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm border border-slate-200" role="status">
          Đang cập nhật...
        </span>
      )}
      {children}
    </div>
  );
}
