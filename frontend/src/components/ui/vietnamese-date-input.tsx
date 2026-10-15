import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toIsoDate } from '../../utils/dates';

export interface VietnameseDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange?: (date: string) => void;
  error?: boolean;
}

export const VietnameseDateInput = React.forwardRef<HTMLInputElement, VietnameseDateInputProps>(
  ({ value, onChange, error, className, disabled, ...props }, ref) => {
    const isoValue = toIsoDate(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          type="date"
          ref={ref}
          value={isoValue}
          onChange={handleChange}
          disabled={disabled}
          className={twMerge(
            clsx(
              'h-9 w-40 rounded border bg-white px-3 py-1.5 text-sm text-slate-900 cursor-pointer font-mono',
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
      </div>
    );
  }
);
VietnameseDateInput.displayName = 'VietnameseDateInput';
