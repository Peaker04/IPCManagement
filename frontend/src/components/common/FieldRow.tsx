import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldRowProps {
  label: ReactNode;
  hint?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  required?: boolean;
  optional?: boolean;
  layout?: 'vertical' | 'horizontal' | 'compact';
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}

export function FieldRow({
  label,
  hint,
  description,
  error,
  errorId,
  required,
  optional,
  layout = 'vertical',
  htmlFor,
  children,
  className,
  labelClassName,
}: FieldRowProps) {
  return (
    <div
      className={cn(
        'ipc-field-row',
        layout === 'horizontal' && 'ipc-field-row--horizontal',
        layout === 'compact' && 'ipc-field-row--compact',
        className,
      )}
    >
      <label htmlFor={htmlFor} className={cn('ipc-field-label', labelClassName)}>
        <span className="flex items-center gap-1">
          <span>{label}</span>
          {required && (
            <span className="text-red-600 font-semibold" aria-hidden="true">
              *
            </span>
          )}
          {optional && (
            <span className="text-caption text-slate-400">
              (Tùy chọn)
            </span>
          )}
        </span>
        {hint && <span className="ipc-field-hint">{hint}</span>}
      </label>
      {children}
      {description && <p className="text-xs text-slate-500">{description}</p>}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="ipc-field-error text-xs font-medium text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
