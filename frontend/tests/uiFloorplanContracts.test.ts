import { describe, expect, it } from 'vitest'
import { buildUiFloorplanScopeKey, uiFloorplanScopeRegistry } from './uiFloorplanScopeRegistry'
import { findJsxTags, readProductionSources } from './uiCanonSourceInventory'
import {
  sapFioriProvenance,
  uiFloorplanContracts,
  validateUiFloorplanContracts,
  type UiFloorplanContract,
} from './uiFloorplanContracts'

const clean = {
  missing: [], duplicates: [], stale: [], invalidProvenance: [], missingCapability: [],
  invalidCapabilityEvidence: [], missingTableSemantics: [], invalidIdentifierSemantics: [], invalidScrollIntent: [],
}

describe('Phase 26 floorplan, capability, and table contracts', () => {
  it('covers every authoritative scope key exactly once', () => {
    expect(validateUiFloorplanContracts()).toEqual(clean)
    expect(new Set(uiFloorplanContracts.map((contract) => contract.scopeKey)).size).toBe(uiFloorplanContracts.length)
  })

  it('requires task rationale and reasoned exclusions for every declaration', () => {
    uiFloorplanContracts.forEach((contract) => {
      expect(contract.declaration.rationale.length).toBeGreaterThan(20)
      expect(contract.declaration.rejectedAlternatives.length).toBeGreaterThan(0)
      expect(contract.declaration.rejectedAlternatives.every((item) => item.includes('—'))).toBe(true)
    })
  })

  it('pins one directly checked official SAP Fiori provenance entry', () => {
    expect(sapFioriProvenance).toHaveLength(1)
    const [source] = sapFioriProvenance
    expect(source.url).toMatch(/^https:\/\/www\.sap\.com\/design-system\/fiori-design-web\//)
    expect(source.title).toBe('When to Use Which Floorplan')
    expect(source.versionPath).toContain('v1-145')
    expect(source.checkedDate).toBe('2026-08-02')
  })

  it('rejects missing, duplicate, and stale contract keys with exact diagnostics', () => {
    const removed = uiFloorplanContracts[0]
    const missing = uiFloorplanContracts.filter((contract) => contract !== removed)
    expect(validateUiFloorplanContracts(missing).missing).toEqual([removed.scopeKey])
    expect(validateUiFloorplanContracts([...uiFloorplanContracts, removed]).duplicates).toEqual([removed.scopeKey])
    const stale: UiFloorplanContract = { ...removed, scopeKey: 'stale-scope-key' as UiFloorplanContract['scopeKey'] }
    expect(validateUiFloorplanContracts([...uiFloorplanContracts, stale]).stale).toEqual(['stale-scope-key'])
  })

  it('requires strict ALP drilldown and chart-table evidence', () => {
    const alp: UiFloorplanContract = {
      ...uiFloorplanContracts[0],
      declaration: { kind: 'sap-fiori', name: 'Analytical List Page', rationale: 'Analytical root-cause task with explicit object actions.', rejectedAlternatives: ['List Report — no analytical root-cause interaction.'], provenanceRef: sapFioriProvenance[0].referenceId },
      capabilities: [],
    }
    expect(validateUiFloorplanContracts([alp, ...uiFloorplanContracts.slice(1)]).missingCapability).toContain(alp.scopeKey)
  })

  it('keeps identifier columns semantic and declares both scroll axes', () => {
    const tableFindings = findJsxTags(readProductionSources(), 'table')
    expect(tableFindings.length).toBeGreaterThan(0)
    expect(uiFloorplanContracts.every((contract) => contract.table.kind === 'table' || contract.table.reason.trim().length > 0)).toBe(true)
    uiFloorplanContracts.forEach((contract) => {
      if (contract.table.kind === 'table') {
        expect(contract.table.rowKeyFields.length).toBeGreaterThan(0)
        expect(contract.table.columns.every((column) => column.dataType && column.role)).toBe(true)
        expect(contract.table.columns.filter((column) => column.role === 'identifier').every((column) => !/measure|numeric/i.test(column.dataType))).toBe(true)
        expect(contract.table.horizontalScrollIntent).toBeTruthy()
        expect(contract.table.verticalScrollIntent).toBeTruthy()
        expect(contract.table.scrollOwnerRegion).toBeTruthy()
      }
    })
    const invalid = { ...uiFloorplanContracts[0], table: { ...uiFloorplanContracts[0].table as Extract<UiFloorplanContract['table'], { kind: 'table' }>, columns: [{ id: 'id', dataType: 'numeric measure', role: 'identifier' as const }] } }
    expect(validateUiFloorplanContracts([invalid, ...uiFloorplanContracts.slice(1)]).invalidIdentifierSemantics).toContain(invalid.scopeKey)
  })

  it('does not import test-owned contracts into production', () => {
    expect(sapFioriProvenance[0].url).not.toContain('frontend/tests')
    expect(buildUiFloorplanScopeKey(uiFloorplanScopeRegistry[0])).not.toContain('frontend/tests')
  })
})
