import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SplitWorkbenchProps {
  children: ReactNode;
  detail: ReactNode;
  detailLabel?: ReactNode;
  className?: string;
  primaryClassName?: string;
  detailClassName?: string;
}

/**
 * SplitWorkbench — bố cục dọc: bảng/nội dung chính trải toàn chiều rộng,
 * panel phụ (chứng từ, chi tiết ô) xếp xuống bên dưới dạng dải ngang.
 */
export function SplitWorkbench({ children, detail, detailLabel, className, primaryClassName, detailClassName }: SplitWorkbenchProps) {
  return (
    <div className={cn('ipc-split-workbench', className)}>
      {/* Phần chính: bảng trải full width */}
      <div className={cn('ipc-split-primary', primaryClassName)}>{children}</div>

      {/* Panel phụ: dải ngang bên dưới */}
      <aside
        className={cn('ipc-split-detail-strip', detailClassName)}
        aria-label={typeof detailLabel === 'string' ? detailLabel : undefined}
      >
        {detailLabel && <div className="ipc-split-detail-label">{detailLabel}</div>}
        <div className="ipc-split-detail-strip-body">{detail}</div>
      </aside>
    </div>
  );
}
