import { describe, expect, it } from 'vitest'
import type { ApprovalRecord, DemandLine } from '../src/types/workflow'
import {
  getDemandActionPresentation,
  getDemandApprovalPresentation,
} from '../src/features/projects/weekly-menu/demand/demandModel'
import { resolveNextPurchasingAction, type PurchasingStageId } from '../src/features/purchasing/purchasingModel'
import {
  resolveApprovalAvailability,
  resolveIssueCreationAvailability,
} from '../src/lib/actionEligibility'
import {
  protectedOperationalFamilies,
  type ProtectedOperationalFamily,
} from '../src/routes/protectedOperationalFamilyRegistry.test'
import { coordinationOrderScopeLifecycleRegistry } from '../src/features/coordination/coordinationOrderScopeLifecycleRegistry.test'
import { weeklyMenuLifecycleStateActionRegistry } from '../src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test'
import coordinationRegistrySource from '../src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts?raw'
import weeklyMenuRegistrySource from '../src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts?raw'
import importStateSource from '../src/features/projects/weekly-menu/import/importState.ts?raw'
import scheduleStateSource from '../src/features/projects/weekly-menu/schedule/scheduleState.ts?raw'
import approvalPageSource from '../src/features/approvals/pages/ApprovalPage.tsx?raw'
import warehousePageSource from '../src/features/warehouse/pages/WarehousePage.tsx?raw'
import adminDataPageSource from '../src/app/pages/AdminDataPage.tsx?raw'
import approvalRulesPageSource from '../src/features/admin/pages/ApprovalRulesPage.tsx?raw'
import dashboardPageSource from '../src/features/dashboard/pages/DashboardPage.tsx?raw'
import forbiddenPageSource from '../src/features/auth/pages/ForbiddenPage.tsx?raw'
import reportsPageSource from '../src/features/reports/pages/ReportsPage.tsx?raw'
import chefProductionModelSource from '../src/features/chef/production/chefProductionModel.ts?raw'
import chefProductionSectionSource from '../src/features/chef/production/ChefProductionSection.tsx?raw'
import warehouseReceiptSource from '../src/features/warehouse/WarehousePurchaseReceiptDialog.tsx?raw'
import manifestJson from './operationalRegistryFamilyManifest.json'
import {
  assertStateActionRegistryRows,
  UNKNOWN,
  type RegistryRow,
} from './stateActionRegistryContract'

type BackendEvidence = {
  kind: 'policy' | 'source'
  source: string
}

type RegistryFamily = {
  id: string
  disposition: 'registry'
  registryModule: string
  backendBacked: boolean
  backendEvidence: BackendEvidence[]
}

type DebtFamily = {
  id: string
  disposition: 'debt'
  registryModule: typeof UNKNOWN
  debt: {
    marker: typeof UNKNOWN
    reason: string
    sources: string[]
  }
  backendBacked: boolean
  backendEvidence: BackendEvidence[]
}

type FamilyManifest = {
  schemaVersion: 1
  families: Array<RegistryFamily | DebtFamily>
}

type DebtSourceExpectations = Record<string, Record<string, string[]>>

const manifestDebtRawSources: Record<string, string> = {
  'frontend/src/app/pages/AdminDataPage.tsx': adminDataPageSource,
  'frontend/src/features/admin/pages/ApprovalRulesPage.tsx': approvalRulesPageSource,
  'frontend/src/features/auth/pages/ForbiddenPage.tsx': forbiddenPageSource,
  'frontend/src/features/chef/production/ChefProductionSection.tsx': chefProductionSectionSource,
  'frontend/src/features/chef/production/chefProductionModel.ts': chefProductionModelSource,
  'frontend/src/features/dashboard/pages/DashboardPage.tsx': dashboardPageSource,
  'frontend/src/features/reports/pages/ReportsPage.tsx': reportsPageSource,
  'frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx': warehouseReceiptSource,
}

