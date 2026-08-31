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
  'src/features/admin/pages/ApprovalRulesPage.tsx:244',
  'src/features/approvals/pages/ApprovalPage.tsx:257',
  'src/features/approvals/pages/ApprovalPage.tsx:267',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:48',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:52',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:57',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:62',
  'src/features/reports/pages/ReportsPage.tsx:77',
  'src/features/reports/pages/ReportsPage.tsx:86',
  'src/features/warehouse/pages/WarehousePageHeader.tsx:31',
]

const adapterExceptionLocations = [
  'src/app/layout/MainLayout.tsx:160',
  'src/app/layout/MainLayout.tsx:225',
  'src/app/layout/MainLayout.tsx:266',
  'src/components/common/ApprovalQueue.tsx:75',
  'src/components/common/CursorPaginationBar.tsx:63',
  'src/components/common/CursorPaginationBar.tsx:80',
  'src/components/common/PageStepper.tsx:61',
  'src/components/common/PageStepper.tsx:75',
  'src/components/common/PaginationBar.tsx:98',
  'src/components/common/PaginationBar.tsx:115',
  'src/components/common/PaginationBar.tsx:141',
  'src/components/common/ToastProvider.tsx:64',
  'src/components/common/ViewSwitcher.tsx:76',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:99',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:159',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:220',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:244',
  'src/features/reports/pages/ReportsPricePanel.tsx:183',
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
