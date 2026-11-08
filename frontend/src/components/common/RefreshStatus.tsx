import { cn } from '@/lib/utils';

interface RefreshStatusProps {
  children?: string;
  className?: string;
  ariaLabel?: string;
}

/** Non-blocking query refresh feedback that remains in document flow. */
export function RefreshStatus({ children = 'Đang cập nhật dữ liệu', className, ariaLabel }: RefreshStatusProps) {
  return (
    <div className={cn('ipc-refresh-status-slot', className)}>
      <span data-refresh-status="true" role="status" aria-label={ariaLabel} aria-live="polite">
        {children}
      </span>
    </div>
  );
}
