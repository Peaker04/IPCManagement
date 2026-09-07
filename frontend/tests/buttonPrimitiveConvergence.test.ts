import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  findJsxTags,
  findJsxTagsWithinAncestor,
  findingLocations,
  readProductionSources,
  type CanonSource,
} from './uiCanonSourceInventory'

const production = readProductionSources()

const commandBarExceptionLocations = [
  'src/app/pages/AdminDataPage.tsx:35',
  'src/app/pages/AdminDataPage.tsx:40',
  'src/features/admin/pages/ApprovalRulesPage.tsx:274',
  'src/features/approvals/pages/ApprovalPage.tsx:254',
  'src/features/approvals/pages/ApprovalPage.tsx:264',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:42',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:51',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:61',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:72',
  'src/features/reports/pages/ReportsPage.tsx:85',
  'src/features/reports/pages/ReportsPage.tsx:94',
  'src/features/warehouse/pages/WarehousePageHeader.tsx:31',
]

const adapterExceptionLocations = [
  'src/app/layout/MainLayout.tsx:162',
  'src/app/layout/MainLayout.tsx:227',
  'src/app/layout/MainLayout.tsx:268',
  'src/app/pages/admin-data/AdminBomPanel.tsx:137',
  'src/components/common/ApprovalQueue.tsx:113',
  'src/components/common/ApprovalQueue.tsx:332',
  'src/components/common/PaginationBar.tsx:116',
  'src/components/common/PaginationBar.tsx:132',
  'src/components/common/PaginationBar.tsx:158',
  'src/components/common/ViewSwitcher.tsx:80',
  'src/features/projects/weekly-menu/schedule/SearchableDishPicker.tsx:125',
  'src/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx:44',
  'src/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx:58',
  'src/features/reports/pages/ReportsPricePanel.tsx:177',
  'src/components/common/CursorPaginationBar.tsx:63',
  'src/components/common/CursorPaginationBar.tsx:80',
  'src/components/common/PageStepper.tsx:61',
  'src/components/common/PageStepper.tsx:75',
  'src/components/common/ToastProvider.tsx:64',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:99',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:159',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:220',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:244',
]

const fixture = (text: string): CanonSource[] => [{
  path: 'src/Fixture.tsx',
  sourceFile: ts.createSourceFile('Fixture.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
}]

describe('button primitive convergence', () => {
  it('reads native buttons from the production AST', () => {
    expect(findJsxTags(fixture('export const X = () => <button type="button">Save</button>'), 'button')).toHaveLength(1)
  })

  it('has no unclassified native button action', () => {
    const allButtons = findJsxTags(production, 'button')
    const commandBarButtons = findJsxTagsWithinAncestor(production, 'button', 'CommandBar')
    const commandBarLocations = findingLocations(commandBarButtons)

    expect(commandBarLocations).toEqual(commandBarExceptionLocations)
    const exceptionLocations = new Set([...commandBarExceptionLocations, ...adapterExceptionLocations])
    expect(findingLocations(allButtons).filter((location) => exceptionLocations.has(location)).sort())
      .toEqual([...exceptionLocations].sort())

    const residuals = allButtons.filter((finding) =>
      !exceptionLocations.has(`${finding.path}:${finding.line}`),
    )
    expect(findingLocations(residuals)).toEqual([])
  })
})
