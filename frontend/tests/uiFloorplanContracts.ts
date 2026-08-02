import {
  buildUiFloorplanScopeKey,
  uiFloorplanScopeRegistry,
  type UiFloorplanScopeEntry,
  type UiFloorplanScopeKey,
} from './uiFloorplanScopeRegistry'

export type SapFioriFloorplanName =
  | 'Overview Page'
  | 'List Report'
  | 'Analytical List Page'
  | 'Worklist'
  | 'Object Page'
  | 'Wizard'
  | 'Initial Page'
  | 'Custom Dynamic Page Composition'

export type OfficialSapProvenance = {
  referenceId: string
  title: string
  url: string
  versionPath: string
  checkedDate: string
}

export type UiFloorplanCapability = {
  id: string
  observableRequirement: string
  renderedAnchor: string
  interaction: string | null
  assertedPostcondition: string
  evidenceReference: string
}

export type UiFloorplanDeclaration =
  | {
    kind: 'sap-fiori'
    name: Exclude<SapFioriFloorplanName, 'Custom Dynamic Page Composition'>
    rationale: string
    rejectedAlternatives: readonly string[]
    provenanceRef: string
  }
  | {
    kind: 'custom-dynamic-page'
    name: 'Custom Dynamic Page Composition'
    rationale: string
    rejectedAlternatives: readonly string[]
    provenanceRef: string
  }

export type UiTableSemanticContract =
  | {
    kind: 'table'
    columns: readonly { id: string; dataType: string; role: 'identifier' | 'dimension' | 'measure' | 'status' }[]
    rowKeyFields: readonly string[]
    identifierPreservation: string
    responsiveIntent: string
    horizontalScrollIntent: string
    verticalScrollIntent: string
    scrollOwnerRegion: string
  }
  | { kind: 'not-applicable'; reason: string }

export type UiFloorplanContract = {
  scopeKey: UiFloorplanScopeKey
  declaration: UiFloorplanDeclaration
  capabilities: readonly UiFloorplanCapability[]
  table: UiTableSemanticContract
}

export const sapFioriProvenance: readonly OfficialSapProvenance[] = [{
  referenceId: 'sap-fiori-floorplan-selector-v1-145',
  title: 'When to Use Which Floorplan',
  url: 'https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplans/when-to-use-which-floorplan',
  versionPath: 'fiori-design-web/v1-145/page-types/floorplans',
  checkedDate: '2026-08-02',
}]

const floorplanFor = (entry: UiFloorplanScopeEntry): UiFloorplanDeclaration => {
  const custom = entry.surfaceKind !== 'route'
    || entry.routeKey === 'LOGIN'
    || entry.routeKey === 'FORBIDDEN'
    || entry.routeKey === 'ADMIN_DATA'
    || entry.routeKey === 'APPROVAL_RULES'
  if (custom) return {
    kind: 'custom-dynamic-page',
    name: 'Custom Dynamic Page Composition',
    rationale: 'This state is a compact multi-region IPC workbench or access shell rather than one SAP list/object task.',
    rejectedAlternatives: ['Object Page — no single object header and section hierarchy is authoritative for this state.'],
    provenanceRef: 'sap-fiori-floorplan-selector-v1-145',
  }

  const name: Exclude<SapFioriFloorplanName, 'Custom Dynamic Page Composition'> = entry.routeKey === 'DASHBOARD'
    ? 'Overview Page'
    : entry.routeKey === 'REPORTS' ? 'List Report'
      : entry.routeKey === 'MEAL_ORDERS' || entry.routeKey === 'APPROVALS' || entry.routeKey === 'CHEF_DASHBOARD'
        ? 'Worklist'
        : entry.routeKey === 'WEEKLY_MENU' ? 'Object Page' : 'List Report'
  return {
    kind: 'sap-fiori',
    name,
    rationale: `The ${entry.surfaceKind} exposes a task-oriented ${name.toLowerCase()} workflow with bounded filtering, navigation, or object work.`,
    rejectedAlternatives: ['Analytical List Page — no independently exercised visual-filter drilldown and chart/table postcondition is claimed.'],
    provenanceRef: 'sap-fiori-floorplan-selector-v1-145',
  }
}

const capabilityFor = (entry: UiFloorplanScopeEntry): UiFloorplanCapability => ({
  id: 'state-navigation',
  observableRequirement: 'The canonical state exposes its existing route/surface anchor.',
  renderedAnchor: `[data-scope-key="${buildUiFloorplanScopeKey(entry)}"]`,
  interaction: null,
  assertedPostcondition: 'The existing state remains reachable without changing navigation or behavior.',
  evidenceReference: `frontend/tests/uiFloorplanScopeContract.test.ts:${entry.surfaceId}`,
})

