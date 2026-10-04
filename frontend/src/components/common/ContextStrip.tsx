import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';
import { typography } from '@/lib/typography';

export interface ContextStripItem {
  label: ReactNode;
  value: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  /** Metrics and scope values stay visually quiet; use strong for a true status signal. */
  emphasis?: 'quiet' | 'strong';
}

interface ContextStripProps {
  items: ContextStripItem[];
  className?: string;
  variant?: 'badge' | 'inline';
}

const toneClasses = {
  neutral: 'is-neutral',
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

const toneIcons = {
  neutral: CircleDashed,
  info: CircleDashed,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
};

export function ContextStrip({ items, className, variant = 'badge' }: ContextStripProps) {
  return (
    <dl data-variant={variant === 'inline' ? 'inline' : undefined} className={cn('ipc-context-strip', className)}>
      {items.map((item, index) => {
        const tone = item.tone ?? 'neutral';
        const ToneIcon = toneIcons[tone];
        return (
          <div
            key={index}
            className={cn(
              'ipc-context-badge',
              toneClasses[tone],
              item.emphasis !== 'strong' && (tone === 'success' || tone === 'info') && 'is-quiet',
            )}
          >
            {(item.icon != null || variant !== 'inline' || tone === 'warning' || tone === 'danger' || item.emphasis === 'strong') &&
              <span className="ipc-context-icon" aria-hidden="true">{item.icon ?? <ToneIcon size={16} />}</span>}
            <dt className={cn(typography.body, 'ipc-context-label font-medium')}>{item.label}</dt>
            <dd className={cn(typography.body, 'ipc-context-value font-bold')}>{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
