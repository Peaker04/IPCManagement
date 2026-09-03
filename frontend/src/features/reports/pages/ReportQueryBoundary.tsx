import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert, TableSkeleton, RefreshStatus } from '@/components/common';
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
        {view.message} Dữ liệu báo cáo chưa được xác nhận.
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
        <RefreshStatus>Đang cập nhật...</RefreshStatus>
      )}
      {children}
    </div>
  );
}