const manifestDebtExpectations: DebtSourceExpectations = {
  AdminData: {
    'frontend/src/app/pages/AdminDataPage.tsx:15-60': [
      'const model = useAdminDataPageModel();',
      '<ViewSwitcher',
      "onTabChange={(id) => startViewTransition(() => setActiveView(id.replace('admin-', '') as AdminView))}",
    ],
  },
  ApprovalRules: {
    'frontend/src/features/admin/pages/ApprovalRulesPage.tsx:61-102': [
      'const rulesQuery = useGetApprovalRulesQuery();',
      'const [isModalOpen, setIsModalOpen] = useState(false);',
    ],
  },
  Dashboard: {
    'frontend/src/features/dashboard/pages/DashboardPage.tsx:60-82': [
      'useWorkflowOverview();',
      'useGetOperationalKpisQuery();',
    ],
  },
  Forbidden: {
    'frontend/src/features/auth/pages/ForbiddenPage.tsx:6-22': [
      'Không đủ quyền truy cập',
      '<Link to={ROUTES.DASHBOARD}',
    ],
  },
  ProductionPlan: {
    'frontend/src/features/chef/production/chefProductionModel.ts:113-125': [
      'export function buildChefProductionPlan({',
      '}: BuildChefProductionPlanOptions): ProductionPlan {',
    ],
    'frontend/src/features/chef/production/ChefProductionSection.tsx:37-58': [
      'const canReceivePlan =',
      'onClick={() => void onReceivePlan()}',
    ],
  },
  Reports: {
    'frontend/src/features/reports/pages/ReportsPage.tsx:44-66': [
      'const model = useReportsPageModel({',
      'onClick={handleExportActiveReport}',
    ],
  'frontend/src/features/reports/pages/ReportsPage.tsx:144-146': [
      '<ReportQueryBoundary view={activeReportView}>',
    ],
  },
  WarehousePurchaseReceipt: {
    'frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx:66': [
      'export function WarehousePurchaseReceiptDialog({',
    ],
  },
}

