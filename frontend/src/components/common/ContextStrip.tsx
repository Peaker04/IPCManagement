import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';

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

export function ContextStrip({ items, className }: ContextStripProps) {
  return (
    <dl className={cn('ipc-context-strip', className)}>
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
            <span className="ipc-context-icon" aria-hidden="true">{item.icon ?? <ToneIcon size={16} />}</span>
            <dt className="ipc-context-label">{item.label}</dt>
            <dd className="ipc-context-value">{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
