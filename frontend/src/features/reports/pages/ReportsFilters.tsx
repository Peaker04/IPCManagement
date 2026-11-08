import { Filter } from 'lucide-react'
import { FieldRow } from '@/components/common/FieldRow'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ReportView } from './useReportsPageModel'

const EMPTY_SHIFT_SELECT_VALUE = '__all-shifts__'

type ReportsFiltersProps = {
  activeView: ReportView
  dateFrom: string
  dateTo: string
  shiftName: string
  sortDirection: 'asc' | 'desc'
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onShiftNameChange: (value: string) => void
  onSortDirectionChange: (value: 'asc' | 'desc') => void
}

export function ReportsFilters({ activeView, dateFrom, dateTo, shiftName, sortDirection, onDateFromChange, onDateToChange, onShiftNameChange, onSortDirectionChange }: ReportsFiltersProps) {
  return <>
    <FieldRow label="Từ ngày" htmlFor="report-filter-from"><Input id="report-filter-from" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="h-8 text-xs" /></FieldRow>
    <FieldRow label="Đến ngày" htmlFor="report-filter-to"><Input id="report-filter-to" type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className="h-8 text-xs" /></FieldRow>
    {activeView !== 'stock' && activeView !== 'data-quality' && <FieldRow label="Ca" htmlFor="report-filter-shift">
      <Select value={shiftName || EMPTY_SHIFT_SELECT_VALUE} onValueChange={(value) => onShiftNameChange(!value || value === EMPTY_SHIFT_SELECT_VALUE ? '' : value)}>
        <SelectTrigger id="report-filter-shift" className="h-8 min-w-[130px] text-xs"><SelectValue>{shiftName || 'Tất cả ca'}</SelectValue></SelectTrigger>
        <SelectContent>{['Tất cả ca', 'Ca sáng', 'Ca trưa', 'Ca chiều', 'Ca tối', 'Ca đêm'].map((label) => <SelectItem key={label} value={label === 'Tất cả ca' ? EMPTY_SHIFT_SELECT_VALUE : label}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </FieldRow>}
    {activeView === 'audit' && <FieldRow label="Sắp xếp" htmlFor="report-filter-sort">
      <Select value={sortDirection} onValueChange={(value) => onSortDirectionChange(value as 'asc' | 'desc')}>
        <SelectTrigger id="report-filter-sort" className="h-8 min-w-[150px] text-xs"><Filter size={14} className="mr-1 text-slate-400" /><SelectValue>{sortDirection === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="desc">Mới nhất trước</SelectItem><SelectItem value="asc">Cũ nhất trước</SelectItem></SelectContent>
      </Select>
    </FieldRow>}
  </>
}
