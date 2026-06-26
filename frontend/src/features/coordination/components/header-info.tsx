'use client'

import { Calendar, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ShiftType } from '../types'
import { DAYS_OF_WEEK, SHIFT_LABELS } from '@/lib/constants'
import { useAppDispatch, useCurrentShift, useAppSelector } from '@/app/hooks'
import { setCurrentShift, setCurrentDayOfWeek } from '../coordinationSlice'

interface HeaderInfoProps {
  timeRemaining: string
}

export function HeaderInfo({ timeRemaining }: HeaderInfoProps) {
  const dispatch = useAppDispatch()
  const shift = useCurrentShift()
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  
  const [isShiftOpen, setIsShiftOpen] = useState(false)
  const [isDayOpen, setIsDayOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const handleShiftChange = (newShift: ShiftType) => {
    dispatch(setCurrentShift(newShift))
    setIsShiftOpen(false)
  }

  const handleDayChange = (newDay: string) => {
    dispatch(setCurrentDayOfWeek(newDay))
    setIsDayOpen(false)
  }

  const selectedDayLabel = DAYS_OF_WEEK.find((d) => d.key === currentDayOfWeek)?.label || 'Chọn Ngày'

  return (
    <div className="border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section: Date & Shift & Day Selectors */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative flex items-center text-sm text-slate-600 group">
            <Calendar className="absolute left-2.5 size-4 text-blue-600 pointer-events-none" />
            <input 
              type="date"
              value={selectedDate}
              className="pl-8 pr-2 py-1.5 h-8 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              onChange={(e) => {
                const newDateStr = e.target.value
                setSelectedDate(newDateStr)
                const dateObj = new Date(newDateStr)
                if (!isNaN(dateObj.getTime())) {
                  const dayMap = ['cn', 't2', 't3', 't4', 't5', 't6', 't7']
                  const newDay = dayMap[dateObj.getDay()]
                  dispatch(setCurrentDayOfWeek(newDay))
                }
              }}
            />
          </div>

          {/* Day Dropdown */}
          <div className="relative w-fit z-50">
            <Button
              variant="outline"
              className="flex w-[110px] justify-between items-center rounded-md border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 px-2.5 h-8"
              onClick={() => {
                setIsDayOpen(!isDayOpen)
                setIsShiftOpen(false)
              }}
            >
              <span>{selectedDayLabel}</span>
              <ChevronDown className={`size-4 transition-transform ${isDayOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isDayOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.key}
                    onClick={() => handleDayChange(day.key)}
                    className={`w-full px-2.5 py-1.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                      currentDayOfWeek === day.key ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Shift Dropdown */}
          <div className="relative w-fit z-50">
            <Button
              variant="outline"
              className="flex w-[110px] justify-between items-center rounded-md border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 px-2.5 h-8"
              onClick={() => {
                setIsShiftOpen(!isShiftOpen)
                setIsDayOpen(false)
              }}
            >
              <span>{SHIFT_LABELS[shift]}</span>
              <ChevronDown className={`size-4 transition-transform ${isShiftOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isShiftOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {Object.entries(SHIFT_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleShiftChange(key as ShiftType)}
                    className={`w-full px-2.5 py-1.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                      shift === key ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Countdown Timer */}
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-xs font-semibold text-slate-500">Còn lại trước giờ chốt:</span>
          <span className="font-mono text-lg font-bold text-amber-700">{timeRemaining}</span>
        </div>
      </div>
    </div>
  )
}
