import React from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, children, error, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <select
          ref={ref}
          className={twMerge(
            clsx(
              'h-9 w-full appearance-none rounded border bg-white pl-3 pr-8 py-1.5 text-sm text-slate-900 cursor-pointer',
              'transition-colors focus-visible:outline-none focus-visible:ring-1',
              error
                ? 'border-red-500 focus-visible:ring-red-400'
                : 'border-slate-300 focus-visible:border-slate-400 focus-visible:ring-slate-400',
              'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              className
            )
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 size-4 text-slate-400"
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = 'Select';
