import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toVietnameseDate } from '../../utils/dates';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
};

const formatIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseVietnameseDate = (value: string): string | null => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return date.getFullYear() === Number(match[3]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[1])
    ? formatIso(date)
    : null;
};

export interface VietnameseDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string; // ISO date 'YYYY-MM-DD'
  onChange?: (date: string) => void;
  error?: boolean;
  isDateAllowed?: (isoDate: string) => boolean;
  validationMessage?: string;
  onValidationChange?: (message: string | null) => void;
}

export const VietnameseDateInput = React.forwardRef<HTMLInputElement, VietnameseDateInputProps>(
  ({ value, onChange, error, className, disabled, min, max, isDateAllowed, validationMessage, onValidationChange, onFocus, onBlur, onKeyDown, ...props }, ref) => {
    const controlledValue = value ?? '';
    const [draft, setDraft] = React.useState<{ value: string; text: string } | null>(null);
    const displayText = draft?.value === controlledValue ? draft.text : toVietnameseDate(controlledValue);
    const selectedDate = parseIsoDate(controlledValue);
    const [visibleMonth, setVisibleMonth] = React.useState(() => selectedDate ?? new Date());
    const inputRef = React.useRef<HTMLInputElement>(null);
    const errorId = React.useId();
    React.useImperativeHandle(ref, () => inputRef.current!);

    const allowed = (iso: string) => (!min || iso >= String(min)) && (!max || iso <= String(max)) && (!isDateAllowed || isDateAllowed(iso));
    const parseText = (text: string) => parseVietnameseDate(text) || (parseIsoDate(text.trim()) ? text.trim() : null);
    const validate = (text: string): string | null => {
      if (!text.trim()) return props.required ? 'Vui lòng chọn ngày.' : null;
      const iso = parseText(text);
      if (!iso) return 'Ngày không hợp lệ. Vui lòng nhập dd/MM/yyyy.';
      return allowed(iso) ? null : validationMessage || 'Ngày nằm ngoài phạm vi được phép.';
    };
    const message = draft?.value === controlledValue ? validate(draft.text) : null;
    React.useEffect(() => { inputRef.current?.setCustomValidity(message ?? ''); }, [message]);

    const emit = (iso: string) => {
      if (disabled || props.readOnly || (iso && !allowed(iso))) return;
      setDraft(null);
      onValidationChange?.(null);
      onChange?.(iso);
    };

    const commitText = () => {
      const nextError = validate(displayText);
      onValidationChange?.(nextError);
      if (!nextError) emit(displayText.trim() ? parseText(displayText)! : '');
    };

    // Build 42-day calendar matrix
    const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(firstDayOfMonth.getDate() - ((firstDayOfMonth.getDay() + 6) % 7));
    const calendarDays = Array.from({ length: 42 }, (_, index) => {
      const d = new Date(calendarStart);
      d.setDate(calendarStart.getDate() + index);
      return d;
    });

    return (
      <Popover.Root>
        <div className="inline-flex flex-col gap-1">
        <div className="relative inline-flex items-center shrink-0 w-40 min-w-[160px]">
          <input
            {...props}
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={displayText}
            disabled={disabled}
            placeholder="dd/MM/yyyy"
            data-date-locale="vi-VN"
            aria-invalid={Boolean(error || message) || undefined}
            aria-describedby={[props['aria-describedby'], message ? errorId : null].filter(Boolean).join(' ') || undefined}
            onFocus={(event) => {
              if (draft?.value !== controlledValue) setDraft({ value: controlledValue, text: toVietnameseDate(controlledValue) });
              onFocus?.(event);
            }}
            onChange={(event) => {
              setDraft({ value: controlledValue, text: event.target.value });
              onValidationChange?.(validate(event.target.value));
            }}
            onBlur={(event) => { commitText(); onBlur?.(event); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitText(); }
              onKeyDown?.(event);
            }}
            className={twMerge(
              clsx(
                'h-9 w-40 min-w-[160px] shrink-0 rounded border bg-white pl-3 pr-9 py-1.5 text-sm text-slate-900 font-mono tracking-tight tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-1',
                error || message
                  ? 'border-red-500 focus-visible:ring-red-400'
                  : 'border-slate-300 focus-visible:border-slate-400 focus-visible:ring-slate-400',
                'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
                className
              )
            )}
          />
          <Popover.Trigger
            type="button"
            disabled={disabled || props.readOnly}
            aria-label="Mở lịch chọn ngày"
            className="absolute right-2.5 text-slate-400 hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
          </Popover.Trigger>
        </div>
        {message && <span id={errorId} role="alert" className="text-xs">{message}</span>}
        </div>

        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-[1200]">
            <Popover.Popup
              aria-label="Lịch chọn ngày"
              className="w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl select-none text-slate-800"
            >
              {/* Header: Tháng M năm YYYY */}
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  aria-label="Tháng trước"
                  onClick={() =>
                    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))
                  }
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <strong className="text-sm font-semibold text-slate-900">
                  Tháng {visibleMonth.getMonth() + 1} năm {visibleMonth.getFullYear()}
                </strong>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  onClick={() =>
                    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))
                  }
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Weekday headers: T2, T3, T4, T5, T6, T7, CN */}
              <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label} className="py-1 text-xs font-semibold text-slate-400 font-mono">
                    {label}
                  </span>
                ))}
              </div>

              {/* 42 days grid */}
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {calendarDays.map((d) => {
                  const iso = formatIso(d);
                  const isSelected = selectedDate ? iso === formatIso(selectedDate) : false;
                  const isOutsideMonth = d.getMonth() !== visibleMonth.getMonth();
                  return (
                    <Popover.Close
                      key={iso}
                      type="button"
                      aria-label={`Chọn ngày ${toVietnameseDate(iso)}`}
                      disabled={!allowed(iso) || disabled || props.readOnly}
                      onClick={() => emit(iso)}
                      className={clsx(
                        'h-8 w-8 text-xs font-mono rounded flex items-center justify-center cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-slate-900 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-100 text-slate-700',
                        isOutsideMonth && !isSelected && 'text-slate-300'
                      )}
                    >
                      {d.getDate()}
                    </Popover.Close>
                  );
                })}
              </div>

              {/* Footer controls */}
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <Popover.Close
                  type="button"
                  disabled={!allowed(formatIso(new Date())) || disabled || props.readOnly}
                  onClick={() => {
                    const today = new Date();
                    setVisibleMonth(today);
                    emit(formatIso(today));
                  }}
                  className="px-2 py-1 rounded text-blue-600 hover:bg-blue-50 font-medium cursor-pointer"
                >
                  Hôm nay
                </Popover.Close>
                <Popover.Close
                  type="button"
                  className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Đóng
                </Popover.Close>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
VietnameseDateInput.displayName = 'VietnameseDateInput';
