import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, AlertTriangle, Inbox, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { WorkbenchSkeleton, type SkeletonGeometry } from './WorkbenchSkeleton';

export type EmptyScenario = 'true-empty' | 'prerequisite-blocked' | 'partial-data' | 'filter-empty';

export interface StateBoundaryProps {
  isLoading?: boolean;
  isFetching?: boolean;
  isPreviousData?: boolean;
  hasExistingData?: boolean;
  loadingVariant?: 'table' | 'cards' | 'matrix' | 'form';
  loadingGeometry?: SkeletonGeometry;
  customSkeleton?: ReactNode;
  error?: Error | string | null;
  onRetry?: () => void;
  isForbidden?: boolean;
  isModeConflict?: boolean;
  modeConflictMessage?: string;
  onSwitchMode?: () => void;
  isConflict?: boolean;
  conflictDetails?: string;
  onResolveConflict?: () => void;
  isPartial?: boolean;
  partialMessage?: string;
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
  isFetching,
  isPreviousData,
  hasExistingData,
  loadingVariant = 'table',
  loadingGeometry,
  customSkeleton,
  error,
  onRetry,
  isForbidden,
  isModeConflict,
  modeConflictMessage,
  onSwitchMode,
  isConflict,
  conflictDetails,
  onResolveConflict,
  isPartial,
  partialMessage,
  isEmpty,
  emptyScenario = 'true-empty',
  emptyTitle,
  emptyDescription,
  actionLabel,
  onAction,
  children,
  className,
}: StateBoundaryProps) {
  const errorStatus = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
  const showForbidden = isForbidden || errorStatus === 403;
  const showConflict = isConflict || errorStatus === 409;

  // 1. Initial Loading State (ONLY when there is no existing data to display)
  if (isLoading && !hasExistingData) {
    if (customSkeleton) {
      return <div className={clsx('flex-1 min-h-0 w-full flex flex-col', className)}>{customSkeleton}</div>;
    }

    return (
      <WorkbenchSkeleton
        geometry={loadingGeometry ?? { kind: loadingVariant === 'cards' ? 'table' : loadingVariant, columns: loadingVariant === 'matrix' ? 7 : 6, rows: loadingVariant === 'form' ? 4 : 12, toolbar: false }}
        className={className}
      />
    );
  }

  // 2. Permission-Denied State (403)
  if (showForbidden) {
    return (
      <div role="alert" className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 text-amber-600">
          <ShieldAlert size={24} strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Truy cập bị hạn chế</h3>
        <p className="text-xs text-slate-500 max-w-md mb-4">Bạn không có quyền xem hoặc thực hiện thao tác trên phân hệ này.</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  // 3a. Mode Isolation Conflict State (DOM-MODE-1)
  if (isModeConflict) {
    return (
      <div role="alert" className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
          <AlertTriangle size={24} strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Phân hệ yêu cầu Chế độ MRX</h3>
        <p className="text-xs text-slate-500 max-w-md mb-4">
          {modeConflictMessage || 'Hệ thống đang vận hành ở Chế độ Mặc định (DEFAULT). Theo nguyên tắc an toàn DOM-MODE-1, phân hệ Đối soát chỉ hoạt động khi kích hoạt Chế độ MRX trong phần Thiết lập nâng cao.'}
        </p>
        {onSwitchMode && (
          <Button variant="default" size="sm" onClick={onSwitchMode}>
            Chuyển sang Chế độ MRX
          </Button>
        )}
      </div>
    );
  }

  // 3b. Write-Reconciliation Conflict State (409)
  if (showConflict) {
    return (
      <div role="alert" className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mb-3">
          <AlertTriangle size={24} strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Xung đột dữ liệu đồng thời</h3>
        <p className="text-xs text-slate-500 max-w-md mb-4">
          {conflictDetails || (error instanceof Error ? error.message : null) || 'Bản ghi đã bị thay đổi bởi người dùng khác. Vui lòng làm mới để lấy dữ liệu mới nhất.'}
        </p>
        {onResolveConflict && (
          <Button variant="outline" size="sm" onClick={onResolveConflict}>
            Tải lại dữ liệu mới nhất
          </Button>
        )}
      </div>
    );
  }

  // 4. Error State (Non-destructive when existing data is available)
  if (error && errorStatus !== 403 && errorStatus !== 409) {
    const message = typeof error === 'string' ? error : error.message || 'Đã xảy ra lỗi khi tải dữ liệu.';
    if (hasExistingData) {
      // Non-destructive inline alert: keeps data visible and allows retry
      return (
        <div className={clsx('flex-1 min-h-0 w-full flex flex-col', className)}>
          <div role="alert" className="px-4 py-2 text-xs bg-rose-50 border-b border-rose-200 text-rose-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">Không thể tải dữ liệu</span>
              <span>: </span>
              <span>{message}</span>
            </div>
            {onRetry && (
              <Button variant="outline" size="xs" onClick={onRetry} className="h-6 px-2 text-xs">
                Thử lại
              </Button>
            )}
          </div>
          {children}
        </div>
      );
    }

    return (
      <div role="alert" className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center mb-3 text-rose-500">
          <AlertCircle size={24} strokeWidth={1.75} />
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

  // 5. Empty State Scenarios
  if (isEmpty) {
    const content = resolveEmptyContent(emptyScenario, emptyTitle, emptyDescription, actionLabel);

    return (
      <div className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
          <Inbox size={22} strokeWidth={1.75} />
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

  // 6. Partial State Banner & Content
  return (
    <div className={clsx('flex-1 min-h-0 w-full flex flex-col relative', className)}>
      {/* Subtle Micro-Progress Bar during background refetch / pagination */}
      {isFetching && hasExistingData && (
        <div aria-hidden="true" className="h-0.5 w-full bg-blue-600/80 animate-pulse shrink-0 absolute top-0 left-0 right-0 z-20" />
      )}
      {isPartial && (
        <div role="status" aria-live="polite" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between shrink-0">
          <span>{partialMessage || 'Dữ liệu hiển thị một phần do các ca sản xuất đang diễn ra.'}</span>
        </div>
      )}
      {(isPreviousData || (isFetching && hasExistingData)) ? (
        <div className="flex-1 min-h-0 w-full flex flex-col opacity-70 pointer-events-none transition-opacity duration-150" aria-busy="true">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
