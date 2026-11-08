import { Calendar } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DAYS_OF_WEEK, SHIFTS } from '@/lib/constants'
import type { ShiftType } from '@/types/coordination'
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'

type ChefShiftControlsProps = {
  activeDay: string
  activeShift: ShiftType
  onDayChange: (day: string) => void
  onShiftChange: (shift: ShiftType) => void
}

export function ChefShiftControls({ activeDay, activeShift, onDayChange, onShiftChange }: ChefShiftControlsProps) {
  const activeDayLabel = DAYS_OF_WEEK.find((day) => day.key === activeDay)?.label ?? activeDay
  return (
    <div className={cn(typography.body, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4')}>
      <div className="flex items-center gap-2 text-sm text-slate-600"><Calendar className="size-4 text-blue-600" /><span className="font-semibold text-slate-700">Lệnh sản xuất bếp nấu</span></div>
      <div className="flex items-center gap-2">
        <Select value={activeDay} onValueChange={(value) => { if (value !== null) onDayChange(value) }}>
          <SelectTrigger aria-label="Chọn ngày sản xuất" className="min-h-8 w-28 cursor-pointer rounded-md border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            <SelectValue>{activeDayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>{DAYS_OF_WEEK.map((day) => <SelectItem key={day.key} value={day.key}>{day.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={activeShift} onValueChange={(value) => { if (value !== null) onShiftChange(value as ShiftType) }}>
          <SelectTrigger aria-label="Chọn ca sản xuất" className="min-h-8 w-28 cursor-pointer rounded-md border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            <SelectValue>{activeShift}</SelectValue>
          </SelectTrigger>
          <SelectContent>{SHIFTS.map((shift) => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  )
}
