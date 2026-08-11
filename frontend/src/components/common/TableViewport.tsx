import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

interface TableViewportProps {
  children: ReactNode;
  ariaLabel: string;
  caption?: string;
  className?: string;
  size?: 'default' | 'weekly';
  density?: TableDensity;
  stickyHeader?: boolean;
  frozenFirstIdentifier?: boolean;
}

export type TableDensity = 'compact' | 'standard' | 'comfortable';

const viewportSizeClasses = {
  default: '',
  weekly: 'h-[560px] max-h-[560px]',
};

/**
 * Canonical boundary for operational tables. Data, filters and pagination
 * remain outside this component so the viewport cannot silently change API
 * contracts while route families are being migrated.
 */
export function TableViewport({
  children,
  ariaLabel,
  caption,
  className,
  size = 'default',
  density = 'standard',
  stickyHeader = true,
  frozenFirstIdentifier = true,
}: TableViewportProps) {
  const captionId = useId();

  return (
    <div
      className={cn(typography.body, 'ipc-table-viewport min-w-0 w-full overflow-auto overscroll-x-contain', viewportSizeClasses[size], className)}
      data-table-viewport="true"
      data-density={density}
      data-sticky-header={stickyHeader}
      data-frozen-identifier={frozenFirstIdentifier}
      role="region"
      aria-label={ariaLabel}
      aria-describedby={caption ? captionId : undefined}
      tabIndex={0}
    >
      {caption ? <div id={captionId} className="sr-only">{caption}</div> : null}
      {children}
    </div>
  );
}
