import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';
import { QueryErrorAlert } from './QueryErrorAlert';
import { Inbox, SearchX, ShieldAlert } from 'lucide-react';

interface EmptyStateBaseProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState - Supports 4 distinct domain empty states (Rule E2):
 * 1. `empty` / `uncreated`: Nghiệp vụ thật sự chưa tạo dữ liệu.
 * 2. `filtered`: Dữ liệu có tồn tại nhưng bộ lọc / tìm kiếm hiện tại không khớp.
 * 3. `error`: Lỗi mạng hoặc server (không thể kết luận rỗng, bắt buộc có nút thử lại).
 * 4. `forbidden`: Người dùng không có quyền truy cập dữ liệu này.
 */
export type EmptyStateVariant = 'empty' | 'uncreated' | 'filtered' | 'error' | 'forbidden';

type EmptyStateProps =
  | (EmptyStateBaseProps & { variant?: 'empty' | 'uncreated' | 'filtered' | 'forbidden'; onRetry?: never; isRetrying?: never })
  | (EmptyStateBaseProps & { variant: 'error'; onRetry: () => unknown; isRetrying?: boolean });

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = 'empty',
  onRetry,
  isRetrying,
}: EmptyStateProps) {
  if (variant === 'error') {
    return (
      <QueryErrorAlert title={title} onRetry={onRetry!} isRetrying={isRetrying} className={className}>
        {description ?? 'Không tải được dữ liệu nên chưa thể kết luận danh sách này đang rỗng. Hãy thử lại.'}
        {action}
      </QueryErrorAlert>
    );
  }

  const defaultIcons: Record<string, ReactNode> = {
    empty: <Inbox className="h-6 w-6 text-slate-400" />,
    uncreated: <Inbox className="h-6 w-6 text-slate-400" />,
    filtered: <SearchX className="h-6 w-6 text-slate-400" />,
    forbidden: <ShieldAlert className="h-6 w-6 text-amber-500" />,
  };

  const renderedIcon = icon ?? defaultIcons[variant];

  return (
    <div
      className={cn('ipc-empty-state flex min-h-0 flex-col items-center justify-center p-6 text-center', className)}
      data-empty-variant={variant}
    >
      {renderedIcon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100/80 text-slate-500">
          {renderedIcon}
        </div>
      )}
      <p className={cn(typography.body, 'font-semibold text-slate-700')}>{title}</p>
      {description && (
        <p className={cn(typography.caption, 'mt-1.5 max-w-[40ch] leading-relaxed text-slate-500 text-xs')}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
