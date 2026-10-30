import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, AlertTriangle, Boxes, FileClock, FileCheck, FileSpreadsheet, SearchX, ShieldAlert, Truck, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { WorkbenchSkeleton, type SkeletonGeometry } from './WorkbenchSkeleton';
import { useDeferredSkeleton } from '../../hooks/useDeferredSkeleton';

export type EmptyScenario =
  | 'true-empty'
  | 'empty-first-use'
  | 'filter-empty'
  | 'empty-permission'
  | 'permission-restricted'
  | 'partial-data'
  | 'partial-degraded'
  | 'prerequisite-blocked';

export interface StateBoundaryProps {
  scope?: 'page' | 'widget';
  isLoading?: boolean;
  delayMs?: number;
  isFetching?: boolean;
  isPreviousData?: boolean;
  hasExistingData?: boolean;
  loadingVariant?: 'table' | 'cards' | 'matrix' | 'form';
  loadingGeometry?: SkeletonGeometry;
  customSkeleton?: ReactNode;
  customEmptyContent?: ReactNode;
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
  emptyIcon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  onResetFilters?: () => void;
  prerequisiteRoute?: string;
  prerequisiteLabel?: string;
  onNavigatePrerequisite?: () => void;
  contextDomain?: 'approvals' | 'purchasing' | 'reports' | 'warehouse' | 'chef' | 'coordination' | 'catalog' | 'default';
  children: ReactNode;
  className?: string;
}

function resolveEmptyIcon(scenario?: EmptyScenario, customIcon?: LucideIcon, domain?: string): LucideIcon {
  if (customIcon) return customIcon;
  if (domain === 'approvals') return FileCheck;
  if (domain === 'purchasing') return Truck;
  if (domain === 'reports') return FileSpreadsheet;
  if (domain === 'chef' || domain === 'coordination') return UtensilsCrossed;
  if (domain === 'warehouse') return Boxes;

  switch (scenario) {
    case 'filter-empty':
      return SearchX;
    case 'prerequisite-blocked':
      return FileClock;
    case 'empty-permission':
    case 'permission-restricted':
      return ShieldAlert;
    default:
      return Boxes;
  }
}

