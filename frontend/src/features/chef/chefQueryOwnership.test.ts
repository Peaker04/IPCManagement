import { describe, expect, it } from 'vitest'
import exceptionsSource from './exceptions/useChefExceptions.ts?raw'
import journalSource from './journal/useChefJournal.ts?raw'
import pageSource from './pages/ChefDashboardPage.tsx?raw'
import productionSource from './production/useChefProductionPlan.ts?raw'
import receiptsSource from './receipts/useKitchenReceipts.ts?raw'

const queryOwners = [productionSource, receiptsSource, exceptionsSource, journalSource].join('\n')

describe('Chef query ownership contract', () => {
  it('classifies all seven query owners through QueryView', () => {
    expect(queryOwners.match(/toChefView\(/g)).toHaveLength(7)
    expect(queryOwners).not.toMatch(/(?:catalogQuery|dailyQuery|returnsQuery|documentsQuery|movementsQuery|query)\.data\s*\?\?\s*\[\]/)
  })

  it('keeps production and journal queries scoped to their active tab', () => {
    expect(productionSource.match(/skip: !enabled/g)).toHaveLength(2)
    expect(receiptsSource).toContain('{ skip: !enabled }')
    expect(exceptionsSource).toContain('{ skip: !enabled }')
    expect(journalSource.match(/skip: !enabled/g)).toHaveLength(2)
  })

  it('does not turn skipped or failed context metrics into zero', () => {
    expect(pageSource).toContain("production.queryViews.dailyPlan.phase === 'ready'")
    expect(pageSource).toContain("returnView.phase === 'ready'")
    expect(pageSource).toContain("receiptViewReady ?")
  })

  it('surfaces partial evidence for unpaged return and journal limits', () => {
    expect(exceptionsSource).toContain('page.items.length < page.totalCount')
    expect(journalSource.match(/length >= 20/g)).toHaveLength(2)
  })
})
