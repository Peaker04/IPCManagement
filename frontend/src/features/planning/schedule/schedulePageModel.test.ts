import { describe, expect, it } from 'vitest'
import { buildSchedulePageModel } from './schedulePageModel'

const customers = [{ customerId: 'customer-1', customerCode: 'ANV', customerName: 'AMANN' }]

it('keeps each page fact in one model owner and resolves ready state', () => {
  const model = buildSchedulePageModel({
    customers,
    customerId: 'customer-1',
    weekStartDate: '2026-09-21',
    queryState: 'ready',
    committedMenu: { menuVersionStatus: 'ACTIVE' } as never,
    rows: [{ key: 'row-1' }] as never,
    pricing: { tier: 30000, source: 'Hợp đồng' },
  })

  expect(model.identity).toEqual({ title: 'Kế hoạch tuần', customerLabel: 'ANV - AMANN', weekLabel: '21/09/2026', lifecycle: 'Đã xuất bản' })
  expect(model.pricing).toEqual({ tier: 30000, source: 'Hợp đồng' })
  expect(model.state).toEqual({ kind: 'ready', rows: [{ key: 'row-1' }] })
  expect(model.commands).toEqual({ canImport: true, canEdit: true, canPublish: false })
})

describe('SchedulePageModel states', () => {
  it.each([
    [{ customerId: '', weekStartDate: '', queryState: 'idle', rows: [] }, 'prerequisite'],
    [{ customerId: 'customer-1', weekStartDate: '2026-09-21', queryState: 'loading', rows: [] }, 'loading'],
    [{ customerId: 'customer-1', weekStartDate: '2026-09-21', queryState: 'forbidden', rows: [] }, 'forbidden'],
    [{ customerId: 'customer-1', weekStartDate: '2026-09-21', queryState: 'error', rows: [] }, 'error'],
    [{ customerId: 'customer-1', weekStartDate: '2026-09-21', queryState: 'ready', rows: [] }, 'empty'],
  ] as const)('maps %s to %s without inventing a ready surface', (input, expected) => {
    const model = buildSchedulePageModel({ customers, committedMenu: null, ...input })
    expect(model.state.kind).toBe(expected)
  })
})