export function assertManifestDebtSources(
  manifest: FamilyManifest,
  expectations: DebtSourceExpectations,
  rawSources: Readonly<Record<string, string>>,
): void {
  const debtFamilies = manifest.families.filter((family): family is DebtFamily => (
    family.disposition === 'debt'
  ))
  const manifestFamilyIds = debtFamilies.map((family) => family.id).sort((left, right) => left.localeCompare(right))
  const expectationFamilyIds = Object.keys(expectations).sort((left, right) => left.localeCompare(right))
  if (JSON.stringify(manifestFamilyIds) !== JSON.stringify(expectationFamilyIds)) {
    throw new Error('Manifest debt families and source expectations do not reconcile')
  }

  const expectedRawPaths = new Set<string>()
  for (const family of debtFamilies) {
    const descriptorExpectations = expectations[family.id]
    const manifestDescriptors = [...family.debt.sources].sort((left, right) => left.localeCompare(right))
    const expectedDescriptors = Object.keys(descriptorExpectations).sort((left, right) => left.localeCompare(right))
    if (JSON.stringify(manifestDescriptors) !== JSON.stringify(expectedDescriptors)) {
      throw new Error(`Manifest debt sources and expectations do not reconcile for family "${family.id}"`)
    }

    for (const descriptor of family.debt.sources) {
      const match = /^(frontend\/src\/[A-Za-z0-9_./-]+):(\d+)(?:-(\d+))?$/.exec(descriptor)
      if (!match) throw new Error(`Debt source "${descriptor}" has an invalid descriptor`)

      const [, sourcePath, startValue, endValue] = match
      expectedRawPaths.add(sourcePath)
      const rawSource = rawSources[sourcePath]
      if (rawSource === undefined) {
        throw new Error(`Missing raw source coverage for manifest debt path "${sourcePath}".`)
      }

      const lines = rawSource.split(/\r?\n/)
      const startLine = Number(startValue)
      const endLine = Number(endValue ?? startValue)
      if (startLine < 1 || endLine < startLine || endLine > lines.length) {
        throw new Error(`Debt source "${descriptor}" has an invalid or out-of-bounds declared range.`)
      }

      const rangeSource = lines.slice(startLine - 1, endLine).join('\n')
      const fragments = descriptorExpectations[descriptor]
      if (!Array.isArray(fragments) || fragments.length === 0) {
        throw new Error(`Debt source "${descriptor}" has no expected fragments`)
      }
      for (const fragment of fragments) {
        const rawCount = rawSource.split(fragment).length - 1
        if (rawCount !== 1) {
          throw new Error(
            `Debt source "${descriptor}" expected fragment "${fragment}" exactly once in raw source, found ${rawCount}.`,
          )
        }

        const rangeCount = rangeSource.split(fragment).length - 1
        if (rangeCount !== 1) {
          throw new Error(
            `Debt source "${descriptor}" expected fragment "${fragment}" exactly once in declared range, found ${rangeCount}.`,
          )
        }
      }
    }
  }

  const rawSourcePaths = Object.keys(rawSources).sort((left, right) => left.localeCompare(right))
  const expectedPaths = [...expectedRawPaths].sort((left, right) => left.localeCompare(right))
  if (JSON.stringify(rawSourcePaths) !== JSON.stringify(expectedPaths)) {
    throw new Error('Manifest debt paths and raw source coverage do not reconcile')
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

export function assertOperationalFamilyManifest(
  value: unknown,
  debtExpectations: DebtSourceExpectations,
  rawSources: Readonly<Record<string, string>>,
): asserts value is FamilyManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.families)) {
    throw new Error('Unsupported operational family manifest schema')
  }

  const ids = new Set<string>()
  for (const [index, candidate] of value.families.entries()) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || candidate.id.length === 0) {
      throw new Error(`Family ${index} has an invalid ID`)
    }
    if (ids.has(candidate.id)) throw new Error(`Duplicate family ID: ${candidate.id}`)
    ids.add(candidate.id)

    if (candidate.disposition !== 'registry' && candidate.disposition !== 'debt') {
      throw new Error(`${candidate.id} has an invalid disposition`)
    }
    if (typeof candidate.backendBacked !== 'boolean' || !Array.isArray(candidate.backendEvidence)) {
      throw new Error(`${candidate.id} has invalid backend evidence metadata`)
    }
    if (candidate.backendBacked && candidate.backendEvidence.length === 0) {
      throw new Error(`${candidate.id} has no backend evidence`)
    }
    if (!candidate.backendBacked && candidate.backendEvidence.length !== 0) {
      throw new Error(`${candidate.id} claims backend evidence without a backend contract`)
    }
    for (const evidence of candidate.backendEvidence) {
      if (!isRecord(evidence) || !['policy', 'source'].includes(String(evidence.kind))) {
        throw new Error(`${candidate.id} has an invalid backend evidence kind`)
      }
      if (
        typeof evidence.source !== 'string'
        || !/^backend\/src\/IPCManagement\.Api\/[A-Za-z0-9_./-]+\.cs$/.test(evidence.source)
      ) {
        throw new Error(`${candidate.id} has an invalid backend evidence source`)
      }
    }

    if (candidate.disposition === 'registry') {
      if (
        typeof candidate.registryModule !== 'string'
        || !/^frontend\/(src|tests)\/[A-Za-z0-9_./-]+\.test\.ts$/.test(candidate.registryModule)
        || 'debt' in candidate
      ) {
        throw new Error(`${candidate.id} has an invalid registry module`)
      }
      continue
    }

    if (candidate.registryModule !== UNKNOWN || !isRecord(candidate.debt)) {
      throw new Error(`${candidate.id} has invalid debt metadata`)
    }
    if (
      candidate.debt.marker !== UNKNOWN
      || typeof candidate.debt.reason !== 'string'
      || candidate.debt.reason.length === 0
      || !Array.isArray(candidate.debt.sources)
      || candidate.debt.sources.length === 0
      || candidate.debt.sources.some((source) => (
        typeof source !== 'string'
        || !/^frontend\/src\/[A-Za-z0-9_./-]+:\d+(?:-\d+)?$/.test(source)
      ))
    ) {
      throw new Error(`${candidate.id} has invalid source-linked debt`)
    }
  }

  const sortedIds = [...ids].sort((left, right) => left.localeCompare(right))
  if (JSON.stringify([...ids]) !== JSON.stringify(sortedIds)) {
    throw new Error('Operational family manifest must be sorted by family ID')
  }

  assertManifestDebtSources(value, debtExpectations, rawSources)
}

const registryRow = (row: RegistryRow): RegistryRow => row

const demandLine = (status: string): DemandLine => ({
  id: `demand-${status.toLowerCase()}`,
  materialRequestId: 'material-request-1',
  materialRequestStatus: status,
  sourceDocumentCode: 'MR-1',
  serviceDate: '2026-07-27',
  material: 'Gạo',
  required: 10,
  available: 10,
  reserved: 0,
  unit: 'kg',
  source: 'KHSX',
  status,
  nextAction: '',
  tone: 'neutral',
})

