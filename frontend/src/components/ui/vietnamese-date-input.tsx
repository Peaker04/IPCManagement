import React, { useRef, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toIsoDate, toVietnameseDate } from '../../utils/dates';

export interface VietnameseDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string; // ISO date 'YYYY-MM-DD'
  onChange?: (date: string) => void;
  error?: boolean;
}

export const VietnameseDateInput = React.forwardRef<HTMLInputElement, VietnameseDateInputProps>(
  ({ value, onChange, error, className, disabled, ...props }, ref) => {
    const hiddenDateInputRef = useRef<HTMLInputElement>(null);
    const [draftText, setDraftText] = useState(() => toVietnameseDate(value));

    useEffect(() => {
      setDraftText(toVietnameseDate(value));
    }, [value]);

    const handleCommit = () => {
      const match = draftText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) {
        const [, d, m, y] = match;
        const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        onChange?.(iso);
      } else {
        setDraftText(toVietnameseDate(value));
      }
    };

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value;
      if (iso) {
        setDraftText(toVietnameseDate(iso));
        onChange?.(iso);
      }
    };

    const openPicker = () => {
      const el = hiddenDateInputRef.current;
      if (el && !disabled) {
        if ('showPicker' in el && typeof el.showPicker === 'function') {
          el.showPicker();
        } else {
          el.click();
        }
      }
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          type="text"
          ref={ref}
          value={draftText}
          disabled={disabled}
          placeholder="dd/MM/yyyy"
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit();
          }}
          className={twMerge(
            clsx(
              'h-9 w-40 rounded border bg-white pl-3 pr-8 py-1.5 text-sm text-slate-900 font-mono tracking-tight cursor-text tabular-nums',
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
        <input
          type="date"
          ref={hiddenDateInputRef}
          value={toIsoDate(value)}
          onChange={handlePickerChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label="Mở lịch chọn ngày"
          className="absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed text-xs select-none"
        >
          📅
        </button>
      </div>
    );
  }
);
VietnameseDateInput.displayName = 'VietnameseDateInput';
