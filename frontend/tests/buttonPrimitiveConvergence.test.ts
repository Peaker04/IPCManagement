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
  'src/features/warehouse/pages/WarehousePageHeader.tsx:21',
]

const adapterExceptionLocations = [
  'src/app/layout/MainLayout.tsx:135',
  'src/app/layout/MainLayout.tsx:173',
  'src/app/layout/MainLayout.tsx:211',
  'src/app/layout/MainLayout.tsx:231',
  'src/app/layout/MainLayout.tsx:286',
  'src/app/pages/admin-data/AdminBomPanel.tsx:137',
  'src/components/common/CursorPaginationBar.tsx:63',
  'src/components/common/CursorPaginationBar.tsx:80',
  'src/components/common/PageStepper.tsx:61',
  'src/components/common/PageStepper.tsx:75',
  'src/components/common/PaginationBar.tsx:113',
  'src/components/common/PaginationBar.tsx:131',
  'src/components/common/PaginationBar.tsx:159',
  'src/components/common/ToastProvider.tsx:64',
  'src/components/common/ViewSwitcher.tsx:80',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:101',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:161',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:222',
  'src/features/admin/components/AdvancedDisplaySettings.tsx:246',
  'src/features/planning/cost/CostScreen.tsx:28',
  'src/features/planning/demand/DemandPlanningScreen.tsx:149',
  'src/features/planning/demand/DemandPlanningScreen.tsx:150',
  'src/features/planning/demand/DemandPlanningScreen.tsx:164',
  'src/features/planning/handoff/HandoffScreen.tsx:42',
  'src/features/planning/PlanningPreviewShell.tsx:42',
  'src/features/planning/production-plan/ProductionPlanScreen.tsx:24',
  'src/features/projects/weekly-menu/schedule/SearchableDishPicker.tsx:154',
  'src/features/reports/pages/ReportsPricePanel.tsx:178',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:941',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:942',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:943',
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx:1274',
  'src/features/warehouse/WarehouseExceptionsWorkbench.tsx:343',
  'src/features/warehouse/WarehouseExceptionsWorkbench.tsx:416',
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
