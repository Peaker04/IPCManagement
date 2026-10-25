import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TelemetrySubbarProps {
  leftControls?: ReactNode;
  telemetryPills?: ReactNode;
  rightActions?: ReactNode;
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
  className,
}: TelemetrySubbarProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'h-11 min-h-11 shrink-0 border-b border-slate-200 bg-slate-50 px-4 sm:px-5 flex items-center justify-between gap-3 sm:gap-4 text-sm text-slate-700 select-none z-10',
          className
        )
      )}
    >
      {/* Left controls: Segmented tabs, day switcher, scope dropdown */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
        {leftControls}
      </div>

      {/* Right controls: Inline pills + optional secondary actions */}
      <div className="flex items-center gap-3.5 shrink-0">
        {telemetryPills && (
          <div className="inline-flex items-center gap-2.5 text-xs text-slate-600">
            {telemetryPills}
          </div>
        )}

        {rightActions && (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            {rightActions}
          </div>
        )}
      </div>
    </div>
  );
}
