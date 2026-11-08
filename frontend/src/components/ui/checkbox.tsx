import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, onChange, disabled, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const el = (ref && 'current' in ref ? ref.current : internalRef.current) as HTMLInputElement | null;
      if (el) {
        el.indeterminate = !!indeterminate;
      }
    }, [indeterminate, ref]);

    return (
      <span className="inline-flex items-center justify-center min-h-[var(--density-hit-target,1.25rem)] min-w-[var(--density-hit-target,1.25rem)]">
        <input
          type="checkbox"
          ref={ref || internalRef}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          aria-checked={indeterminate ? 'mixed' : (checked ? 'true' : 'false')}
          className={twMerge(
            clsx(
              'h-4 w-4 rounded border border-slate-300 text-slate-900 accent-slate-900 cursor-pointer shrink-0',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
              indeterminate && 'accent-slate-700',
              className
            )
          )}
          {...props}
        />
      </span>
    );
  }
);
Checkbox.displayName = 'Checkbox';
