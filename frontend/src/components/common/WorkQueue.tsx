import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkQueueItem {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}

interface WorkQueueProps {
  items: WorkQueueItem[];
  empty?: ReactNode;
  className?: string;
}

const queueToneClasses = {
  neutral: 'is-neutral',
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function WorkQueue({ items, empty, className }: WorkQueueProps) {
  if (items.length === 0) {
    return <div className={cn('ipc-work-queue is-empty', className)}>{empty ?? 'Chưa có việc cần xử lý.'}</div>;
  }

  return (
    <div className={cn('ipc-work-queue', className)}>
      {items.map((item, index) => (
        <div key={index} className={cn('ipc-work-queue-item', queueToneClasses[item.tone ?? 'neutral'])}>
          <div className="ipc-work-queue-marker">{item.icon ?? <ChevronRight size={16} />}</div>
          <div className="ipc-work-queue-copy">
            <div className="ipc-work-queue-title">{item.title}</div>
            {item.description && <div className="ipc-work-queue-description">{item.description}</div>}
            {item.meta && <div className="ipc-work-queue-meta">{item.meta}</div>}
          </div>
          {item.action && <div className="ipc-work-queue-action">{item.action}</div>}
        </div>
      ))}
    </div>
  );
}