const materialDemandScenarios = [
  { scenarioId: 'not-created', backendStatus: null },
  { scenarioId: 'pending', backendStatus: 'DRAFT' },
  { scenarioId: 'approved', backendStatus: 'APPROVED' },
  { scenarioId: 'rejected', backendStatus: 'REJECTED' },
  { scenarioId: 'cancelled', backendStatus: 'CANCELLED' },
  { scenarioId: 'terminal', backendStatus: 'EXPORTED' },
] as const

const materialDemandRegistry = materialDemandScenarios.map(({ scenarioId, backendStatus }) => {
  const presentation = getDemandApprovalPresentation(
    backendStatus ? [demandLine(backendStatus)] : [],
    '2026-07-27',
  )
  const action = getDemandActionPresentation(presentation.status)
  return registryRow({
    object: 'MaterialDemand',
    scenarioId,
    operation: action.primaryAction,
    scope: 'service-date:2026-07-27',
    entityState: backendStatus ?? UNKNOWN,
    projectionState: presentation.status,
    actor: UNKNOWN,
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    source: [
      'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:16-80',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:37-111',
      'backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-96',
      'backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalWorkflowService.cs:61-69',
    ],
    correspondence: 'KHỚP',
  })
})

const purchasingScenario = (currentStage: PurchasingStageId) => ({
  currentStage,
  approvedDemandCount: currentStage === 'demand' ? 1 : 0,
  shortageLineCount: currentStage === 'supplier-price' ? 1 : 0,
  supplierReadyLineCount: 0,
  blockingExceptionCount: currentStage === 'exception' ? 1 : 0,
  purchaseRequestStatus: currentStage === 'submitted' ? 'SUBMITTED' : null,
  orderCount: currentStage === 'approved-order' ? 0 : 1,
  receivingLineCount: currentStage === 'receiving' ? 1 : 0,
  fullyReceivedLineCount: 0,
})

const purchasingStages: PurchasingStageId[] = [
  'demand',
  'supplier-price',
  'exception',
  'submitted',
  'approved-order',
  'receiving',
]

const purchasingRegistry = purchasingStages.map((stage) => {
  const presentation = resolveNextPurchasingAction(purchasingScenario(stage))
  return registryRow({
    object: 'PurchasingWorkflow',
    scenarioId: stage,
    operation: presentation.label ?? UNKNOWN,
    scope: 'service-date',
    entityState: stage,
    projectionState: presentation.kind,
    actor: UNKNOWN,
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    source: [
      'frontend/src/features/purchasing/purchasingModel.ts:173-244',
      'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:149-438',
      'backend/src/IPCManagement.Api/Features/Purchasing/Controllers/PurchaseWorkflowController.cs:1',
      'backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseWorkbenchPolicy.cs:1',
    ],
    correspondence: 'KHỚP',
  })
})

const actionableApproval: ApprovalRecord = {
  id: 'approval-1',
  targetType: 'material-demand',
  targetId: 'material-request-1',
  type: 'purchase',
  title: 'Nhu cầu vật tư',
  source: 'KHSX',
  owner: 'Quản lí',
  submittedBy: 'Điều phối',
  deadline: 'Trong ca',
  status: 'DRAFT',
  reason: '',
  nextAction: 'Duyệt',
  tone: 'warning',
  materials: [],
}

const approvalAvailability = resolveApprovalAvailability(
  [actionableApproval],
  { isFetching: false, isError: false, isDeciding: false },
)
const approvalRegistry = [
  registryRow({
    object: 'ApprovalDocument',
    scenarioId: 'actionable-record',
    operation: UNKNOWN,
    scope: 'document:material-request-1',
    entityState: actionableApproval.status,
    projectionState: approvalAvailability.statusLabel,
    actor: UNKNOWN,
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    source: [
      'frontend/src/lib/actionEligibility.ts:20-47',
      `frontend/src/features/approvals/pages/ApprovalPage.tsx:217-239 — ${UNKNOWN}: operation remains component-local`,
      'backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalWorkflowService.cs:61-69',
      'backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalInboxService.cs:187-217',
    ],
    correspondence: 'KHỚP',
  }),
]

