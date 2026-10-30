import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface WorkspaceFrameRootProps {
  children: ReactNode;
  className?: string;
}

export interface WorkspaceFrameHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface WorkspaceFrameBodyProps {
  children: ReactNode;
  className?: string;
}

export function WorkspaceFrameRoot({ children, className }: WorkspaceFrameRootProps) {
  return (
    <div className={twMerge(clsx('flex-1 min-h-0 w-full flex flex-col bg-slate-50 overflow-hidden', className))}>
      {children}
    </div>
  );
}

export function WorkspaceFrameHeader({ children, className }: WorkspaceFrameHeaderProps) {
  return (
    <header className={twMerge(clsx('min-h-14 shrink-0 border-b border-slate-200 bg-white px-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 z-20', className))}>
      {children}
    </header>
  );
}

export function WorkspaceFrameBody({ children, className }: WorkspaceFrameBodyProps) {
  return (
    <main className={twMerge(clsx('flex-1 min-h-0 w-full flex flex-col overflow-hidden relative', className))}>
      {children}
    </main>
  );
}

export const WorkspaceFrame = {
  Root: WorkspaceFrameRoot,
  Header: WorkspaceFrameHeader,
  Body: WorkspaceFrameBody,
};
