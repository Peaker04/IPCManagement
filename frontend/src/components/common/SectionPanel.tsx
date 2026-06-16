import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionPanelProps {
  title?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'danger' | 'dark';
  padded?: boolean;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

const panelToneClasses = {
  default: 'border-slate-300 bg-white',
  danger: 'border-red-200 bg-white',
  dark: 'border-slate-300 bg-white text-slate-800',
};

const titleToneClasses = {
  default: 'text-slate-800',
  danger: 'text-red-800',
  dark: 'text-slate-800',
};

export function SectionPanel({
  title,
  icon,
  badge,
  description,
  footer,
  children,
  tone = 'default',
  padded = true,
  headingLevel = 3,
  className,
}: SectionPanelProps) {
  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <section className={cn('ipc-section-panel rounded-md border', padded && 'p-4 sm:p-5', !padded && 'p-0', panelToneClasses[tone], className)}>
      {(title || badge) && (
        <div className={cn('ipc-section-header flex flex-wrap items-center justify-between gap-3', description ? 'mb-2' : 'mb-5')}>
          {title && (
            <HeadingTag className={cn('ipc-section-title m-0 flex items-center gap-2 font-semibold', titleToneClasses[tone])}>
              {icon}
              <span>{title}</span>
            </HeadingTag>
          )}
          {badge}
        </div>
      )}

      {description && <div className="ipc-section-description mb-4 text-[13px] leading-6 text-slate-500">{description}</div>}

      {children}

      {footer && <div className="ipc-section-footer mt-5 border-t border-slate-200 pt-4 text-right">{footer}</div>}
    </section>
  );
}