const issueAvailability = resolveIssueCreationAvailability({
  canManageWarehouse: true,
  isFetching: false,
  candidateCount: 1,
})
const warehouseFulfilmentRegistry = [
  registryRow({
    object: 'WarehouseFulfilment',
    scenarioId: 'eligible-demand',
    operation: UNKNOWN,
    scope: 'document',
    entityState: UNKNOWN,
    projectionState: `canCreate=${issueAvailability.canCreate}`,
    actor: UNKNOWN,
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    source: [
      'frontend/src/lib/actionEligibility.ts:49-69',
      `frontend/src/features/warehouse/pages/WarehousePage.tsx:42-320 — ${UNKNOWN}: operation remains page-local`,
      'frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx:44',
      'backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs:1',
    ],
    correspondence: 'KHỚP',
  }),
]

const executableRegistries: Record<string, readonly RegistryRow[]> = {
  ApprovalDocument: approvalRegistry,
  CoordinationOrderScopeLifecycle: coordinationOrderScopeLifecycleRegistry,
  MaterialDemand: materialDemandRegistry,
  PurchasingWorkflow: purchasingRegistry,
  WarehouseFulfilment: warehouseFulfilmentRegistry,
  WeeklyMenuLifecycle: weeklyMenuLifecycleStateActionRegistry,
}

type CoverageProjection = {
  id: string
  routeKey: string
  disposition: 'registry' | 'debt'
  registryModule: string
  stateSource: ProtectedOperationalFamily['stateSource']
  roleSource: ProtectedOperationalFamily['roleSource']
  operationSource: ProtectedOperationalFamily['operationSource']
  backendEnforcementSource: ProtectedOperationalFamily['backendEnforcementSource']
}

export function compareOperationalFamilyCoverage(
  inventory: readonly ProtectedOperationalFamily[],
  manifest: FamilyManifest,
  registries: Readonly<Record<string, readonly RegistryRow[]>>,
): CoverageProjection[] {
  const discovered = inventory.flatMap((route) => route.families.map((id) => ({ id, route })))
    .sort((left, right) => left.id.localeCompare(right.id))
  const mapped = new Map(manifest.families.map((family) => [family.id, family]))
  const discoveredIds = discovered.map(({ id }) => id)
  const missing = discoveredIds.filter((id) => !mapped.has(id))
  const stale = manifest.families.map(({ id }) => id).filter((id) => !discoveredIds.includes(id))

  if (missing.length > 0) throw new Error(`Missing family mapping: ${missing.join(', ')}`)
  if (stale.length > 0) throw new Error(`Stale family mapping: ${stale.join(', ')}`)

  return discovered.map(({ id, route }) => {
    const family = mapped.get(id)!
    const rows = registries[id]
    if (family.disposition === 'registry') {
      if (!rows || rows.length === 0) throw new Error(`${id} has no executable registry rows`)
      assertStateActionRegistryRows(rows)
      if (rows.some((row) => row.object !== id)) throw new Error(`${id} registry row object drift`)
    } else if (rows) {
      throw new Error(`${id} has stale executable rows for a debt disposition`)
    }

    return {
      id,
      routeKey: route.routeKey,
      disposition: family.disposition,
      registryModule: family.registryModule,
      stateSource: route.stateSource,
      roleSource: route.roleSource,
      operationSource: route.operationSource,
      backendEnforcementSource: route.backendEnforcementSource,
    }
  })
}

const manifest = manifestJson as unknown
assertOperationalFamilyManifest(manifest, manifestDebtExpectations, manifestDebtRawSources)

const registryModuleSources: Record<string, string> = {
  'frontend/tests/operationalStateActionRegistry.test.ts': import.meta.url,
  'frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts': coordinationRegistrySource,
  'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts': weeklyMenuRegistrySource,
}

