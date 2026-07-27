/**
 * IPC Management — Shared date/shift utilities
 *
 * getTodayDayCode() was duplicated in coordinationSlice.ts and ChefDashboardPage.tsx.
 * getDayLabel() provides human-readable label lookup.
 */

import { getBangkokDayCode } from '@/lib/chefServiceDate'
import { DAYS_OF_WEEK } from './constants'

/** Lấy mã ngày hôm nay theo giờ nghiệp vụ Việt Nam: t2..t7, cn */
export const getTodayDayCode = (): string => getBangkokDayCode()

/** Lấy nhãn ngày từ mã ngày (e.g. 't2' → 'Thứ Hai') */
export const getDayLabel = (dayCode: string): string =>
  DAYS_OF_WEEK.find((d) => d.key === dayCode)?.label ?? dayCode
