import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, onChange, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const el = (ref && 'current' in ref ? ref.current : internalRef.current) as HTMLInputElement | null;
      if (el) {
        el.indeterminate = !!indeterminate;
      }
    }, [indeterminate, ref]);

    return (
      <input
        type="checkbox"
        ref={ref || internalRef}
        checked={checked}
        onChange={onChange}
        className={twMerge(
          clsx(
            'h-4 w-4 rounded border border-slate-300 text-slate-900 accent-slate-900 cursor-pointer',
            'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';
