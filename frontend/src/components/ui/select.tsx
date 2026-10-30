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
  warning?: boolean;
  readOnly?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, children, error, warning, disabled, readOnly, tabIndex, onKeyDown, onMouseDown, onChange, ...props }, ref) => {
    const handleMouseDown = (e: React.MouseEvent<HTMLSelectElement>) => {
      if (readOnly) {
        e.preventDefault();
      }
      onMouseDown?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
      if (readOnly && (
        e.key === ' ' || e.key === 'Enter' ||
        e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'Home' || e.key === 'End' ||
        e.key === 'PageUp' || e.key === 'PageDown'
      )) {
        e.preventDefault();
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (readOnly) {
        e.preventDefault();
        return;
      }
      onChange?.(e);
    };

    return (
      <div className="relative inline-flex items-center w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-disabled={disabled ? true : undefined}
          aria-readonly={readOnly ? true : undefined}
          aria-invalid={error ? true : undefined}
          tabIndex={disabled ? -1 : (tabIndex ?? 0)}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          className={twMerge(
            clsx(
              'h-9 w-full appearance-none rounded border px-3 pr-8 py-1.5 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-1',
              // Default active
              !disabled && !readOnly && 'bg-white text-slate-900 cursor-pointer',
              // Validation error or warning states
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-400 focus-visible:ring-red-400 focus-visible:border-red-500'
                : warning
                ? 'border-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus-visible:ring-amber-400 focus-visible:border-amber-400'
                : 'border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus-visible:border-slate-400 focus-visible:ring-slate-400',
              // Read-only state: 100% contrast, dashed border, copyable, focusable, prevents selection change
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
          className={clsx(
            'pointer-events-none absolute right-2.5 size-4 transition-opacity',
            readOnly ? 'opacity-30 text-slate-400' : 'text-slate-400'
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = 'Select';
