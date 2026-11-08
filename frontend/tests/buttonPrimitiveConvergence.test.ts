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
  'src/features/admin/pages/ApprovalRulesPage.tsx:242',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:41',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:50',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:60',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:71',
  'src/features/reports/pages/ReportsPage.tsx:86',
  'src/features/reports/pages/ReportsPage.tsx:96',
  'src/features/warehouse/pages/WarehousePageHeader.tsx:19',
]

const adapterExceptionLocations = [
  'src/app/layout/MainLayout.tsx:180',
  'src/app/layout/MainLayout.tsx:245',
  'src/app/layout/MainLayout.tsx:282',
  'src/app/pages/admin-data/AdminBomPanel.tsx:137',
  'src/components/common/ApprovalQueue.tsx:113',
  'src/components/common/ApprovalQueue.tsx:333',
  'src/components/common/CursorPaginationBar.tsx:63',
  'src/components/common/CursorPaginationBar.tsx:80',
  'src/components/common/PageStepper.tsx:61',
  'src/components/common/PageStepper.tsx:75',
  'src/components/common/PaginationBar.tsx:114',
  'src/components/common/PaginationBar.tsx:130',
  'src/components/common/PaginationBar.tsx:156',
  'src/components/common/ToastProvider.tsx:64',
  'src/components/common/ViewSwitcher.tsx:80',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:101',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:161',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:222',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:246',
  'src/features/projects/weekly-menu/schedule/SearchableDishPicker.tsx:140',
  'src/features/reports/pages/ReportsPricePanel.tsx:178',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:949',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:950',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:951',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:1281',
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
