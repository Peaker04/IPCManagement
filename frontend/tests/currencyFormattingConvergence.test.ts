import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../src/lib/formatters'

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

const residualFragments: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['src/app/pages/admin-data/AdminContractsPanel.tsx', [
    "contract.defaultMenuPrice?.toLocaleString('vi-VN')",
  ]],
  ['src/app/pages/admin-data/AdminStatisticsPanel.tsx', [
    "row.pricePrev.toLocaleString('vi-VN')",
    "row.priceCurrent.toLocaleString('vi-VN')",
  ]],
  ['src/features/admin/pages/ApprovalRulesPage.tsx', [
    "rule.minAmount?.toLocaleString('vi-VN')",
    "rule.maxAmount?.toLocaleString('vi-VN')",
  ]],
  ['src/features/purchasing/PurchaseLineGroups.tsx', [
    "prices[0].toLocaleString('vi-VN')",
    "Math.min(...prices).toLocaleString('vi-VN')",
    "Math.max(...prices).toLocaleString('vi-VN')",
  ]],
  ['src/features/purchasing/quotation/SupplierQuotationSection.tsx', [
    "quotation.unitPrice.toLocaleString('vi-VN')",
  ]],
  ['src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', [
    "Number(actualUnitPrice).toLocaleString('vi-VN')",
  ]],
]

const canonicalFragments: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['src/components/common/ApprovalQueue.tsx', [
    'formatCurrency(record.referencePrice)',
    'formatCurrency(record.proposedPrice)',
  ]],
  ['src/app/pages/admin-data/AdminContractsPanel.tsx', [
    'formatCurrency(contract.defaultMenuPrice)',
  ]],
  ['src/app/pages/admin-data/AdminStatisticsPanel.tsx', [
    'formatCurrency(row.pricePrev)',
    'formatCurrency(row.priceCurrent)',
  ]],
  ['src/features/admin/pages/ApprovalRulesPage.tsx', [
    'formatCurrency(rule.minAmount)',
    'formatCurrency(rule.maxAmount)',
  ]],
  ['src/features/purchasing/PurchaseLineGroups.tsx', [
    'formatCurrency(prices[0])',
    'formatCurrency(Math.min(...prices))',
    'formatCurrency(Math.max(...prices))',
  ]],
  ['src/features/purchasing/quotation/SupplierQuotationSection.tsx', [
    'formatCurrency(quotation.unitPrice)',
  ]],
  ['src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', [
    'formatCurrency(Number(actualUnitPrice), 2)',
  ]],
]

const countOccurrences = (source: string, fragment: string) =>
  source.split(fragment).length - 1

describe('currency formatting convergence', () => {
  it('keeps the canonical Intl VND output', () => {
    expect(formatCurrency(1_234_567)).toBe('1.234.567\u00a0₫')
    expect(formatCurrency(25_000.75)).toBe('25.001\u00a0₫')
    expect(formatCurrency(10.5, 2)).toBe('10,5\u00a0₫')
    expect(`${formatCurrency(25_000)}–${formatCurrency(30_000)}`).toBe('25.000\u00a0₫–30.000\u00a0₫')
    expect(`${formatCurrency(25_000)}/kg`).toBe('25.000\u00a0₫/kg')
  })

  it('recounts the exact PB section 15 residual set to zero', () => {
    const approvalQueue = readSource('src/components/common/ApprovalQueue.tsx')
    const localHelperConsumers = approvalQueue.includes('const formatCurrency')
      ? countOccurrences(approvalQueue, 'formatCurrency(record.referencePrice)')
        + countOccurrences(approvalQueue, 'formatCurrency(record.proposedPrice)')
      : 0
    const residualCount = localHelperConsumers + residualFragments.reduce((total, [path, fragments]) => {
      const source = readSource(path)
      return total + fragments.reduce((fileTotal, fragment) => fileTotal + countOccurrences(source, fragment), 0)
    }, 0)
    const canonicalCount = canonicalFragments.reduce((total, [path, fragments]) => {
      const source = readSource(path)
      return total + fragments.reduce((fileTotal, fragment) => fileTotal + countOccurrences(source, fragment), 0)
    }, 0)

    expect(residualCount).toBe(0)
    expect(canonicalCount).toBe(12)
    expect(approvalQueue).not.toContain('const formatCurrency')
  })
})
