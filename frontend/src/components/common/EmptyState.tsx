import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { QueryErrorAlert } from './QueryErrorAlert';

interface EmptyStateBaseProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * `empty` = nghiệp vụ thật sự chưa có dữ liệu.
 * `error` = không tải được dữ liệu nên KHÔNG biết có dữ liệu hay không.
 *
 * Hai trạng thái này bắt buộc phải nhìn khác nhau: một danh sách rỗng vì lỗi
 * mạng mà hiển thị như "chưa có dữ liệu" sẽ khiến người dùng kết luận sai
 * nghiệp vụ (ví dụ: tuần này không cần mua nguyên liệu nào).
 * Nhánh `error` dùng lại `QueryErrorAlert` nên luôn có nút tải lại và
 * `role="alert"`; TypeScript bắt buộc truyền `onRetry`.
 */
type EmptyStateProps =
  | (EmptyStateBaseProps & { variant?: 'empty'; onRetry?: never; isRetrying?: never })
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
        {description ?? 'Không tải được dữ liệu nên chưa thể kết luận danh sách này đang rỗng. Hãy tải lại trước khi ra quyết định.'}
        {action}
      </QueryErrorAlert>
    );
  }

  return (
    <div className={cn('ipc-empty-state', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description && <p className="mt-1.5 max-w-[36ch] text-xs leading-relaxed text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
