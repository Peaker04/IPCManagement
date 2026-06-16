import type { ReactNode } from 'react';
import { AlertTriangle, CircleCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ExceptionLaneItem {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}

interface ExceptionLaneProps {
  title?: ReactNode;
  items: ExceptionLaneItem[];
  empty?: ReactNode;
  className?: string;
}

const exceptionToneClasses = {
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

const exceptionIcons = {
  info: <Info size={16} />,
  success: <CircleCheck size={16} />,
  warning: <AlertTriangle size={16} />,
  danger: <AlertTriangle size={16} />,
};

export function ExceptionLane({ title, items, empty, className }: ExceptionLaneProps) {
  return (
    <aside className={cn('ipc-exception-lane', className)}>
      {title && <div className="ipc-exception-lane-title">{title}</div>}
      {items.length === 0 ? (
        <div className="ipc-exception-lane-empty">{empty ?? 'Không có ngoại lệ đang mở.'}</div>
      ) : (
        <div className="ipc-exception-lane-list">
          {items.map((item, index) => {
            const tone = item.tone ?? 'warning';
            return (
              <div key={index} className={cn('ipc-exception-item', exceptionToneClasses[tone])}>
                <span className="ipc-exception-icon">{exceptionIcons[tone]}</span>
                <div className="ipc-exception-copy">
                  <div className="ipc-exception-title">{item.title}</div>
                  {item.description && <div className="ipc-exception-description">{item.description}</div>}
                  {item.action && <div className="ipc-exception-action">{item.action}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
