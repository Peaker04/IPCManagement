import { describe, expect, it } from 'vitest'
import type { WeeklyMenuImportResult } from '@/api/coordinationApi'
import type { WeeklyMenuImportJob } from '../model/types'
import { buildImportValidationChecks, hasBlockingImportIssues } from './importValidation'

describe('weekly menu new-dish validation', () => {
  it('treats a new dish warning as committable and explains that the catalog dish will be created', () => {
    const result = {
      warnings: [],
      rows: [{ existingDish: false, dishName: 'Khổ gà lá chanh' }],
      validation: {
        errorCount: 0,
        warningCount: 1,
        issues: [{ severity: 'warning', code: 'NEW_DISH', message: "Món 'Khổ gà lá chanh' sẽ được tạo mới." }],
      },
      detectedLayout: { sheetName: 'MENU', dayColumns: [], rowsImported: 1, rowsSkipped: 0 },
      customerCode: 'ANV',
      customerName: 'AMANN',
      weekStartDate: '2026-09-14',
      weekEndDate: '2026-09-19',
    } as unknown as WeeklyMenuImportResult
    const job = {
      customerCode: 'ANV',
      customerName: 'AMANN',
      weekStartDate: '2026-09-14',
      priceTierAmount: 25000,
      status: 'previewed',
      previewResult: result,
    } as WeeklyMenuImportJob

    expect(hasBlockingImportIssues(result)).toBe(false)
    expect(buildImportValidationChecks(job).find((check) => check.key === 'dish')).toMatchObject({
      value: '0 đã khớp / 1 món mới',
      tone: 'warning',
      blocking: false,
    })
  })
})
