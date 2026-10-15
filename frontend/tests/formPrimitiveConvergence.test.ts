import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  findJsxTags,
  findJsxTagsWithStringAttribute,
  findingLocations,
  readProductionSources,
  type CanonSource,
} from './uiCanonSourceInventory'

const production = readProductionSources()

const checkboxExceptionLocations = [
  'src/components/common/TablePreferencesControl.tsx:105',
]

const fileExceptionLocations = [
  'src/app/pages/admin-data/AdminBomPanel.tsx:153',
  'src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:83',
]

const pathExceptionLocations = [
  'src/components/common/PaginationBar.tsx:102',
  'src/components/common/PaginationBar.tsx:149',
  'src/components/common/TablePreferencesControl.tsx:129',
  'src/components/ui/VietnameseDateInput.tsx:93',
  'src/components/ui/textarea.tsx:7',
  'src/features/admin/pages/ApprovalRulesPage.tsx:387',
  'src/features/admin/pages/ApprovalRulesPage.tsx:474',
  'src/features/admin/pages/ApprovalRulesPage.tsx:481',
  'src/features/approvals/components/MenuAmendmentReconciliation.tsx:76',
  'src/features/chef/production/ServiceRunSection.tsx:188',
  'src/features/chef/production/ServiceRunSection.tsx:212',
  'src/features/planning/cost/CostScreen.tsx:21',
  'src/features/planning/cost/ReadPlanningPreviewPage.tsx:67',
  'src/features/planning/cost/ReadPlanningPreviewPage.tsx:68',
  'src/features/planning/demand/DemandPlanningScreen.tsx:125',
  'src/features/planning/demand/DemandPlanningScreen.tsx:152',
  'src/features/planning/demand/DemandPlanningScreen.tsx:158',
  'src/features/planning/demand/DemandPlanningScreen.tsx:159',
  'src/features/planning/dish-materials/DishMaterialsScreen.tsx:25',
  'src/features/planning/production-plan/ProductionPlanScreen.tsx:22',
  'src/features/planning/schedule/SchedulePage.tsx:31',
  // Route-critical controls intentionally stay native to avoid pulling Base UI field closures into eager chunks.
  'src/features/projects/weekly-menu/schedule/QuickServingCell.tsx:29',
  'src/features/projects/weekly-menu/schedule/SearchableDishPicker.tsx:124',
  'src/features/projects/weekly-menu/schedule/WeeklyScheduleCommandBar.tsx:77',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:40',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:340',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:411',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:427',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:438',
  'src/features/warehouse/WarehouseExceptionsWorkbench.tsx:452',
]

const fixture = (text: string): CanonSource[] => [{
  path: 'src/Fixture.tsx',
  sourceFile: ts.createSourceFile('Fixture.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
}]

describe('form primitive convergence', () => {
  it('reads every native form-control tag from the AST', () => {
    const source = fixture('export const X = () => <><input /><select><option>One</option></select><textarea /></>')
    expect(findJsxTags(source, 'input')).toHaveLength(1)
    expect(findJsxTags(source, 'select')).toHaveLength(1)
    expect(findJsxTags(source, 'textarea')).toHaveLength(1)
  })

  it('has no unclassified native form control', () => {
    const allControls = [
      ...findJsxTags(production, 'input'),
      ...findJsxTags(production, 'select'),
      ...findJsxTags(production, 'textarea'),
    ]
    const checkboxInputs = findJsxTagsWithStringAttribute(production, 'input', 'type', 'checkbox')
    const fileInputs = findJsxTagsWithStringAttribute(production, 'input', 'type', 'file')
    expect(findingLocations(checkboxInputs)).toEqual(checkboxExceptionLocations)
    expect(findingLocations(fileInputs)).toEqual(fileExceptionLocations)

    const exceptionLocations = new Set([
      ...checkboxExceptionLocations,
      ...fileExceptionLocations,
      ...pathExceptionLocations,
    ])
    expect(findingLocations(allControls).filter((location) => exceptionLocations.has(location))).toHaveLength(
      checkboxExceptionLocations.length + fileExceptionLocations.length + pathExceptionLocations.length,
    )

    const residuals = allControls.filter((finding) =>
      !exceptionLocations.has(`${finding.path}:${finding.line}`),
    )
    expect(findingLocations(residuals)).toEqual([])
  })
})
