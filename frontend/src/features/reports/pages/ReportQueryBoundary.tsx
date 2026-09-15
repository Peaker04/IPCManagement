import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert, RefreshStatus } from '@/components/common';
import type { QueryView } from '@/lib/queryView';

interface ReportQueryBoundaryProps {
  view: QueryView<unknown>;
  children: ReactNode;
}

function BlockingStatus({ view }: { view: Exclude<QueryView<unknown>, { phase: 'ready' }> }) {
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title="Không có quyền xem báo cáo" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert title="Không tải được dữ liệu báo cáo" isRetrying={view.isRetrying} onRetry={view.retry}>
        {view.message} Dữ liệu báo cáo chưa được xác nhận.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title="Chưa khởi tạo báo cáo" variant="info">{view.instruction}</InlineAlert>;
  }
  return <InlineAlert title="Đang tải dữ liệu báo cáo" variant="info">Vui lòng chờ trong giây lát.</InlineAlert>;
}

export function ReportQueryBoundary({ view, children }: ReportQueryBoundaryProps) {
  const isBlocked = view.phase !== 'ready';

  return (
    <div className="relative grid">
      <div className="relative z-10 col-start-1 row-start-1">
        {isBlocked ? <BlockingStatus view={view} /> : view.isRefreshing ? <RefreshStatus>Đang cập nhật...</RefreshStatus> : null}
      </div>
      <div
        className={`col-start-1 row-start-1 ${isBlocked ? 'invisible' : ''}`}
        inert={isBlocked || undefined}
        aria-hidden={isBlocked || undefined}
      >
        {children}
      </div>
    </div>
  );
}
