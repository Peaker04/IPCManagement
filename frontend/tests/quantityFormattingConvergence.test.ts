import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  formatNumber,
  formatPercent,
  formatQuantity,
  formatQuantityWithUnit,
} from '../src/lib/formatters'

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

const residualFragments: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['src/app/pages/admin-data/AdminBomPanel.tsx', ['.toFixed(0)']],
  ['src/app/pages/admin-data/AdminStatisticsPanel.tsx', [
    "totalPurchaseQty.toLocaleString('vi-VN')",
    "totalIssuedQty.toLocaleString('vi-VN')",
    "totalUsedQty.toLocaleString('vi-VN')",
    "totalReturnedQty.toLocaleString('vi-VN')",
    'row.change.toFixed(1)',
  ]],
  ['src/features/projects/weekly-menu/cost/MenuCostSection.tsx', [
    "row.portions.toLocaleString('vi-VN')",
    'data.theory.toFixed(2)',
    'data.actual.toFixed(2)',
  ]],
  ['src/features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx', [
    'foodCostPercent.toFixed(1)',
    'ingredient.actualQty.toFixed(3)',
  ]],
  ['src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx', [
    'data.theory.toFixed(2)',
    'data.actual.toFixed(2)',
  ]],
  ['src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx', [
    "row.portions.toLocaleString('vi-VN')",
    "demandView.truncation.shown.toLocaleString('vi-VN')",
    "demandView.truncation.total.toLocaleString('vi-VN')",
  ]],
  ['src/features/projects/weekly-menu/demand/demandModel.ts', [
    "totalPortions.toLocaleString('vi-VN')",
  ]],
  ['src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx', [
    "preview.detectedLayout.rowsImported.toLocaleString('vi-VN')",
  ]],
  ['src/features/projects/weekly-menu/production-plan/ProductionPlanSection.tsx', [
    "activePage.totalServings.toLocaleString('vi-VN')",
    "plan.lines.reduce((total, line) => total + line.totalServings, 0).toLocaleString('vi-VN')",
  ]],
  ['src/features/purchasing/PurchaseLineGroups.tsx', [
    "group.purchaseQty.toLocaleString('vi-VN')",
  ]],
  ['src/components/common/ApprovalQueue.tsx', [
    'formatSignedPercent(record.variancePercent)',
  ]],
]

const countOccurrences = (source: string, fragment: string) =>
  source.split(fragment).length - 1

describe('quantity/count/percent formatting convergence', () => {
  it('keeps canonical Vietnamese output and explicit precision/unit choices', () => {
    expect(formatNumber(1_234_567)).toBe('1.234.567')
    expect(formatQuantity(1_234.5678, { maximumFractionDigits: 2 })).toBe('1.234,57')
    expect(formatQuantityWithUnit(1_234.5678, 'kilogram', { maximumFractionDigits: 3 })).toBe('1.234,568 kg')
    expect(`+${formatPercent(12.345, 2)}`).toBe('+12,35%')
    expect(formatPercent(-12.345, 2)).toBe('-12,35%')
  })

  it('recounts the exact approved residual set to zero', () => {
    const residualCount = residualFragments.reduce((total, [path, fragments]) => {
      const source = readSource(path)
      return total + fragments.reduce((fileTotal, fragment) => fileTotal + countOccurrences(source, fragment), 0)
    }, 0)

    expect(residualCount).toBe(0)
    expect(readSource('src/components/common/ApprovalQueue.tsx')).not.toContain('const formatSignedPercent')
  })

  it('preserves model-rounding and file-size exceptions', () => {
    const purchaseSummaryModel = readSource('src/features/projects/weekly-menu/purchasing/purchaseSummaryModel.ts')
    const weeklyMenuFormatters = readSource('src/features/projects/weekly-menu/model/formatters.ts')

    expect(countOccurrences(purchaseSummaryModel, '.toFixed(2)')).toBe(2)
    expect(purchaseSummaryModel).toContain('Math.round(data.actual * data.referencePrice)')
    expect(weeklyMenuFormatters).toContain("Math.round(bytes / 1024)).toLocaleString('vi-VN')")
    expect(weeklyMenuFormatters).toContain(".toLocaleString('vi-VN', { maximumFractionDigits: 1 })")
  })
})
