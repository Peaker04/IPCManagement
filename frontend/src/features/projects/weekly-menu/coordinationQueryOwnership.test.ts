import { describe, expect, it } from 'vitest'
import weeklyMenuSource from '../pages/WeeklyMenuPage.tsx?raw'
import importHistorySource from './import/WeeklyMenuImportHistory.tsx?raw'
import importModelSource from './import/useWeeklyMenuImport.ts?raw'
import productionModelSource from './production-plan/useWeeklyProductionPlan.ts?raw'

const queryOwners = [weeklyMenuSource, productionModelSource, importModelSource].join('\n')

describe('Weekly Menu Coordination query ownership contract', () => {
  it('classifies all eight page and workflow query owners through QueryView', () => {
    expect(queryOwners.match(/toLabeledQueryView\(/g)).toHaveLength(8)
    expect(queryOwners).not.toMatch(/(?:weekQuery|historyQuery)\.currentData\?\.data\s*\?\?\s*\[\]/)
  })

  it('keeps skipped dependencies distinct from ready-empty', () => {
    expect(weeklyMenuSource).toContain("instruction: 'Chọn khách hàng để tải thực đơn tuần đã lưu.'")
    expect(weeklyMenuSource).toContain("instruction: 'Chọn khách hàng để tải lịch thực đơn.'")
    expect(weeklyMenuSource).toContain("? 'Chọn khách hàng để tải kế hoạch số suất.'")
  })

  it('uses common presentation boundaries without adding a feature-to-feature import', () => {
    expect(weeklyMenuSource).toContain('<QueryViewBoundary preserveFallback')
    expect(importHistorySource).toContain('<QueryViewBoundary')
  })

  it('does not expose retry for query-level forbidden states', () => {
    expect(productionModelSource).toContain("isForbidden: weekView.phase === 'forbidden'")
    expect(importHistorySource).not.toContain('status.isHistoryError')
  })

  it('preserves cached data for retryable errors without exposing it after forbidden', () => {
    expect(weeklyMenuSource.match(/phase === 'error' \?/g)).toHaveLength(5)
    expect(weeklyMenuSource).not.toMatch(/phase === 'forbidden' \? [A-Za-z]+Query\.currentData/)
    expect(importModelSource).toContain("historyView.phase === 'error' ? historyQuery.currentData")
  })
})