function resolveEmptyContent(
  scenario: EmptyScenario,
  title?: string,
  desc?: string,
  action?: string,
  prerequisiteLabel?: string
) {
  switch (scenario) {
    case 'empty-first-use':
      return {
        title: title || 'Chưa có dữ liệu khởi tạo',
        desc: desc || 'Chưa có bản ghi nào được tạo trong hệ thống. Bắt đầu bằng cách tạo bản ghi mới đầu tiên.',
        action: action || 'Tạo mới bản ghi',
      };
    case 'empty-permission':
    case 'permission-restricted':
      return {
        title: title || 'Giới hạn quyền xem dữ liệu',
        desc: desc || 'Tài khoản của bạn chưa được phân quyền truy cập hoặc xem vùng dữ liệu này.',
        action: action || undefined,
      };
    case 'prerequisite-blocked':
      return {
        title: title || (prerequisiteLabel ? `Chưa hoàn thành bước: ${prerequisiteLabel}` : 'Chưa hoàn thành bước tiên quyết'),
        desc: desc || (prerequisiteLabel ? `Cần hoàn thành bước ${prerequisiteLabel} trước khi thực hiện thao tác.` : 'Dữ liệu chưa thể hiển thị do cần hoàn thành bước lập kế hoạch hoặc chốt số suất trước.'),
        action: action || (prerequisiteLabel ? `Đi đến thiết lập: ${prerequisiteLabel}` : 'Chuyển đến bước trước'),
      };
    case 'filter-empty':
      return {
        title: title || 'Không tìm thấy kết quả phù hợp',
        desc: desc || 'Không có bản ghi nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.',
        action: action || 'Xóa bộ lọc (Reset Filters)',
      };
    case 'partial-degraded':
    case 'partial-data':
      return {
        title: title || 'Dữ liệu hiển thị một phần',
        desc: desc || 'Một số nguồn dữ liệu đang được đồng bộ hoặc gặp lỗi cục bộ, hiển thị dữ liệu khả dụng.',
        action: action || 'Thử lại kết nối',
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
  scope = 'page',
  isLoading,
  delayMs,
  isFetching: _isFetching,
  isPreviousData,
  hasExistingData,
  loadingVariant = 'table',
  loadingGeometry,
  customSkeleton,
  customEmptyContent,
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
  emptyIcon,
  actionLabel,
  onAction,
  onResetFilters,
  prerequisiteRoute,
  prerequisiteLabel,
  onNavigatePrerequisite,
  contextDomain,
  children,
  className,
}: StateBoundaryProps) {
  const errorStatus = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : error instanceof Error && error.message.includes('404')
    ? 404
    : undefined;
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const isLineageMissing409 = (errorStatus === 409 || !errorStatus) && (
    errorMessage.includes('LEGACY_') || errorMessage.includes('KITCHEN_FROZEN_LINEAGE_')
  );
  const showForbidden = isForbidden || errorStatus === 403;
  const showConflict = (isConflict || (errorStatus === 409 && !isLineageMissing409)) && !isModeConflict;
  const isResourceNotFound = errorStatus === 404;

  const skeletonDelay = typeof delayMs === 'number' ? delayMs : (process.env.NODE_ENV === 'test' ? 0 : 150);
  const isDeferredLoading = useDeferredSkeleton(Boolean(isLoading && !hasExistingData), skeletonDelay, 250);

  // 1. Initial Loading State (ONLY when deferred loading threshold has elapsed to prevent <150ms rapid flicker)
  if (isDeferredLoading && !hasExistingData) {
    if (customSkeleton) {
      return <div className={clsx('flex-1 min-h-0 w-full flex flex-col', className)}>{customSkeleton}</div>;
    }

    if (scope === 'widget') {
      return (
        <div className={clsx('w-full h-full min-h-[96px] bg-slate-50 border border-slate-200/60 rounded p-4 flex flex-col justify-between animate-pulse', className)}>
          <div className="h-3 w-1/3 bg-slate-200 rounded" />
          <div className="h-5 w-1/2 bg-slate-200 rounded my-2" />
          <div className="h-2.5 w-2/3 bg-slate-200 rounded" />
        </div>
      );
    }

    return (
      <WorkbenchSkeleton
        geometry={loadingGeometry ?? { kind: loadingVariant === 'cards' ? 'table' : loadingVariant, columns: loadingVariant === 'matrix' ? 7 : 6, rows: loadingVariant === 'form' ? 4 : 12, toolbar: false }}
        className={className}
      />
    );
  }

  // 1b. Fast Loading Window (<= 150ms): Suppress rapid skeleton flicker while network request resolves
  if (isLoading && !hasExistingData && !isDeferredLoading) {
    return <div className={clsx('flex-1 min-h-0 w-full flex flex-col bg-transparent', className)} aria-busy="true" />;
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
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Yêu cầu Chế độ Đối soát Nguyên liệu</h3>
        <p className="text-xs text-slate-500 max-w-md mb-4">
          {modeConflictMessage || 'Hệ thống đang ở Chế độ Mặc định. Phân hệ này yêu cầu kích hoạt Chế độ Đối soát Nguyên liệu (MRX) trong phần Thiết lập nâng cao.'}
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

  // 4. Error State (Non-destructive when existing data is available; excludes 404 which is an Empty State)
  if (error && !showForbidden && !showConflict && !isModeConflict && !isResourceNotFound && !isLineageMissing409) {
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

    if (scope === 'widget') {
      return (
        <div role="alert" className={clsx('p-3.5 rounded border border-rose-200 bg-rose-50/70 flex flex-col items-center justify-center text-center min-h-[96px] w-full', className)}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 mb-1">
            <AlertCircle size={14} className="text-rose-600 shrink-0" aria-hidden="true" />
            <span>Không thể tải khối dữ liệu</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2 max-w-xs">{message}</p>
          {onRetry && (
            <Button variant="outline" size="xs" onClick={onRetry} className="h-6 px-2 text-[11px] bg-white">
              Thử lại
            </Button>
          )}
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

  // 5. Empty State Scenarios (Triggered by isEmpty prop OR by 404 Not Found OR by legacy lineage missing)
  if (isEmpty || isResourceNotFound || isLineageMissing409) {
    const resolvedScenario = isResourceNotFound
      ? (emptyScenario || 'empty-first-use')
      : isLineageMissing409
      ? 'prerequisite-blocked'
      : emptyScenario;
    const content = resolveEmptyContent(resolvedScenario, emptyTitle, emptyDescription, actionLabel, prerequisiteLabel);
    const effectiveOnAction = onAction || onResetFilters || onNavigatePrerequisite || (prerequisiteRoute ? () => { window.location.href = prerequisiteRoute; } : undefined);

    const EmptyIcon = resolveEmptyIcon(resolvedScenario, emptyIcon, contextDomain);

    if (scope === 'widget') {
      return (
        <div className={clsx('p-3.5 rounded border border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center min-h-[96px] w-full', className)}>
          <EmptyIcon size={18} className="text-slate-400 mb-1" aria-hidden="true" />
          <p className="text-xs font-medium text-slate-700">{content.title}</p>
          <p className="text-[11px] text-slate-400 max-w-xs mb-2">{content.desc}</p>
          {content.action && effectiveOnAction && (
            <Button variant="outline" size="xs" onClick={effectiveOnAction} className="h-6 px-2 text-[11px] bg-white">
              {content.action}
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className={clsx('flex-1 min-h-0 w-full flex flex-col items-center justify-center p-8 bg-white text-center', className)}>
        <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
          <EmptyIcon size={22} strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{content.title}</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{content.desc}</p>
        {content.action && effectiveOnAction && (
          <Button variant="default" size="sm" onClick={effectiveOnAction}>
            {content.action}
          </Button>
        )}
        {/* Render actionable empty canvas content when provided */}
        {customEmptyContent && (
          <div className="mt-6 w-full max-w-xl text-left">
            {customEmptyContent}
          </div>
        )}
      </div>
    );
  }

  // 6. Partial State Banner & Content
  return (
    <div className={clsx('flex-1 min-h-0 w-full flex flex-col relative', className)}>
      {isPartial && (
        <div role="status" aria-live="polite" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between shrink-0">
          <span>{partialMessage || 'Dữ liệu hiển thị một phần do các ca sản xuất đang diễn ra.'}</span>
        </div>
      )}
      {isPreviousData ? (
        <div className="flex-1 min-h-0 w-full flex flex-col opacity-70 pointer-events-none select-none transition-opacity duration-150" aria-busy="true">
          {children}
        </div>
      ) : (
        <div className="flex-1 min-h-0 w-full flex flex-col transition-opacity duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
