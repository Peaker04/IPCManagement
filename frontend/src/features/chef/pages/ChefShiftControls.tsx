import { Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SHIFTS } from '@/lib/constants'
import type { ShiftType } from '@/types/coordination'
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'

type ChefShiftControlsProps = {
  serviceDate: string
  activeShift: ShiftType
  onDateChange: (date: string) => void
  onShiftChange: (shift: ShiftType) => void
}

export function ChefShiftControls({ serviceDate, activeShift, onDateChange, onShiftChange }: ChefShiftControlsProps) {
  return (
    <div className={cn(typography.body, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4')}>
      <div className="flex items-center gap-2 text-sm text-slate-600"><Calendar className="size-4 text-blue-600" /><span className="font-semibold text-slate-700">Lệnh sản xuất bếp nấu</span></div>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Chọn ngày sản xuất"
          type="date"
          value={serviceDate}
          onChange={(event) => onDateChange(event.target.value)}
          className="h-8 w-36 border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700"
        />
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
