import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  findCall,
  findIdentifier,
  findJsxTags,
  findMethodCalls,
  findProductionImportsFromTests,
  readProductionSources,
  type CanonSource,
} from './uiCanonSourceInventory'

const production = readProductionSources()

const fixture = (text: string): CanonSource[] => [{
  path: 'src/Fixture.tsx',
  sourceFile: ts.createSourceFile('Fixture.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
}]

describe('PB canon source inventory', () => {
  it('keeps only the approved non-status Badge exception', () => {
    expect(findJsxTags(production, 'Badge').map((finding) => finding.path)).toEqual([
      'src/features/chef/components/chef-header.tsx',
    ])
    expect(findJsxTags(fixture('export const X = () => <Badge>Status</Badge>'), 'Badge')).toHaveLength(1)
  })

  it('has no production DataTableShell caller or legacy import-status class projection', () => {
    expect(findJsxTags(production, 'DataTableShell')).toEqual([])
    expect(findIdentifier(production, 'getImportJobStatusClass')).toEqual([])
  })

  it('has no native confirmation and reads the real AST', () => {
    expect(findCall(production, 'window', 'confirm')).toEqual([])
    expect(findCall(fixture('window.confirm("delete?")'), 'window', 'confirm')).toHaveLength(1)
  })

  it('locks the approved deferred server-search owners', () => {
    const legacyTimers = findCall(production, 'window', 'setTimeout').filter((finding) => [
      'src/features/reports/pages/useReportsAuditQualityViewModel.ts',
      'src/features/reports/pages/useReportsPriceViewModel.ts',
    ].includes(finding.path))
    expect(legacyTimers).toEqual([])
    expect(findCall(production, 'globalThis', 'setTimeout').filter((finding) => [
      'src/features/reports/pages/useReportsAuditQualityViewModel.ts',
      'src/features/reports/pages/useReportsPriceViewModel.ts',
    ].includes(finding.path)).map((finding) => finding.path)).toEqual([
      'src/features/reports/pages/useReportsAuditQualityViewModel.ts',
      'src/features/reports/pages/useReportsPriceViewModel.ts',
    ])

    const deferredOwners = new Set(findIdentifier(production, 'useDeferredValue').map((finding) => finding.path))
    for (const owner of [
      'src/features/reports/pages/useReportsAuditQualityViewModel.ts',
      'src/features/reports/pages/useReportsPriceViewModel.ts',
      'src/features/purchasing/quotation/useSupplierQuotations.ts',
      'src/features/warehouse/WarehouseExceptionsWorkbench.tsx',
    ]) expect(deferredOwners.has(owner)).toBe(true)
  })

  it('locks field-adjacent Chef validation and simple confirmation owners', () => {
    const legacyDialogErrors = findIdentifier(production, 'formError').filter((finding) => [
      'src/features/chef/components/excess-material-dialog.tsx',
      'src/features/chef/components/supplemental-request-dialog.tsx',
    ].includes(finding.path))
    expect(legacyDialogErrors).toEqual([])

    const confirmationOwners = findJsxTags(production, 'ConfirmDialog').map((finding) => finding.path)
    for (const owner of [
      'src/app/pages/admin-data/AdminEmployeesPanel.tsx',
      'src/features/projects/weekly-menu/import/WeeklyMenuImportDialog.tsx',
      'src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx',
    ]) expect(confirmationOwners).toContain(owner)
  })

  it('cannot be imported by production code', () => {
    expect(findProductionImportsFromTests(production)).toEqual([])
    expect(findProductionImportsFromTests(fixture("import './registry.test'"))).toHaveLength(1)
    expect(findProductionImportsFromTests(fixture("import '../tests/registry'"))).toHaveLength(1)
  })

  it('locks model rounding and shared/file-size locale formatting exceptions', () => {
    expect(findMethodCalls(production, 'toFixed').map(({ path, line }) => `${path}:${line}`)).toEqual([
      'src/features/chef/production/chefProductionModel.ts:236',
      'src/features/chef/production/chefProductionModel.ts:275',
      'src/features/projects/weekly-menu/purchasing/purchaseSummaryModel.ts:63',
      'src/features/projects/weekly-menu/purchasing/purchaseSummaryModel.ts:64',
    ])
    expect(findMethodCalls(production, 'toLocaleString').map(({ path, line }) => `${path}:${line}`)).toEqual([
      'src/features/projects/weekly-menu/model/formatters.ts:111',
      'src/features/projects/weekly-menu/model/formatters.ts:112',
      'src/lib/formatters.ts:18',
    ])
    expect(findMethodCalls(fixture('const value = amount.toFixed(2)'), 'toFixed')).toHaveLength(1)
    expect(findMethodCalls(fixture("const value = amount.toLocaleString('vi-VN')"), 'toLocaleString')).toHaveLength(1)
  })
})
