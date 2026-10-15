import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={twMerge(
          clsx(
            'flex h-9 w-full rounded border bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400',
            'transition-colors focus-visible:outline-none focus-visible:ring-1',
            error
              ? 'border-red-500 focus-visible:ring-red-400'
              : 'border-slate-300 focus-visible:border-slate-400 focus-visible:ring-slate-400',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            className
          )
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
