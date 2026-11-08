import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TelemetrySubbarProps {
  leftControls?: ReactNode;
  telemetryPills?: ReactNode;
  rightActions?: ReactNode;
  responsive?: boolean;
  className?: string;
}

/**
 * Zone 2: Telemetry Subbar (Height 44px / h-11)
 * Left: Segmented view switcher, day navigator, or scope selector (text-sm)
 * Right: Inline telemetry status pills + fast inline actions
 */
export function TelemetrySubbar({
  leftControls,
  telemetryPills,
  rightActions,
  responsive = false,
  className,
}: TelemetrySubbarProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'min-h-11 shrink-0 border-b border-slate-200 bg-slate-50 px-4 sm:px-5 flex items-center justify-between gap-3 sm:gap-4 text-sm text-slate-700 select-none z-10',
          responsive ? 'h-auto flex-wrap py-1.5' : 'h-11 overflow-x-auto no-scrollbar',
          className
        )
      )}
    >
      {/* Left controls: Segmented tabs, day switcher, scope dropdown */}
      <div className={clsx('flex items-center gap-2 sm:gap-2.5 min-w-0', responsive ? 'flex-wrap max-w-full' : 'shrink-0')}>
        {leftControls}
      </div>

      {/* Right controls: Inline pills + optional secondary actions */}
      <div className={clsx('flex items-center gap-3.5', responsive ? 'flex-wrap max-w-full' : 'shrink-0')}>
        {telemetryPills && (
          <div className="inline-flex items-center gap-2.5 text-xs text-slate-600 whitespace-nowrap">
            {telemetryPills}
          </div>
        )}

        {rightActions && (
          <div className={clsx('flex items-center gap-2 pl-3 border-l border-slate-200', responsive && '[&>div]:flex-wrap')}>
            {rightActions}
          </div>
        )}
      </div>
    </div>
  );
}
