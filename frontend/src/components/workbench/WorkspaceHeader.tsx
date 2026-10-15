import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface WorkspaceHeaderProps {
  title: string;
  contextSelectors?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Zone 1: Workspace Header (Height 56px / h-14)
 * Left: Page title (16px / text-base) + horizontal context selectors (Client, Week Date, Serving Target)
 * Right: Max 1 primary button (Rule D7) + utility buttons
 */
export function WorkspaceHeader({
  title,
  contextSelectors,
  actions,
  className,
}: WorkspaceHeaderProps) {
  return (
    <header
      className={twMerge(
        clsx(
          'h-14 shrink-0 border-b border-slate-200 bg-white px-5 flex items-center justify-between gap-4 z-20',
          className
        )
      )}
    >
      {/* Left: Title + Inline Context Selectors */}
      <div className="flex items-center gap-3.5 min-w-0">
        <h1 className="text-base font-semibold text-slate-900 tracking-tight whitespace-nowrap shrink-0">
          {title}
        </h1>

        {contextSelectors && (
          <>
            <div className="h-5 w-px bg-slate-200 shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-2.5 min-w-0 overflow-x-auto py-1">
              {contextSelectors}
            </div>
          </>
        )}
      </div>

      {/* Right: Actions (Rule D7: Max 1 primary button) */}
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
