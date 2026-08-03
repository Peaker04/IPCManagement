import { describe, expect, it } from 'vitest'
import type { WeeklyMenuImportHistoryItem } from '@/api/coordinationApi'
import { matchesWeeklyMenuImportHistorySearch } from './weeklyMenuImportHistorySearch'

const historyItem = {
  customerCode: 'ANV',
  customerName: 'AMANN',
  weekStartDate: '2030-01-07',
  versionNo: 1,
  status: 'DRAFT',
  createdByName: 'Admin User',
} as WeeklyMenuImportHistoryItem

describe('matchesWeeklyMenuImportHistorySearch', () => {
  it('matches both the ISO source date and the date rendered in the table', () => {
    expect(matchesWeeklyMenuImportHistorySearch(historyItem, '2030-01-07')).toBe(true)
    expect(matchesWeeklyMenuImportHistorySearch(historyItem, '07/01/2030')).toBe(true)
  })

  it('keeps customer, version, status and actor search vocabulary', () => {
    expect(matchesWeeklyMenuImportHistorySearch(historyItem, 'amann')).toBe(true)
    expect(matchesWeeklyMenuImportHistorySearch(historyItem, 'v1')).toBe(true)
    expect(matchesWeeklyMenuImportHistorySearch(historyItem, 'admin user')).toBe(true)
    expect(matchesWeeklyMenuImportHistorySearch(historyItem, 'DAV')).toBe(false)
  })
})