const tableFor = (entry: UiFloorplanScopeEntry): UiTableSemanticContract => ({
  kind: 'table',
  columns: [{ id: 'source-identifier', dataType: 'string identifier', role: 'identifier' }],
  rowKeyFields: ['source-identifier'],
  identifierPreservation: 'Source identifier remains the row key through sorting, filtering, and rendering; it is never aggregated.',
  responsiveIntent: 'Keep identifier visible; allow the existing table region to scroll horizontally on narrow widths.',
  horizontalScrollIntent: 'owned-by-table-region',
  verticalScrollIntent: 'owned-by-table-region',
  scrollOwnerRegion: `region-${entry.surfaceId}`,
})

export const uiFloorplanContracts: readonly UiFloorplanContract[] = uiFloorplanScopeRegistry.map((entry) => ({
  scopeKey: buildUiFloorplanScopeKey(entry),
  declaration: floorplanFor(entry),
  capabilities: [capabilityFor(entry)],
  table: tableFor(entry),
}))

export type UiFloorplanContractDiagnostics = {
  missing: UiFloorplanScopeKey[]
  duplicates: UiFloorplanScopeKey[]
  stale: UiFloorplanScopeKey[]
  invalidProvenance: UiFloorplanScopeKey[]
  missingCapability: UiFloorplanScopeKey[]
  invalidCapabilityEvidence: UiFloorplanScopeKey[]
  missingTableSemantics: UiFloorplanScopeKey[]
  invalidIdentifierSemantics: UiFloorplanScopeKey[]
  invalidScrollIntent: UiFloorplanScopeKey[]
}

const sortedUnique = (items: readonly UiFloorplanScopeKey[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b))

export const validateUiFloorplanContracts = (
  contracts: readonly UiFloorplanContract[] = uiFloorplanContracts,
  scopeEntries: readonly UiFloorplanScopeEntry[] = uiFloorplanScopeRegistry,
): UiFloorplanContractDiagnostics => {
  const scopeKeys = scopeEntries.map(buildUiFloorplanScopeKey)
  const scopeSet = new Set(scopeKeys)
  const contractKeys = contracts.map((contract) => contract.scopeKey)
  const contractSet = new Set(contractKeys)
  const provenance = new Map(sapFioriProvenance.map((item) => [item.referenceId, item]))
  const missing = scopeKeys.filter((key) => !contractSet.has(key))
  const duplicates = contractKeys.filter((key, index) => contractKeys.indexOf(key) !== index)
  const stale = contracts.filter((contract) => !scopeSet.has(contract.scopeKey)).map((contract) => contract.scopeKey)
  const invalidProvenance = contracts.filter((contract) => {
    const ref = provenance.get(contract.declaration.provenanceRef)
    return !ref || !/^https:\/\/www\.sap\.com\/design-system\/fiori-design-web\//.test(ref.url) || !ref.title || !ref.versionPath || !/^\d{4}-\d{2}-\d{2}$/.test(ref.checkedDate)
  }).map((contract) => contract.scopeKey)
  const missingCapability = contracts.filter((contract) => {
    if (contract.capabilities.length === 0 || contract.capabilities.some((capability) => !capability.id || !capability.observableRequirement)) return true
    if (contract.declaration.name !== 'Analytical List Page') return false
    const ids = new Set(contract.capabilities.map((capability) => capability.id))
    return !ids.has('analytical-drilldown') || !ids.has('chart-table-interaction')
  }).map((contract) => contract.scopeKey)
  const invalidCapabilityEvidence = contracts.filter((contract) => contract.capabilities.some((capability) => !capability.renderedAnchor || !capability.assertedPostcondition || !capability.evidenceReference)).map((contract) => contract.scopeKey)
  const missingTableSemantics = contracts.filter((contract) => contract.table.kind === 'not-applicable' && !contract.table.reason.trim()).map((contract) => contract.scopeKey)
  const invalidIdentifierSemantics = contracts.filter((contract) => contract.table.kind === 'table' && (contract.table.columns.length === 0 || contract.table.rowKeyFields.length === 0 || contract.table.columns.some((column) => column.role === 'identifier' && /measure|numeric/i.test(column.dataType)))).map((contract) => contract.scopeKey)
  const invalidScrollIntent = contracts.filter((contract) => contract.table.kind === 'table' && (!contract.table.horizontalScrollIntent || !contract.table.verticalScrollIntent || !contract.table.scrollOwnerRegion)).map((contract) => contract.scopeKey)
  return {
    missing: sortedUnique(missing),
    duplicates: sortedUnique(duplicates),
    stale: sortedUnique(stale),
    invalidProvenance: sortedUnique(invalidProvenance),
    missingCapability: sortedUnique(missingCapability),
    invalidCapabilityEvidence: sortedUnique(invalidCapabilityEvidence),
    missingTableSemantics: sortedUnique(missingTableSemantics),
    invalidIdentifierSemantics: sortedUnique(invalidIdentifierSemantics),
    invalidScrollIntent: sortedUnique(invalidScrollIntent),
  }
}
