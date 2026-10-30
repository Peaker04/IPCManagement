import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface WorkspaceHeaderProps {
  title: string;
  breadcrumb?: string;
  contextSelectors?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export interface HeaderBadgeSlotProps {
  children?: ReactNode;
  variant?: 'status' | 'metric' | 'mode';
  className?: string;
}

export interface HeaderActionsProps {
  children: ReactNode;
  className?: string;
}

export function HeaderBadgeSlot({
  children,
  variant = 'status',
  className,
}: HeaderBadgeSlotProps) {
  const widthClass =
    variant === 'mode'
      ? 'min-w-[220px]'
      : variant === 'metric'
      ? 'min-w-[140px]'
      : 'min-w-[110px]';

  return (
    <div
      data-slot="header-badge-anchor"
      className={twMerge(
        clsx(`${widthClass} h-9 flex items-center shrink-0`, className)
      )}
    >
      {children}
    </div>
  );
}

export function HeaderActions({ children, className }: HeaderActionsProps) {
  return (
    <div
      data-slot="header-actions"
      className={twMerge(clsx('flex items-center gap-2 shrink-0', className))}
    >
      {children}
    </div>
  );
}

/**
 * Zone 1: Workspace Header (Height 56px / h-14)
 * Left: Page title (16px / text-base) + horizontal context selectors (Client, Week Date, Serving Target)
 * Right: Max 1 primary button (Rule D7) + utility buttons
 */
export function WorkspaceHeader({
  title,
  breadcrumb,
  contextSelectors,
  actions,
  className,
}: WorkspaceHeaderProps) {
  return (
    <header
      className={twMerge(
        clsx(
          'h-14 min-h-14 shrink-0 border-b border-slate-200 bg-white px-4 sm:px-5 flex items-center justify-between gap-3 sm:gap-4 z-20',
          className
        )
      )}
    >
      {/* Left: Title + Inline Context Selectors */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <div className="flex flex-col min-w-0 shrink-0">
          {breadcrumb && (
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase truncate leading-none mb-0.5">
              {breadcrumb}
            </span>
          )}
          <h1 className="text-base font-semibold text-slate-900 tracking-tight whitespace-nowrap shrink-0 leading-tight">
            {title}
          </h1>
        </div>

        {contextSelectors && (
          <>
            <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 sm:flex-initial">
              {contextSelectors}
            </div>
          </>
        )}
      </div>

      {/* Right: Actions (Rule D7: Max 1 primary button) */}
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 pl-2">
          {actions}
        </div>
      )}
    </header>
  );
}

WorkspaceHeader.BadgeSlot = HeaderBadgeSlot;
WorkspaceHeader.Actions = HeaderActions;
