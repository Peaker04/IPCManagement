import { describe, expect, it } from 'vitest'
import { getBangkokDayCode, resolveChefServiceDate } from './chefServiceDate'

describe('chef service date', () => {
  it('uses the Bangkok calendar day across the UTC midnight boundary', () => {
    const bangkokMonday = new Date('2026-07-19T17:30:00.000Z')

    expect(getBangkokDayCode(bangkokMonday)).toBe('t2')
    expect(resolveChefServiceDate('t2', bangkokMonday)).toBe('2026-07-20')
    expect(resolveChefServiceDate('cn', bangkokMonday)).toBe('2026-07-26')
  })

  it('resolves weekday changes within the selected Bangkok week', () => {
    const bangkokWednesday = new Date('2026-07-22T05:00:00.000Z')

    expect(resolveChefServiceDate('t2', bangkokWednesday)).toBe('2026-07-20')
    expect(resolveChefServiceDate('t6', bangkokWednesday)).toBe('2026-07-24')
  })
})
