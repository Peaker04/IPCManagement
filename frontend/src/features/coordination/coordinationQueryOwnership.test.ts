import { describe, expect, it } from 'vitest'
import dialogSource from './components/dish-detail-dialog.tsx?raw'
import headerSource from './components/header-info.tsx?raw'
import pageSource from './pages/CoordinationPage.tsx?raw'
import apiSource from '@/api/coordinationApi.ts?raw'

const queryOwners = [pageSource, dialogSource].join('\n')

describe('Coordination query ownership contract', () => {
  it('classifies all three Coordination workbench query owners through QueryView', () => {
    expect(queryOwners.match(/toLabeledQueryView\(/g)).toHaveLength(3)
    expect(queryOwners).not.toMatch(/(?:ordersQuery|plansQuery|menuSchedulesQuery|weekQuery|historyQuery)\.currentData\?\.data\s*\?\?\s*\[\]/)
  })

  it('uses presentation boundaries for page and lazy dish metadata', () => {
    expect(pageSource).toContain('<QueryViewBoundary')
    expect(dialogSource).toContain('<QueryViewBoundary')
  })

  it('keeps cached plan state only for retryable errors', () => {
    expect(pageSource).toContain("plansView.phase === 'error' ? plansQuery.currentData : undefined")
    expect(pageSource).not.toContain("plansView.phase === 'forbidden' ? plansQuery.currentData")
  })

  it('uses an explicit service date for historical coordination queries and actions', () => {
    expect(headerSource).toContain('type="date"')
    expect(headerSource).toContain('setCurrentServiceDate')
    expect(pageSource).toContain('serviceDate: currentServiceDate')
    expect(apiSource).toContain('params: { dayOfWeek, serviceDate, shiftName: toApiShiftName(shift) }')
    expect(apiSource).toContain('body: { dayOfWeek, serviceDate, shiftName: toApiShiftName(shift), note }')
  })
})
