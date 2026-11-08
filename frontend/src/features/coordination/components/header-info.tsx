'use client'

import { CalendarClock, Sun, Sunset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ShiftType } from '../types'
import { SHIFT_LABELS } from '@/lib/constants'
import { useAppDispatch } from '@/lib/reduxHooks'
import { useCoordinationSelector, useCurrentShift } from '../coordinationHooks'
import { setCurrentServiceDate, setCurrentShift } from '../coordinationSlice'
import { useCountdown } from './hooks'
import { typography } from '@/lib/typography'

interface HeaderInfoProps {
  status: string
}

export function HeaderInfo({ status }: HeaderInfoProps) {
  const dispatch = useAppDispatch()
  const shift = useCurrentShift()
  const currentServiceDate = useCoordinationSelector((state) => state.coordination.currentServiceDate)
  const { timeRemaining, isPastCutoff } = useCountdown(currentServiceDate)
  
  const handleShiftChange = (newShift: ShiftType) => {
    dispatch(setCurrentShift(newShift))
  }

  const handleDateChange = (newDate: string) => {
    dispatch(setCurrentServiceDate(newDate))
  }

  const normalizedStatus = status.toUpperCase()
  const showCutoff = normalizedStatus === 'DRAFT' || normalizedStatus === 'FORECASTED'

  return (
    <div className="ipc-coordination-command border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            <span>Ngày phục vụ</span>
            <Input
              aria-label="Ngày phục vụ"
              type="date"
              value={currentServiceDate}
              onChange={(event) => handleDateChange(event.target.value)}
              className="h-9 min-w-32 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Ca phục vụ</span>
            <div className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-slate-50 p-0.5" role="group" aria-label="Ca phục vụ">
              {Object.entries(SHIFT_LABELS).map(([key, label]) => {
                const active = shift === key
                const ShiftIcon = key === 'Ca Sáng' ? Sun : Sunset
                return (
                  <Button
                    key={key}
                    type="button"
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => handleShiftChange(key as ShiftType)}
                    className="h-8 min-w-28 rounded-sm border-0 shadow-none"
                  >
                    <ShiftIcon className="size-4" aria-hidden="true" />
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        {showCutoff && (
          <div className={`flex h-9 items-center gap-2 rounded-md border px-3 ${isPastCutoff ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>
            <CalendarClock className="size-4" aria-hidden="true" />
            <span className="text-xs font-semibold">{isPastCutoff ? 'Đã qua 08:30 ·' : 'Còn tới 08:30'}</span>
            {isPastCutoff && <strong className="text-xs">Cần chốt thủ công</strong>}
            {!isPastCutoff && <span className={`${typography.code} text-sm font-bold tabular-nums`}>{timeRemaining}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
