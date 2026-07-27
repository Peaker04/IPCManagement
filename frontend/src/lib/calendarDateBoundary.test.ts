import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTodayDayCode } from '@/lib/dateUtils'
import { addCalendarDays, getBangkokToday } from './chefServiceDate'

describe('vietnam calendar date boundaries', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps today on the vietnam calendar during the 00:00-07:00 window', () => {
    // 02:00 ICT vẫn là 2026-07-26 dù UTC mới 2026-07-25T19:00Z
    expect(getBangkokToday(new Date('2026-07-26T02:00:00+07:00'))).toBe('2026-07-26')
    expect(getBangkokToday(new Date('2026-07-26T00:00:00+07:00'))).toBe('2026-07-26')
    expect(getBangkokToday(new Date('2026-07-26T23:59:59+07:00'))).toBe('2026-07-26')
    // 23:30 UTC ngày hôm trước đã sang ngày mới ở Việt Nam
    expect(getBangkokToday(new Date('2026-07-25T23:30:00Z'))).toBe('2026-07-26')
  })

  it('defaults to the vietnam calendar day when no clock is supplied', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T02:00:00+07:00'))
    expect(getBangkokToday()).toBe('2026-07-26')
    expect(getTodayDayCode()).toBe('cn')

    vi.setSystemTime(new Date('2026-07-27T00:30:00+07:00'))
    expect(getBangkokToday()).toBe('2026-07-27')
    expect(getTodayDayCode()).toBe('t2')
  })

  it('shifts calendar days without collapsing back to the input', () => {
    expect(addCalendarDays('2026-07-26', 1)).toBe('2026-07-27')
    expect(addCalendarDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addCalendarDays('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('shifts calendar days identically for every hour of the day', () => {
    vi.useFakeTimers()
    for (const hour of ['00', '07', '12', '23']) {
      vi.setSystemTime(new Date(`2026-07-26T${hour}:30:00+07:00`))
      expect(addCalendarDays('2026-07-26', 1)).toBe('2026-07-27')
    }
  })
})
