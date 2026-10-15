import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/button';

export type EmptyScenario = 'true-empty' | 'prerequisite-blocked' | 'partial-data' | 'filter-empty';

export interface StateBoundaryProps {
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyScenario?: EmptyScenario;
  emptyTitle?: string;
  emptyDescription?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}

function resolveEmptyContent(
  scenario: EmptyScenario,
  title?: string,
  desc?: string,
  action?: string
) {
  switch (scenario) {
    case 'prerequisite-blocked':
      return {
        title: title || 'Chưa hoàn thành bước tiên quyết',
        desc: desc || 'Dữ liệu chưa thể hiển thị do cần hoàn thành bước lập kế hoạch hoặc chốt số suất trước.',
        action: action || 'Chuyển đến bước trước',
      };
    case 'filter-empty':
      return {
        title: title || 'Không tìm thấy kết quả phù hợp',
        desc: desc || 'Không có bản ghi nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.',
        action: action || 'Xóa bộ lọc',
      };
    case 'partial-data':
      return {
        title: title || 'Dữ liệu chưa hoàn tất',
        desc: desc || 'Hệ thống đã ghi nhận một phần dữ liệu, cần bổ sung thêm các thông tin còn thiếu.',
        action: action || 'Cập nhật thêm',
      };
    case 'true-empty':
    default:
      return {
        title: title || 'Chưa có bản ghi nào',
        desc: desc || 'Bấm nút bên dưới để tạo bản ghi mới đầu tiên cho phân hệ này.',
        action: action || 'Tạo mới',
      };
  }
}

export function StateBoundary({
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyScenario = 'true-empty',
  emptyTitle,
  emptyDescription,
  actionLabel,
  onAction,
  children,
  className,
}: StateBoundaryProps) {
  // 1. Loading State (Geometric Compact Table Skeleton)
  if (isLoading) {
    return (
      <div className={clsx('flex-1 min-h-0 w-full flex flex-col p-4 space-y-2 bg-white', className)}>
        <div className="h-8 w-full bg-slate-100 rounded animate-pulse" />
        <div className="space-y-1.5 flex-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-full bg-slate-50 border border-slate-100 rounded flex items-center px-4 space-x-4 animate-pulse"
            >
              <div className="h-3 w-1/4 bg-slate-200 rounded" />
              <div className="h-3 w-1/3 bg-slate-200 rounded" />
              <div className="h-3 w-1/6 bg-slate-200 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    const message = typeof error === 'string' ? error : error.message || 'Đã xảy ra lỗi khi tải dữ liệu.';
    return (
      <div className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg mb-3">
          !
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Không thể tải dữ liệu</h3>
        <p className="text-xs text-slate-500 max-w-md mb-4">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  // 3. 4 Empty State Scenarios
  if (isEmpty) {
    const content = resolveEmptyContent(emptyScenario, emptyTitle, emptyDescription, actionLabel);

    return (
      <div className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center text-xl mb-3">
          ∅
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{content.title}</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{content.desc}</p>
        {content.action && onAction && (
          <Button variant="default" size="sm" onClick={onAction}>
            {content.action}
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
