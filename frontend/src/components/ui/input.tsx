import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

const inputClassName = "h-8 w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-1 text-input transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-input-compact file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-input-compact dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const parseIsoDate = (value: unknown) => {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null
}

const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const toVietnameseDate = (value: unknown) => {
  const date = parseIsoDate(value)
  return date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}` : ''
}
const parseVietnameseDate = (value: string) => {
  const iso = parseIsoDate(value)
  if (iso) return toIsoDate(iso)
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
  return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1]) ? toIsoDate(date) : null
}

const normalizeToMonday = (iso: string) => {
  const date = parseIsoDate(iso)
  if (!date) return iso
  const delta = date.getDay() === 0 ? 1 : 1 - date.getDay()
  date.setDate(date.getDate() + delta)
  return toIsoDate(date)
}

type InputProps = React.ComponentProps<"input"> & { weekStartOnly?: boolean }

function VietnameseDateInput({ className, value, defaultValue, onChange, min, max, disabled, name, required, ref, weekStartOnly = false, ...props }: InputProps) {
  const controlledValue = value ?? defaultValue ?? ''
  const [draftText, setDraftText] = React.useState<string | null>(null)
  const text = draftText ?? toVietnameseDate(controlledValue)
  const selectedDate = parseIsoDate(controlledValue)
  const [visibleMonth, setVisibleMonth] = React.useState(() => selectedDate ?? new Date())

  const emit = (iso: string) => {
    const normalized = iso && weekStartOnly ? normalizeToMonday(iso) : iso
    setDraftText(null)
    onChange?.({ target: { value: normalized }, currentTarget: { value: normalized } } as React.ChangeEvent<HTMLInputElement>)
  }
  const commitText = () => {
    if (!text.trim()) return emit('')
    const iso = parseVietnameseDate(text)
    if (iso) emit(iso)
    else setDraftText(null)
  }
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const calendarStart = new Date(first)
  calendarStart.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)
    return date
  })
  const minIso = typeof min === 'string' ? min : ''
  const maxIso = typeof max === 'string' ? max : ''

  return (
    <Popover.Root>
      <div className="relative min-w-0">
        <InputPrimitive
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          placeholder="dd/mm/yyyy"
          data-slot="input"
          data-date-locale="vi-VN"
          className={cn(inputClassName, 'pr-9 tabular-nums', className)}
          onFocus={() => setDraftText(toVietnameseDate(controlledValue))}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => { if (event.key === 'Enter') commitText() }}
        />
        <input type="hidden" name={name} value={typeof controlledValue === 'string' ? controlledValue : ''} required={required} />
        <Popover.Trigger
          render={<Button type="button" variant="ghost" size="icon-xs" aria-label="Mở lịch chọn ngày" disabled={disabled} />}
          className="absolute right-0.5 top-1/2 -translate-y-1/2"
        >
          <CalendarDays aria-hidden="true" />
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-[1200]">
          <Popover.Popup aria-label="Lịch chọn ngày" className="w-[264px] rounded-md border border-border bg-surface p-2.5 shadow-lg">
            <div className="mb-1.5 flex items-center justify-between gap-1.5">
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Tháng trước" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><ChevronLeft /></Button>
              <strong className="text-sm">Tháng {visibleMonth.getMonth() + 1} năm {visibleMonth.getFullYear()}</strong>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Tháng sau" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><ChevronRight /></Button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAY_LABELS.map(label => <span key={label} className="py-0.5 text-[11px] font-semibold text-muted-foreground">{label}</span>)}
              {days.map(date => {
                const iso = toIsoDate(date)
                const isSelected = selectedDate ? iso === toIsoDate(selectedDate) : false
                const isOutside = date.getMonth() !== visibleMonth.getMonth()
                const unavailable = Boolean((minIso && iso < minIso) || (maxIso && iso > maxIso) || (weekStartOnly && date.getDay() !== 1))
                return <Popover.Close key={iso} render={<Button type="button" variant={isSelected ? 'default' : 'ghost'} size="icon-xs" disabled={unavailable} aria-label={`Chọn ngày ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`} className={cn('size-7 text-xs', isOutside && 'text-muted-foreground/60')} onClick={() => emit(iso)} />}>{date.getDate()}</Popover.Close>
              })}
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2">
              <Popover.Close render={<Button type="button" variant="ghost" size="xs" onClick={() => { const today = new Date(); setVisibleMonth(today); emit(toIsoDate(today)) }} />}>Hôm nay</Popover.Close>
              <Popover.Close render={<Button type="button" variant="outline" size="xs" />}>Đóng</Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Input({ className, type, ...props }: InputProps) {
  if (type === 'date') return <VietnameseDateInput className={className} {...props} />
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputClassName, className)}
      {...props}
    />
  )
}

export { Input }
