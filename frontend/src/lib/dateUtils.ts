/**
 * IPC Management — Shared date/shift utilities
 *
 * getTodayDayCode() was duplicated in coordinationSlice.ts and ChefDashboardPage.tsx.
 * getDayLabel() provides human-readable label lookup.
 */

import { DAYS_OF_WEEK } from './constants'

/** Lấy mã ngày hôm nay: t2..t7, cn */
export const getTodayDayCode = (): string => {
  const day = new Date().getDay() // 0 is Sunday, 1 is Monday...
  if (day === 0) return 'cn'
  return `t${day + 1}`
}

/** Lấy nhãn ngày từ mã ngày (e.g. 't2' → 'Thứ Hai') */
export const getDayLabel = (dayCode: string): string =>
  DAYS_OF_WEEK.find((d) => d.key === dayCode)?.label ?? dayCode