const componentLocalDebt = [
  {
    id: 'WeeklyMenuImportState',
    marker: UNKNOWN,
    source: 'frontend/src/features/projects/weekly-menu/import/importState.ts:19-36',
    sourceText: importStateSource,
    fragment: 'isOpen: boolean',
  },
  {
    id: 'WeeklyScheduleEditorState',
    marker: UNKNOWN,
    source: 'frontend/src/features/projects/weekly-menu/schedule/scheduleState.ts:11-15',
    sourceText: scheduleStateSource,
    fragment: 'isEditorOpen: false',
  },
  {
    id: 'ApprovalDocumentOperation',
    marker: UNKNOWN,
    source: 'frontend/src/features/approvals/pages/ApprovalPage.tsx:217-239',
    sourceText: approvalPageSource,
    fragment: "openDecisionModal(record, 'Approve')",
  },
  {
    id: 'WarehouseOperation',
    marker: UNKNOWN,
    source: 'frontend/src/features/warehouse/pages/WarehousePage.tsx:42-320',
    sourceText: warehousePageSource,
    fragment: 'resolveIssueCreationAvailability',
  },
  {
    id: 'ProductionPlanOperation',
    marker: UNKNOWN,
    source: 'frontend/src/features/chef/production/ChefProductionSection.tsx:37-58',
    sourceText: chefProductionSectionSource,
    fragment: 'const canReceivePlan =',
  },
  {
    id: 'WarehousePurchaseReceiptOperation',
    marker: UNKNOWN,
      source: 'frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx:66-177',
    sourceText: warehouseReceiptSource,
    fragment: 'const validate =',
  },
] as const

