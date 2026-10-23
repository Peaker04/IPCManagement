import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../ui/button';

export interface SplitViewProps {
  master: ReactNode;
  detail: ReactNode;
  masterWidthClass?: string;
  hasActiveDetail?: boolean;
  onBackToMaster?: () => void;
  className?: string;
}

/**
 * Zone 3: SplitView (Master-Detail Workbench)
 * Occupies 85% Viewport (calc(100dvh - 88px)).
 * Left: Master data table (independent scroll).
 * Right: Detail / breakdown panel separated by 1px hairline border (independent scroll).
 * Responsive: On <lg breakpoints, shows detail full width with back button if active, or master full width.
 */
export function SplitView({
  master,
  detail,
  masterWidthClass = 'w-7/12',
  hasActiveDetail = false,
  onBackToMaster,
  className,
}: SplitViewProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex-1 min-h-0 w-full overflow-hidden flex bg-white',
          className
        )
      )}
    >
      {/* Master Left Column */}
      <div
        className={twMerge(
          clsx(
            'min-h-0 h-full overflow-auto flex flex-col',
            hasActiveDetail ? 'hidden lg:flex' : 'w-full',
            masterWidthClass
          )
        )}
      >
        {master}
      </div>

      {/* Detail Right Column */}
      <div
        className={twMerge(
          clsx(
            'min-h-0 h-full overflow-auto flex flex-col border-l border-slate-200 bg-slate-50/30',
            hasActiveDetail ? 'flex flex-1 w-full' : 'hidden lg:flex lg:flex-1'
          )
        )}
      >
        {hasActiveDetail && onBackToMaster && (
          <div className="lg:hidden p-2 border-b border-slate-200 bg-white shrink-0">
            <Button
              variant="outline"
              size="xs"
              onClick={onBackToMaster}
              aria-label="Quay lại danh sách"
            >
              ← Quay lại danh sách
            </Button>
          </div>
        )}
        {detail}
      </div>
    </div>
  );
}
