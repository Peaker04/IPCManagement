import type { ReactNode } from 'react';
import { FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

interface TableEmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function TableEmptyState({
  title = 'Chưa có dữ liệu',
  description = 'Hiện tại chưa có bản ghi nào phù hợp với bộ lọc hoặc thời gian đã chọn.',
  icon,
  action,
  className,
}: TableEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center',
        className
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <FileQuestion className="h-5 w-5" />}
      </div>
      <h4 className={cn(typography.sectionTitle, 'text-slate-800 mb-1')}>{title}</h4>
      <p className={cn(typography.body, 'text-slate-500 max-w-sm mb-4')}>{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
