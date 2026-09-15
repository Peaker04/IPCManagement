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
  'src/features/admin/pages/ApprovalRulesPage.tsx:31',
]

const fileExceptionLocations = [
  'src/app/pages/admin-data/AdminBomPanel.tsx:154',
  'src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:81',
]

const pathExceptionLocations = [
  'src/components/ui/VietnameseDateInput.tsx:93',
  'src/components/common/PaginationBar.tsx:105',
  'src/components/common/PaginationBar.tsx:148',
  'src/components/ui/textarea.tsx:7',
  'src/features/approvals/components/MenuAmendmentReconciliation.tsx:70',
  'src/features/chef/production/ServiceRunSection.tsx:169',
  'src/features/chef/production/ServiceRunSection.tsx:186',
  'src/features/warehouse/WarehouseExceptionsWorkbench.tsx:389',
  'src/components/common/TablePreferencesControl.tsx:129',
  'src/features/admin/pages/ApprovalRulesPage.tsx:29',
  'src/features/admin/pages/ApprovalRulesPage.tsx:420',
  'src/features/admin/pages/ApprovalRulesPage.tsx:497',
  'src/features/admin/pages/ApprovalRulesPage.tsx:504',
  // Route-critical controls intentionally stay native to avoid pulling Base UI field closures into eager chunks.
  'src/features/projects/weekly-menu/schedule/QuickServingCell.tsx:29',
  'src/features/projects/weekly-menu/schedule/SearchableDishPicker.tsx:97',
  'src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:83',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:323',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:394',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:408',
  'src/features/purchasing/PurchaseDecisionPanel.tsx:418',
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
