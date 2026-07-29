'use client'

import { CalendarClock, Sun, Sunset } from 'lucide-react'
import type { ShiftType } from '../types'
import { SHIFT_LABELS } from '@/lib/constants'
import { useAppDispatch } from '@/lib/reduxHooks'
import { useCoordinationSelector, useCurrentShift } from '../coordinationHooks'
import { setCurrentServiceDate, setCurrentShift } from '../coordinationSlice'
import { useCountdown } from './hooks'

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
            <input
              aria-label="Ngày phục vụ"
              type="date"
              value={currentServiceDate}
              onChange={(event) => handleDateChange(event.target.value)}
              className="h-9 min-w-32 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Ca phục vụ</span>
            <div className="inline-flex h-9 rounded-md border border-slate-300 bg-slate-50 p-0.5" role="group" aria-label="Ca phục vụ">
              {Object.entries(SHIFT_LABELS).map(([key, label]) => {
                const active = shift === key
                const ShiftIcon = key === 'Ca Sáng' ? Sun : Sunset
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleShiftChange(key as ShiftType)}
                    className={`inline-flex min-w-28 items-center justify-center gap-1.5 rounded px-3 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-800'
                    }`}
                  >
                    <ShiftIcon className="size-4" aria-hidden="true" />
                    {label}
                  </button>
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
            {!isPastCutoff && <span className="font-mono text-sm font-bold tabular-nums">{timeRemaining}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
