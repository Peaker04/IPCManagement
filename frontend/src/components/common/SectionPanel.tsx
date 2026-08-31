import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';
import { InfoNote } from './InfoNote';

interface SectionPanelProps {
  title?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
  /** 'popover' (default): renders (i) icon next to title; 'inline': renders text block below header */
  descriptionPlacement?: 'popover' | 'inline';
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
  actions,
  description,
  descriptionPlacement = 'popover',
  footer,
  children,
  tone = 'default',
  padded = true,
  headingLevel = 3,
  className,
}: SectionPanelProps) {
  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const showInlineDescription = description && descriptionPlacement === 'inline';
  const showPopoverDescription = description && descriptionPlacement === 'popover';

  return (
    <section className={cn('ipc-section-panel rounded-md border', padded && 'p-4 sm:p-5', !padded && 'p-0', panelToneClasses[tone], className)}>
      {(title || badge || actions) && (
        <div className={cn('ipc-section-header flex flex-wrap items-center justify-between gap-3', showInlineDescription ? 'mb-2' : 'mb-4')}>
          {title && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <HeadingTag className={cn(typography.sectionTitle, 'ipc-section-title m-0 flex items-center gap-2', titleToneClasses[tone])}>
                {icon}
                <span>{title}</span>
              </HeadingTag>
              {showPopoverDescription && (
                <InfoNote
                  title={typeof title === 'string' ? title : 'Hướng dẫn'}
                  content={description}
                />
              )}
            </div>
          )}
          {(badge || actions) && (
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap ml-auto">
              {actions}
              {badge}
            </div>
          )}
        </div>
      )}

      {showInlineDescription && <div className="ipc-section-description mb-4 text-sm leading-6 text-slate-500">{description}</div>}

      {children}

      {footer && <div className="ipc-section-footer mt-5 border-t border-slate-200 pt-4 text-right">{footer}</div>}
    </section>
  );
}
