import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  warning?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, warning, disabled, readOnly, tabIndex, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        aria-disabled={disabled ? true : undefined}
        aria-readonly={readOnly ? true : undefined}
        aria-invalid={error ? true : undefined}
        tabIndex={disabled ? -1 : (tabIndex ?? 0)}
        className={twMerge(
          clsx(
            'flex h-9 w-full rounded border px-3 py-1.5 text-sm transition-colors placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-1',
            // Default active state
            !disabled && !readOnly && 'bg-white text-slate-900',
            // Validation error or warning states (Fiori Value States)
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-400 focus-visible:ring-red-400 focus-visible:border-red-500'
              : warning
              ? 'border-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus-visible:ring-amber-400 focus-visible:border-amber-400'
              : 'border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus-visible:border-slate-400 focus-visible:ring-slate-400',
            // Read-only state: 100% text contrast, dashed border, copyable, focusable by Tab (disabled takes precedence)
            readOnly && !disabled && [
              'cursor-default bg-slate-50/90 text-slate-900 font-medium border-slate-300 border-dashed select-text',
              'focus-visible:border-solid focus-visible:border-slate-400 focus-visible:ring-slate-400',
            ],
            // Disabled state: low contrast, not-allowed, skipped by Tab
            disabled && 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-60 border-slate-200 select-none pointer-events-none',
            className
          )
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
