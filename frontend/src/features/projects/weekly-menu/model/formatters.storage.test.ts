import { describe, expect, it } from 'vitest'
import { getStoredWeekStartDate, LAST_WEEKLY_MENU_WEEK_KEY, readWeeklyMenuSelection, writeWeeklyMenuSelection } from './formatters'

const blockedStorage = {
  getItem: () => { throw new DOMException('blocked', 'SecurityError') },
  setItem: () => { throw new DOMException('full', 'QuotaExceededError') },
  removeItem: () => { throw new DOMException('blocked', 'SecurityError') },
} as unknown as Storage

describe('weekly-menu selection persistence', () => {
  it('falls back without breaking selection actions when storage is unavailable', () => {
    expect(readWeeklyMenuSelection('selection', blockedStorage)).toBe('')
    expect(() => writeWeeklyMenuSelection('selection', 'customer-1', blockedStorage)).not.toThrow()
    expect(() => writeWeeklyMenuSelection('selection', '', blockedStorage)).not.toThrow()
  })

  it('normalizes a stored non-Monday week even when write-back is rejected', () => {
    const storage = {
      getItem: (key: string) => key === LAST_WEEKLY_MENU_WEEK_KEY ? '2026-09-16' : null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError') },
      removeItem: () => undefined,
    } as unknown as Storage

    expect(getStoredWeekStartDate(storage)).toBe('2026-09-14')
  })

  it('survives a blocked browser localStorage getter', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError') } })
    try {
      expect(readWeeklyMenuSelection('selection')).toBe('')
      expect(() => writeWeeklyMenuSelection('selection', 'customer-1')).not.toThrow()
      expect(getStoredWeekStartDate()).toBe('')
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else delete (window as unknown as { localStorage?: Storage }).localStorage
    }
  })
})
