import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

export interface ActionAvailabilityProps {
  reason?: string | null;
  id?: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * ActionAvailability / DisabledReason - Renders a calm, accessible explanation for why
 * an action/button is currently not available due to normal business workflow rules.
 * Prevents anti-pattern of using large page-level error alerts for normal business conditions.
 */
export function ActionAvailability({
  reason,
  id,
  icon,
  className,
  children,
}: ActionAvailabilityProps) {
  const content = reason ?? children;
  if (!content) return null;

  return (
    <div
      id={id}
      role="note"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-slate-500 py-1 select-none',
        typography.caption,
        className,
      )}
    >
      {icon ?? <Info size={13} className="shrink-0 text-slate-400" aria-hidden="true" />}
      <span>{content}</span>
    </div>
  );
}

export const DisabledReason = ActionAvailability;
