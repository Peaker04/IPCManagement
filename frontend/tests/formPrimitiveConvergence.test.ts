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
  'src/app/pages/admin-data/AdminContractsPanel.tsx:182',
  'src/app/pages/admin-data/AdminEmployeesPanel.tsx:107',
  'src/features/admin/pages/ApprovalRulesPage.tsx:417',
  'src/features/admin/pages/ApprovalRulesPage.tsx:516',
  'src/features/warehouse/WarehouseExceptionsWorkbench.tsx:323',
  'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx:293',
]

const fileExceptionLocations = [
  'src/app/pages/admin-data/AdminBomPanel.tsx:127',
  'src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:80',
]

const pathExceptionLocations = [
  'src/components/common/PaginationBar.tsx:87',
  'src/components/common/PaginationBar.tsx:131',
  'src/components/ui/textarea.tsx:7',
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
    expect(findingLocations(allControls).filter((location) => exceptionLocations.has(location))).toHaveLength(11)

    const residuals = allControls.filter((finding) =>
      !exceptionLocations.has(`${finding.path}:${finding.line}`),
    )
    expect(findingLocations(residuals)).toEqual([])
  })
})
