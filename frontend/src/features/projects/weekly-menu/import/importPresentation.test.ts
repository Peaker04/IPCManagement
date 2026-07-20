import { describe, expect, it } from 'vitest'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import { DEFAULT_BOM_PRICE_TIER } from '../../weeklyMenuPlanning'
import type { WeeklyMenuImportJob } from '../model/types'
import { buildImportPresentation } from './importPresentation'

const preview = {
  customerCode: 'KH01',
  customerName: 'Khách hàng 01',
  weekStartDate: '2026-07-20',
  weekEndDate: '2026-07-25',
  warnings: ['Giá đang dùng mặc định.'],
  validation: {
    errorCount: 1,
    warningCount: 1,
    issues: [
      { severity: 'warning', code: 'PRICE', cell: 'B2', message: 'Kiểm tra lại giá.' },
      { severity: 'error', code: 'DATE', cell: 'C3', message: 'Ngày không hợp lệ.' },
    ],
  },
  rows: [],
  previewDiff: { rows: [] },
  detectedLayout: { sheetName: 'Menu', dayColumns: [], rowsImported: 0, rowsSkipped: 0 },
  importedWeeklyMenu: {},
} as unknown as WeeklyMenuImportResult

const job = {
  jobId: 'job-1',
  customerId: 'customer-1',
  customerCode: 'KH01',
  customerName: 'Khách hàng 01',
  weekStartDate: '2026-07-20',
  priceTierAmount: DEFAULT_BOM_PRICE_TIER,
  file: new File(['menu'], 'menu.xlsx'),
  fileName: 'menu.xlsx',
  fileSize: 4,
  status: 'previewed',
  previewResult: preview,
  warnings: preview.warnings,
  error: null,
} as WeeklyMenuImportJob

describe('weekly menu import presentation', () => {
  it('keeps warning-only validation messages out of the blocking error panel', () => {
    const result = buildImportPresentation(job, [], '2026-07-20')

    expect(result.problemMessages).toEqual(['C3: Ngày không hợp lệ.'])
    expect(result.warningMessages).toContain('B2: Kiểm tra lại giá.')
    expect(result.problemMessages).not.toContain('B2: Kiểm tra lại giá.')
  })

  it('shows a warning-only preview without creating a blocking problem message', () => {
    const warningOnlyJob = {
      ...job,
      previewResult: {
        ...preview,
        validation: {
          ...preview.validation,
          errorCount: 0,
          issues: preview.validation.issues.filter((issue) => issue.severity === 'warning'),
        },
      },
    }
    const result = buildImportPresentation(warningOnlyJob, [], '2026-07-20')

    expect(result.problemMessages).toEqual([])
    expect(result.warningMessages).toContain('B2: Kiểm tra lại giá.')
  })
})