describe('operational state/action family coverage', () => {
  it('schema-checks the single FE/BE manifest without copying state or permission vocabulary', () => {
    expect(() => assertOperationalFamilyManifest(
      manifestJson,
      manifestDebtExpectations,
      manifestDebtRawSources,
    )).not.toThrow()
    const serialized = JSON.stringify(manifestJson)
    ;['entityState', 'projectionState', 'actor', 'operation', 'backendPermission', 'frontendPermission']
      .forEach((field) => expect(serialized).not.toContain(`"${field}"`))
  })

  it('raw-loads and uniquely range-guards every manifest debt descriptor', () => {
    expect(() => assertManifestDebtSources(
      manifest,
      manifestDebtExpectations,
      manifestDebtRawSources,
    )).not.toThrow()
  })

  it('rejects a stale ProductionPlan model range after expectation re-keying', () => {
    const staleDescriptor = 'frontend/src/features/chef/production/chefProductionModel.ts:114-125'
    const originalDescriptor = 'frontend/src/features/chef/production/chefProductionModel.ts:113-125'
    const mutatedManifest = structuredClone(manifest)
    const productionPlan = mutatedManifest.families.find((family) => family.id === 'ProductionPlan')
    if (!productionPlan || productionPlan.disposition !== 'debt') throw new Error('ProductionPlan debt missing')
    productionPlan.debt.sources = productionPlan.debt.sources.map((source) => (
      source === originalDescriptor ? staleDescriptor : source
    ))
    const mutatedExpectations = structuredClone(manifestDebtExpectations)
    mutatedExpectations.ProductionPlan[staleDescriptor] = mutatedExpectations.ProductionPlan[originalDescriptor]
    delete mutatedExpectations.ProductionPlan[originalDescriptor]

    expect(() => assertManifestDebtSources(
      mutatedManifest,
      mutatedExpectations,
      manifestDebtRawSources,
    )).toThrow(
      'Debt source "frontend/src/features/chef/production/chefProductionModel.ts:114-125" expected fragment "export function buildChefProductionPlan({" exactly once in declared range, found 0.',
    )
  })

  it('rejects a missing AdminData fragment in raw source', () => {
    const descriptor = 'frontend/src/app/pages/AdminDataPage.tsx:15-60'
    const mutatedExpectations = structuredClone(manifestDebtExpectations)
    mutatedExpectations.AdminData[descriptor] = [
      '__missing_admin_data_fragment__',
      ...mutatedExpectations.AdminData[descriptor].slice(1),
    ]

    expect(() => assertManifestDebtSources(
      manifest,
      mutatedExpectations,
      manifestDebtRawSources,
    )).toThrow(
      'Debt source "frontend/src/app/pages/AdminDataPage.tsx:15-60" expected fragment "__missing_admin_data_fragment__" exactly once in raw source, found 0.',
    )
  })

  it('rejects an unrelated Forbidden import line after expectation re-keying', () => {
    const unrelatedDescriptor = 'frontend/src/features/auth/pages/ForbiddenPage.tsx:1'
    const originalDescriptor = 'frontend/src/features/auth/pages/ForbiddenPage.tsx:6-22'
    const mutatedManifest = structuredClone(manifest)
    const forbidden = mutatedManifest.families.find((family) => family.id === 'Forbidden')
    if (!forbidden || forbidden.disposition !== 'debt') throw new Error('Forbidden debt missing')
    forbidden.debt.sources = [unrelatedDescriptor]
    const mutatedExpectations = structuredClone(manifestDebtExpectations)
    mutatedExpectations.Forbidden[unrelatedDescriptor] = mutatedExpectations.Forbidden[originalDescriptor]
    delete mutatedExpectations.Forbidden[originalDescriptor]

    expect(() => assertManifestDebtSources(
      mutatedManifest,
      mutatedExpectations,
      manifestDebtRawSources,
    )).toThrow(
      'Debt source "frontend/src/features/auth/pages/ForbiddenPage.tsx:1" expected fragment "Không đủ quyền truy cập" exactly once in declared range, found 0.',
    )
  })

  it('rejects missing raw coverage for the chef production model', () => {
    const rawSourcesWithoutChefModel = { ...manifestDebtRawSources }
    delete rawSourcesWithoutChefModel['frontend/src/features/chef/production/chefProductionModel.ts']

    expect(() => assertManifestDebtSources(
      manifest,
      manifestDebtExpectations,
      rawSourcesWithoutChefModel,
    )).toThrow(
      'Missing raw source coverage for manifest debt path "frontend/src/features/chef/production/chefProductionModel.ts".',
    )
  })

  it('reconciles every route-discovered family and independent source dimension', () => {
    const coverage = compareOperationalFamilyCoverage(
      protectedOperationalFamilies,
      manifest,
      executableRegistries,
    )
    const discoveredIds = protectedOperationalFamilies.flatMap((item) => item.families)
      .sort((left, right) => left.localeCompare(right))

    expect(coverage.map((item) => item.id)).toEqual(discoveredIds)
    coverage.forEach((item) => {
      expect(item.stateSource.source).not.toBe('')
      expect(item.roleSource.source).not.toBe('')
      expect(item.operationSource.source).not.toBe('')
      expect(item.backendEnforcementSource.source).not.toBe('')
    })
  })

  it('executes only importable projections and keeps query/local/server-only contracts as sourced unknown debt', () => {
    Object.values(executableRegistries).forEach(assertStateActionRegistryRows)
    expect(materialDemandRegistry.map((row) => row.projectionState)).toEqual([
      'not-created',
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'terminal',
    ])
    expect(purchasingRegistry.map((row) => row.entityState)).toEqual(purchasingStages)
    expect(approvalRegistry[0].operation).toBe(UNKNOWN)
    expect(warehouseFulfilmentRegistry[0].entityState).toBe(UNKNOWN)

    componentLocalDebt.forEach((debt) => {
      expect(debt.marker).toBe(UNKNOWN)
      expect(debt.source).toMatch(/^frontend\/src\/.+:\d+/)
      expect(debt.sourceText).toContain(debt.fragment)
    })
  })

  it('rejects a missing family mapping from an in-memory manifest copy', () => {
    const missingMaterialDemand: FamilyManifest = {
      ...manifest,
      families: manifest.families.filter((family) => family.id !== 'MaterialDemand'),
    }
    expect(() => compareOperationalFamilyCoverage(
      protectedOperationalFamilies,
      missingMaterialDemand,
      executableRegistries,
    )).toThrow('Missing family mapping: MaterialDemand')
  })

  it('rejects stale registry modules and production imports of test-owned artifacts', () => {
    manifest.families.filter((family) => family.disposition === 'registry').forEach((family) => {
      expect(registryModuleSources[family.registryModule]).toBeTruthy()
    })

    const productionSources = import.meta.glob(['../src/**/*.ts', '../src/**/*.tsx'], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>
    const testOwnedNames = [
      'operationalStateActionRegistry',
      'operationalRegistryFamilyManifest',
      'coordinationOrderScopeLifecycleRegistry',
      'weeklyMenuLifecycleStateActionRegistry',
    ]
    const imports = Object.entries(productionSources)
      .filter(([file]) => !file.includes('.test.') && !file.includes('.spec.'))
      .filter(([, source]) => testOwnedNames.some((name) => source.includes(name)))

    expect(imports).toEqual([])
  })
})
