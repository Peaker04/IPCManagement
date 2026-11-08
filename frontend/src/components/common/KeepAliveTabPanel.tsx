import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KeepAliveTabPanelProps {
  id: string;
  active: boolean;
  lazy?: boolean;
  className?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * KeepAliveTabPanel preserves tab content DOM across active tab switches (Rule C1, C10).
 * When lazy=true (default), content is only mounted when the tab is first activated,
 * and subsequently preserved in the DOM without re-fetching or layout shifts.
 */
export function KeepAliveTabPanel({
  id,
  active,
  lazy = true,
  className,
  fallback = null,
  children,
}: KeepAliveTabPanelProps) {
  const [hasBeenActive, setHasBeenActive] = useState(active || !lazy);
  useEffect(() => {
    if (!active || hasBeenActive) return;
    const timer = window.setTimeout(() => setHasBeenActive(true), 0);
    return () => window.clearTimeout(timer);
  }, [active, hasBeenActive]);

  const shouldRenderContent = !lazy || active || hasBeenActive;

  return (
    <div
      id={`${id}-panel`}
      role="tabpanel"
      aria-labelledby={`${id}-tab`}
      hidden={!active}
      style={{ display: active ? undefined : 'none' }}
      className={cn('flex-1 min-h-0 flex flex-col', active && 'ipc-tab-panel-enter', !active && 'hidden', className)}
    >
      {shouldRenderContent ? children : fallback}
    </div>
  );
}
