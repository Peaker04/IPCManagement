import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SplitViewProps {
  master: ReactNode;
  detail: ReactNode;
  masterWidthClass?: string;
  className?: string;
}

/**
 * Zone 3: SplitView (Master-Detail Workbench)
 * Occupies 85% Viewport (calc(100dvh - 88px)).
 * Left: Master data table (independent scroll).
 * Right: Detail / breakdown panel separated by 1px hairline border (independent scroll).
 */
export function SplitView({
  master,
  detail,
  masterWidthClass = 'w-7/12',
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
      <div className={clsx('min-h-0 h-full overflow-auto flex flex-col', masterWidthClass)}>
        {master}
      </div>

      {/* Detail Right Column */}
      <div className="flex-1 min-h-0 h-full overflow-auto flex flex-col border-l border-slate-200 bg-slate-50/30">
        {detail}
      </div>
    </div>
  );
}
