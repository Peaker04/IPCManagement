import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert } from '@/components/common';
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
      <div className="min-h-[560px] rounded-md border border-slate-200 bg-white p-4" role="status" aria-label="Đang tải dữ liệu báo cáo">
        <div className="mb-4 flex items-center justify-between">
          <div className="ipc-table-skeleton-cell w-48 h-6" />
          <div className="ipc-table-skeleton-cell w-28 h-6" />
        </div>
        <div className="space-y-2.5">
          <div className="ipc-table-skeleton-cell h-9 w-full !bg-slate-100" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ipc-table-skeleton-cell h-10 w-full" />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="ipc-table-skeleton-cell w-32 h-5" />
          <div className="ipc-table-skeleton-cell w-48 h-8" />
        </div>
      </div>
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
