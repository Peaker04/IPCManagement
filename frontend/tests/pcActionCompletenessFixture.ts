import type { Page, Route } from '@playwright/test'
import { phase09PurchaseOrdersPage, phase09Workbench } from './phase9-test-fixture'
import { PC_VIEWPORTS } from './pcActionCompletenessContract'
export { classifyPcMeasurement } from './pcActionCompletenessContract'
import { UNKNOWN } from './stateActionRegistryContract'
import {
  PA2B_ACTORS,
  weeklyMenuLifecyclePa2bRegistry,
  type WeeklyMenuLifecyclePa2bScenario,
} from './weekly-menu-lifecycle-pa2b-fixture'

export const PC_EXECUTABLE_FAMILIES = [
  'ApprovalDocument',
  'CoordinationOrderScopeLifecycle',
  'MaterialDemand',
  'PurchasingWorkflow',
  'WarehouseFulfilment',
  'WeeklyMenuLifecycle',
] as const

export type PcFamily = typeof PC_EXECUTABLE_FAMILIES[number]
export type PcActorId = 'admin' | 'manager' | 'coordinator' | 'procurement' | 'warehouse'

export type PcControlExpectation = {
  role: 'button' | 'link' | 'spinbutton'
  name: string | RegExp
  source: string
  route: string
  tab?: string
  surface?: string
}

export type PcActionExpectation = {
  kind: 'mutation' | 'navigation' | 'open-surface' | 'fill'
  method?: string
  path?: string
  postAction: string
}

export type PcProjectedRegistryRow = {
  family: PcFamily
  scenarioId: string
  operation: string
  registryActor: string
  backendPermission: string
  frontendPermission: string
  actors: readonly PcActorId[]
  expectedActors?: readonly PcActorId[]
  expectedControl: PcControlExpectation | null
  source: readonly string[]
  disposition: string
  action?: PcActionExpectation
}

const coordinationRoute = '/meal-orders'
const weeklyMenuRoute = '/weekly-menu'

const coordinationScenarios = [
  'draft',
  'forecasted',
  'confirmed',
  'adjusted',
  'completed',
  'archived',
  'cancelled',
  'mixed-confirmed-completed',
  'empty',
  'loading-draft',
] as const

const coordinationSource = (
  operation: string,
  frontend: string,
  backend: string,
) => [
  'frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171',
  frontend,
  'backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15',
  backend,
] as const

const coordinationControl = (
  role: PcControlExpectation['role'],
  name: string,
  source: string,
): PcControlExpectation => ({ role, name, source, route: coordinationRoute })

const coordinationRows: PcProjectedRegistryRow[] = [
  ...(['draft', 'forecasted'] as const).flatMap((scenarioId) => [
    {
      family: 'CoordinationOrderScopeLifecycle' as const,
      scenarioId,
      operation: 'lock-to-confirmed',
      registryActor: 'quanly|dieuphoi',
      backendPermission: 'CoordinationAccess',
      frontendPermission: 'canLock + ActionGuard[quanly,dieuphoi]',
      actors: ['manager', 'coordinator'] as const,
      expectedControl: coordinationControl(
        'button',
        'Chốt đơn cả ngày',
        'frontend/src/features/coordination/components/action-toolbar.tsx:389-400',
      ),
      source: coordinationSource(
        'lock-to-confirmed',
        'frontend/src/features/coordination/components/action-toolbar.tsx:143,389',
        'backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs:89',
      ),
      disposition: 'Known Manager/Coordinator command; intercepted mutation evidence is fixture-only.',
    },
    {
      family: 'CoordinationOrderScopeLifecycle' as const,
      scenarioId,
      operation: 'update-forecast',
      registryActor: UNKNOWN,
      backendPermission: 'CoordinationAccess',
      frontendPermission: 'canEditForecast',
      actors: ['admin', 'manager', 'coordinator'] as const,
      expectedControl: coordinationControl(
        'spinbutton',
        /^Suất dự kiến của /,
        'frontend/src/features/coordination/components/order-table.tsx:358',
      ),
      source: coordinationSource(
        'update-forecast',
        `frontend/${UNKNOWN}: actor gate is not canonical`,
        'backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:166',
      ),
      disposition: 'Actor remains unresolved; admin is reachability baseline only.',
    },
  ]),
  ...(['confirmed', 'adjusted'] as const).flatMap((scenarioId) => [
    {
      family: 'CoordinationOrderScopeLifecycle' as const,
      scenarioId,
      operation: 'signoff-to-completed',
      registryActor: 'quanly|dieuphoi',
      backendPermission: 'CoordinationAccess',
      frontendPermission: 'canSignoff + ActionGuard[quanly,dieuphoi]',
      actors: ['manager', 'coordinator'] as const,
      expectedControl: coordinationControl(
        'button',
        'Hoàn tất ca',
        'frontend/src/features/coordination/components/action-toolbar.tsx:402-413',
      ),
      source: coordinationSource(
        'signoff-to-completed',
        'frontend/src/features/coordination/components/action-toolbar.tsx:144,402',
        'backend/src/IPCManagement.Api/Features/Coordination/Services/OrderSignoffService.cs:140-157',
      ),
      disposition: 'Known Manager/Coordinator command.',
    },
    {
      family: 'CoordinationOrderScopeLifecycle' as const,
      scenarioId,
      operation: 'unlock-to-draft',
      registryActor: 'quanly',
      backendPermission: 'CoordinationAccess + CatalogAccess',
      frontendPermission: 'canUnlock + ActionGuard[quanly]',
      actors: ['manager'] as const,
      expectedControl: coordinationControl(
        'button',
        'Mở khóa ca',
        'frontend/src/features/coordination/components/action-toolbar.tsx:415-426',
      ),
      source: coordinationSource(
        'unlock-to-draft',
        'frontend/src/features/coordination/components/action-toolbar.tsx:145,415',
        'backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs:246-264',
      ),
      disposition: 'Manager-only command.',
    },
    {
      family: 'CoordinationOrderScopeLifecycle' as const,
      scenarioId,
      operation: 'request-adjustment',
      registryActor: UNKNOWN,
      backendPermission: 'CoordinationAccess',
      frontendPermission: 'canRequestAdjustment',
      actors: ['admin', 'manager', 'coordinator'] as const,
      expectedControl: coordinationControl(
        'spinbutton',
        /^Suất thực tế của /,
        'frontend/src/features/coordination/components/order-table.tsx:388',
      ),
      source: coordinationSource(
        'request-adjustment',
        `frontend/${UNKNOWN}: actor gate is not canonical`,
        'backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:62',
      ),
      disposition: 'Actor remains unresolved; admin is reachability baseline only.',
    },
  ]),
  ...coordinationScenarios.map((scenarioId) => {
    const available = scenarioId === 'confirmed' || scenarioId === 'adjusted'
    return {
      family: 'CoordinationOrderScopeLifecycle' as const,
      scenarioId,
      operation: 'export',
      registryActor: available ? 'quanly|dieuphoi' : UNKNOWN,
      backendPermission: 'CoordinationAccess',
      frontendPermission: available ? 'canExport + ActionGuard[quanly,dieuphoi]' : UNKNOWN,
      actors: available
        ? ['manager', 'coordinator'] as const
        : ['admin', 'manager', 'coordinator'] as const,
      expectedControl: available
        ? coordinationControl(
            'button',
            'Xuất báo cáo',
            'frontend/src/features/coordination/components/action-toolbar.tsx:428-439',
          )
        : null,
      source: coordinationSource(
        'export',
        available
          ? 'frontend/src/features/coordination/components/action-toolbar.tsx:146,428'
          : `frontend/${UNKNOWN}: canExport is false for this scenario`,
        `backend/${UNKNOWN}: no entity-status precondition is canonical`,
      ),
      disposition: available
        ? 'Known Manager/Coordinator command.'
        : 'Canonical actor/permission evidence remains unresolved; absence is not a match.',
    }
  }),
]

const materialRows: PcProjectedRegistryRow[] = [
  ['not-created', 'generate', 'Tạo nhu cầu từ KHSX', ['admin', 'manager', 'coordinator']],
  ['pending', 'approval', 'Mở hàng đợi duyệt', ['admin', 'manager']],
  ['approved', 'purchasing', 'Mở thu mua', ['admin', 'manager']],
  ['rejected', 'generate', 'Tính lại nhu cầu', ['admin', 'manager', 'coordinator']],
  ['cancelled', 'generate', 'Tính lại nhu cầu', ['admin', 'manager', 'coordinator']],
  ['terminal', 'none', '', ['admin', 'manager', 'coordinator']],
].map(([scenarioId, operation, name, actors]) => ({
  family: 'MaterialDemand',
  scenarioId: scenarioId as string,
  operation: operation as string,
  registryActor: actors.map((actor) => ({
    admin: 'admin',
    manager: 'quanly',
    coordinator: 'dieuphoi',
  } as const)[actor as 'admin' | 'manager' | 'coordinator']).join('|'),
  backendPermission: operation === 'generate' ? 'DemandGenerateAccess' : UNKNOWN,
  frontendPermission: operation === 'purchasing' ? 'purchase.read' : operation === 'approval' ? 'approval route' : operation === 'generate' ? 'demand.generate' : UNKNOWN,
  actors: actors as PcActorId[],
  expectedControl: operation === 'none'
    ? null
    : {
        role: operation === 'approval' || operation === 'purchasing' ? 'link' : 'button',
        name: name as string,
        source: 'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:38-129',
        route: weeklyMenuRoute,
        tab: 'Nhu cầu',
      },
  source: [
    'frontend/tests/operationalStateActionRegistry.test.ts:315-356',
    'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:16-80',
    'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:38-129',
    'backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-96',
  ],
  disposition: operation === 'none' ? 'Terminal state intentionally has no business action.' : 'Actor set resolved from route and ActionGuard evidence.',
}))

const purchasingOperations = [
  ['demand', 'create-purchase-request', 'Tạo đề xuất mua'],
  ['supplier-price', 'confirm-supplier', 'Xác nhận nhà cung cấp'],
  ['exception', 'submit-price-exception', 'Gửi duyệt ngoại lệ giá'],
  ['submitted', 'open-purchase-approval', 'Mở phê duyệt đề xuất'],
  ['approved-order', 'create-purchase-orders', 'Tạo đơn đặt hàng'],
  ['receiving', 'open-receiving', 'Mở màn hình nhập kho'],
] as const

const purchasingRows: PcProjectedRegistryRow[] = purchasingOperations.map(([scenarioId, operation, label]) => ({
  family: 'PurchasingWorkflow',
  scenarioId,
  operation,
  registryActor: 'admin|quanly|muahang',
  backendPermission: 'PurchaseRead/PurchaseGenerate',
  frontendPermission: 'purchase.read with stage-specific control',
  actors: ['admin', 'manager', 'procurement'],
  expectedControl: {
    role: 'button',
    name: label,
    source: scenarioId === 'receiving'
      ? 'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:128-147'
      : 'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:130-500',
    route: '/purchasing',
  },
  source: [
    'frontend/tests/operationalStateActionRegistry.test.ts:358-404',
    'frontend/src/features/purchasing/purchasingModel.ts:173-244',
    'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:130-500',
    'backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseWorkbenchPolicy.cs:1',
  ],
  disposition: ['submitted', 'receiving'].includes(scenarioId)
    ? 'Navigation control; downstream route denial is an exclusion, not a missing action.'
    : 'Stage action measured on the purchasing route.',
}))

const weeklyCanonicalScenarioIds = [
  'empty',
  'draft',
  'active-incomplete',
  'active-not-generated',
  'active-loading',
  'active-error',
  'active-shortage',
  'active-no-shortage',
  'inconsistent',
  'superseded',
] as const

const weeklyOperationByScenario: Record<typeof weeklyCanonicalScenarioIds[number], string> = {
  empty: 'POST /api/coordination/weekly-menu/import/commit',
  draft: 'PATCH /api/coordination/menu-schedules/{id}/version với status ACTIVE',
  'active-incomplete': 'POST /api/coordination/meal-quantity-plans/quick-servings với complete=true',
  'active-not-generated': 'POST /api/material-demand/generate',
  'active-loading': UNKNOWN,
  'active-error': UNKNOWN,
  'active-shortage': 'Điều hướng tới /purchasing theo ngày/tuần đang chọn',
  'active-no-shortage': UNKNOWN,
  inconsistent: UNKNOWN,
  superseded: UNKNOWN,
}

const weeklyFixtureScenario = (scenarioId: typeof weeklyCanonicalScenarioIds[number]) => (
  weeklyMenuLifecyclePa2bRegistry.find((scenario) => scenario.scenarioId === scenarioId)
  ?? (scenarioId === 'active-shortage'
    ? weeklyMenuLifecyclePa2bRegistry.find((scenario) => scenario.scenarioId === 'active-shortage-approved')
    : undefined)
)

const weeklyRows: PcProjectedRegistryRow[] = weeklyCanonicalScenarioIds.map((scenarioId) => {
  const scenario = weeklyFixtureScenario(scenarioId)
  if (!scenario) throw new Error(`Missing PA2B projection for WeeklyMenuLifecycle/${scenarioId}`)
  const controlSourcePath = scenario.expectedControl?.surface === 'admin-contracts'
    ? 'AdminContractsPanel.tsx'
    : scenario.expectedControl?.surface === 'demand-panel'
      ? 'MaterialDemandSection.tsx'
      : 'WeeklyMenuCommandBar.tsx'
  const expectedControl = scenario.expectedControl
    ? {
        ...scenario.expectedControl,
        source: scenario.source.find((item) => item.includes(controlSourcePath)) ?? scenario.source[0],
        route: scenario.expectedControl.surface === 'admin-contracts' ? '/admin-data?view=contracts' : weeklyMenuRoute,
        tab: scenario.expectedControl.surface === 'demand-panel' ? 'Nhu cầu' : undefined,
      }
    : null
  return {
    family: 'WeeklyMenuLifecycle',
    scenarioId,
    operation: weeklyOperationByScenario[scenarioId],
    registryActor: scenario.actors.map((actor) => PA2B_ACTORS[actor].role).join('|'),
    backendPermission: scenario.actorOracle.admin.backendAvailable === null ? UNKNOWN : 'source-linked PA2B policy evidence',
    frontendPermission: expectedControl ? 'source-linked PA2B route/control evidence' : UNKNOWN,
    actors: scenario.actors.map((actor) => actor === 'manager' ? 'manager' : actor === 'coordinator' ? 'coordinator' : 'admin'),
    expectedActors: scenario.actors
      .filter((actor) => scenario.actorOracle[actor].frontendAvailable)
      .map((actor) => actor === 'manager' ? 'manager' : actor === 'coordinator' ? 'coordinator' : 'admin'),
    expectedControl,
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts:119-240',
      ...scenario.source,
    ],
    disposition: scenarioId === 'draft'
      ? 'D-01: Publish intentionally remains Admin-only (FE stricter than backend).'
      : weeklyOperationByScenario[scenarioId] === UNKNOWN
        ? 'Canonical operation remains unresolved and cannot be KHỚP.'
        : 'Canonical row projected through the reusable PA2B browser scenario.',
  }
})

export const PC_PROJECTED_REGISTRY_ROWS: readonly PcProjectedRegistryRow[] = [
  {
    family: 'ApprovalDocument',
    scenarioId: 'actionable-record',
    operation: UNKNOWN,
    registryActor: UNKNOWN,
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    actors: ['admin'],
    expectedControl: {
      role: 'button',
      name: /Duyệt|Từ chối/,
      source: 'frontend/src/features/approvals/pages/ApprovalPage.tsx:217-239',
      route: '/approvals',
    },
    source: [
      'frontend/tests/operationalStateActionRegistry.test.ts:422-458',
      'frontend/src/lib/actionEligibility.ts:20-47',
      `frontend/src/features/approvals/pages/ApprovalPage.tsx:217-239 — ${UNKNOWN}: approve and reject are both live`,
      'backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalWorkflowService.cs:61-69',
    ],
    disposition: 'Operation, actor and permissions remain unresolved; admin is reachability baseline only.',
  },
  ...coordinationRows,
  ...materialRows,
  ...purchasingRows,
  {
    family: 'WarehouseFulfilment',
    scenarioId: 'eligible-demand',
    operation: UNKNOWN,
    registryActor: UNKNOWN,
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    actors: ['admin', 'warehouse'],
    expectedControl: {
      role: 'button',
      name: 'Tạo phiếu xuất kho',
      source: 'frontend/src/features/warehouse/pages/WarehousePageHeader.tsx:1-50',
      route: '/warehouse',
    },
    source: [
      'frontend/tests/operationalStateActionRegistry.test.ts:460-489',
      'frontend/src/lib/actionEligibility.ts:49-69',
      `frontend/src/features/warehouse/pages/WarehousePageHeader.tsx:1-50 — ${UNKNOWN}: operation remains page-local`,
      'backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs:1',
    ],
    disposition: 'Operation, actor, entity and permissions remain unresolved; no synthetic canonical operation.',
  },
  ...weeklyRows,
]

const action = (
  kind: PcActionExpectation['kind'],
  postAction: string,
  method?: string,
  path?: string,
): PcActionExpectation => ({ kind, method, path, postAction })

export const getPcActionExpectation = (row: PcProjectedRegistryRow): PcActionExpectation | null => {
  if (row.expectedControl === null || row.operation === UNKNOWN) return null
  if (row.family === 'CoordinationOrderScopeLifecycle') {
    if (row.operation === 'lock-to-confirmed') return action('mutation', 'text=Đã ghi nhận chốt đơn cả ngày', 'POST', '/api/coordination/orders/lock')
    if (row.operation === 'signoff-to-completed') return action('mutation', 'text=Đã hoàn tất ca', 'POST', '/api/coordination/orders/signoff')
    if (row.operation === 'unlock-to-draft') return action('mutation', 'text=Đã mở khóa ca', 'POST', '/api/coordination/orders/unlock')
    if (row.operation === 'export') return action('mutation', 'text=Đã tải báo cáo điều phối', 'POST', '/api/coordination/orders/export')
    if (row.operation === 'update-forecast') return action('fill', 'input value changed', 'PATCH', '/api/coordination/orders/{id}/forecast')
    if (row.operation === 'request-adjustment') return action('fill', 'role=alert:Không lưu được số suất', 'POST', '/api/coordination/orders/adjust')
  }
  if (row.family === 'MaterialDemand') {
    if (row.operation === 'generate') return action('mutation', 'text=Đã tạo nhu cầu', 'POST', '/api/material-demand/generate')
    if (row.operation === 'approval') return action('navigation', 'route=/approvals')
    if (row.operation === 'purchasing') return action('navigation', 'route=/purchasing')
  }
  if (row.family === 'PurchasingWorkflow') {
    if (row.operation === 'create-purchase-request') return action('mutation', 'role=status:Đã tạo đề xuất mua', 'POST', '/api/purchase-workflow/from-demand')
    if (row.operation === 'confirm-supplier') return action('mutation', 'role=status:Đã xác nhận nhà cung cấp', 'POST', '/api/purchase-workflow/requests/{id}/lines/{lineId}/supplier-decision')
    if (row.operation === 'submit-price-exception') return action('navigation', 'route=/approvals')
    if (row.operation === 'open-purchase-approval') return action('navigation', 'route=/approvals')
    if (row.operation === 'create-purchase-orders') return action('mutation', 'role=status:Đã tạo', 'POST', '/api/purchase-orders/from-request/{id}')
    if (row.operation === 'open-receiving') return action('navigation', 'route=/warehouse')
  }
  if (row.family === 'WeeklyMenuLifecycle') {
    if (row.scenarioId === 'empty') return action('open-surface', 'text=Nhập thực đơn từ Excel')
    if (row.scenarioId === 'draft') return action('mutation', 'text=Đã chuyển version thực đơn sang ACTIVE.', 'PATCH', '/api/coordination/menu-schedules/{id}/version')
    if (row.scenarioId === 'active-incomplete') return action('mutation', 'text=Đã hoàn tất', 'POST', '/api/coordination/meal-quantity-plans/quick-servings')
    if (row.scenarioId === 'active-not-generated') return action('mutation', 'text=Đã tạo nhu cầu', 'POST', '/api/material-demand/generate')
    if (row.scenarioId === 'active-shortage') return action('navigation', 'route=/purchasing')
  }
  return null
}

export const PC_SOURCE_GUARD_DECLARATIONS = [
  {
    sourcePath: 'frontend/tests/operationalStateActionRegistry.test.ts',
    fragments: [
      "object: 'ApprovalDocument'",
      "object: 'MaterialDemand'",
      "object: 'PurchasingWorkflow'",
      "object: 'WarehouseFulfilment'",
    ],
  },
  {
    sourcePath: 'frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts',
    fragments: [
      'expect(coordinationOrderScopeLifecycleRegistry).toHaveLength(20)',
      "const rowsForEditableScenarios = ['draft', 'forecasted']",
      "const rowsForLockedScenarios = ['confirmed', 'adjusted']",
    ],
  },
  {
    sourcePath: 'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts',
    fragments: [
      "'active-shortage',",
      'export const weeklyMenuLifecycleStateActionRegistry = weeklyMenuLifecyclePa2Registry.map(',
      'expect(weeklyMenuLifecycleStateActionRegistry).toHaveLength(weeklyMenuLifecyclePa2Registry.length)',
    ],
  },
  {
    sourcePath: 'frontend/src/features/projects/weekly-menu/demand/demandModel.ts',
    fragments: [
      "? 'none' as const",
      "? 'purchasing' as const",
      "? 'approval' as const",
    ],
  },
  {
    sourcePath: 'frontend/src/features/purchasing/purchasingModel.ts',
    fragments: purchasingOperations.map(([, , label]) => `label: '${label}'`),
  },
  {
    sourcePath: 'frontend/tests/control-surface.spec.ts',
    fragments: [
      "for (const name of ['Tuần trước', 'Tuần hiện tại', 'Tuần sau', 'Mở màn hình nhập kho'])",
      "await expect(actionGroup.getByRole('button', { name })).toBeVisible()",
    ],
  },
  {
    sourcePath: 'frontend/src/features/coordination/components/order-table.tsx',
    fragments: [
      'aria-label={`Suất dự kiến của ${order.customerName}`}',
      'aria-label={`Suất thực tế của ${order.customerName}`}',
    ],
  },
] as const

export type PcFirewallRecord = {
  method: string
  path: string
  status: number
  intercepted: boolean
  mutation: boolean
  scenario: string
}

export type PcFixtureRuntime = {
  row: PcProjectedRegistryRow
  actor: PcActorId
  requests: PcFirewallRecord[]
  unmatchedApi: PcFirewallRecord[]
  mutations: PcFirewallRecord[]
  observedServiceRequests: Array<{ method: string; url: string; resourceType: string }>
  mutationState: Record<string, string>
}

export const createPcFixtureRuntime = (
  row: PcProjectedRegistryRow = PC_PROJECTED_REGISTRY_ROWS[0],
  actor: PcActorId = 'admin',
): PcFixtureRuntime => ({
  row,
  actor,
  requests: [],
  unmatchedApi: [],
  mutations: [],
  observedServiceRequests: [],
  mutationState: {},
})

const actorProfile = (actor: PcActorId) => {
  const profiles = {
    admin: { username: 'admin', roleCode: 'ADMIN', roleName: 'Admin', permissions: ['*'], isAdminFullAccess: true },
    manager: { username: 'quanly', roleCode: 'MANAGER', roleName: 'Quản lý', permissions: ['coordination.read', 'coordination.order.lock', 'catalog.read', 'purchase.read', 'purchase.generate', 'warehouse.read', 'demand.generate', 'purchase.request.approve'], isAdminFullAccess: false },
    coordinator: { username: 'dieuphoi', roleCode: 'COORDINATOR', roleName: 'Điều phối', permissions: ['coordination.read', 'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff', 'demand.generate'], isAdminFullAccess: false },
    procurement: { username: 'muahang', roleCode: 'PROCUREMENT', roleName: 'Thu mua', permissions: ['purchase.read', 'purchase.generate'], isAdminFullAccess: false },
    warehouse: { username: 'thukho', roleCode: 'WAREHOUSE', roleName: 'Thủ kho', permissions: ['warehouse.read', 'inventory.read'], isAdminFullAccess: false },
  } as const
  const profile = profiles[actor]
  return {
    userId: `pc-${actor}`,
    fullName: `PC ${profile.roleName}`,
    role: profile.username,
    ...profile,
  }
}

export const installPcActor = async (page: Page, actor: PcActorId) => {
  const profile = actorProfile(actor)
  await page.addInitScript((selectedProfile) => {
    window.sessionStorage.setItem('token', `pc-fixture-${selectedProfile.username}`)
    window.localStorage.setItem('user', JSON.stringify({ id: selectedProfile.userId, ...selectedProfile }))
    window.localStorage.setItem('ipc.weeklyMenu.lastCustomerId', 'customer-pc')
    window.localStorage.setItem('ipc.weeklyMenu.lastWeekStartDate', '2026-07-27')
  }, profile)
}

const wrap = (data: unknown, status = 200, message = status < 400 ? 'OK' : 'Fixture error') => ({
  success: status < 400,
  message,
  data,
})

const emptyPage = (pageSize = 100) => ({
  items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0, hasPrev: false, hasNext: false,
})

const coordinationStatuses = (scenarioId: string, runtime?: PcFixtureRuntime) => {
  if (runtime?.mutationState.coordinationStatus) return [runtime.mutationState.coordinationStatus]
  if (scenarioId === 'mixed-confirmed-completed') return ['CONFIRMED', 'COMPLETED']
  if (scenarioId === 'empty') return []
  return [scenarioId === 'loading-draft' ? 'DRAFT' : scenarioId.toUpperCase()]
}

const coordinationOrders = (scenarioId: string, runtime?: PcFixtureRuntime) => coordinationStatuses(scenarioId, runtime).map((status, index) => ({
  id: `pc-order-${index}`,
  quantityPlanLineId: `pc-line-${index}`,
  quantityPlanId: `pc-plan-${index}`,
  menuScheduleId: `pc-schedule-${index}`,
  customerId: `pc-customer-${index}`,
  customerCode: `PC-${index}`,
  customerName: `Khách hàng PC ${index + 1}`,
  mealType: 'Thực đơn PC',
  forecastQuantity: 100,
  actualQuantity: 100,
  unitPrice: 25000,
  appliedRate: 100,
  specialNotes: '',
  serviceDate: '2026-07-27',
  dayOfWeek: 't2',
  shiftName: 'MORNING',
  shift: 'Ca Sáng',
  menuId: `pc-menu-${index}`,
  menuCode: `PC-MENU-${index}`,
  menuName: 'Thực đơn PC',
  dishId: 'pc-dish',
  dishes: [],
  status,
}))

const weeklyScenarioForRuntime = (scenarioId: string): WeeklyMenuLifecyclePa2bScenario | undefined => (
  weeklyMenuLifecyclePa2bRegistry.find((scenario) => scenario.scenarioId === scenarioId)
  ?? (scenarioId === 'active-shortage'
    ? weeklyMenuLifecyclePa2bRegistry.find((scenario) => scenario.scenarioId === 'active-shortage-approved')
    : undefined)
)

const materialDemandScenarioForRuntime = (
  scenarioId: string,
): WeeklyMenuLifecyclePa2bScenario | undefined => {
  const base = weeklyMenuLifecyclePa2bRegistry.find((scenario) => (
    scenario.scenarioId === 'active-not-generated'
  ))
  if (!base) return undefined
  const requestStatus: Record<string, string | undefined> = {
    'not-created': undefined,
    pending: 'DRAFT',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    cancelled: 'CANCELLED',
    terminal: 'EXPORTED',
  }
  return { ...base, scenarioId, demandRequestStatus: requestStatus[scenarioId] }
}

const effectiveWeeklyScenario = (runtime: PcFixtureRuntime) => (
  runtime.row.family === 'MaterialDemand'
    ? materialDemandScenarioForRuntime(runtime.row.scenarioId)
    : weeklyScenarioForRuntime(runtime.row.scenarioId)
)

const weeklyQuantityPlans = (runtime: PcFixtureRuntime) => (
  effectiveWeeklyScenario(runtime)?.quantityPlans.map((plan) => ({
    ...plan,
    lines: plan.lines.map((line) => ({
      ...line,
      customerId: 'customer-pc',
      customerCode: 'PC',
      customerName: 'Khách hàng PC',
    })),
  })) ?? []
)

const demandRequestStatus = (runtime: PcFixtureRuntime) => (
  runtime.mutationState.demandStatus ?? effectiveWeeklyScenario(runtime)?.demandRequestStatus
)

const ingredientDemandRows = (runtime: PcFixtureRuntime) => {
  const status = demandRequestStatus(runtime)
  if (!status) return []
  return [{
    materialRequestId: `pc-material-request-${runtime.row.scenarioId}`,
    requestLineId: `pc-material-line-${runtime.row.scenarioId}`,
    ingredientId: 'ingredient-pc',
    unitId: 'unit-kg',
    bomId: null,
    priceTierAmount: 25000,
    bomScope: 'CUSTOMER',
    status,
    materialRequestStatus: status,
    materialRequestCode: `MR-PC-${runtime.row.scenarioId.toUpperCase()}`,
    sourceDocumentCode: `MR-PC-${runtime.row.scenarioId.toUpperCase()}`,
    requestDate: '2026-07-27',
    serviceDate: '2026-07-27',
    ingredientName: 'Nguyên liệu PC',
    material: 'Nguyên liệu PC',
    totalRequiredQty: 100,
    required: 100,
    currentStockQty: 0,
    available: 0,
    reserved: 0,
    suggestedPurchaseQty: 100,
    unitName: 'kg',
    unit: 'kg',
    dishName: 'Món kiểm thử PC',
    source: 'KHSX PC',
    nextAction: '',
    tone: 'warning',
    customerId: 'customer-pc',
    customerCode: 'PC',
    customerName: 'Khách hàng PC',
  }]
}

const committedWeeklyMenu = (scenario?: WeeklyMenuLifecyclePa2bScenario) => {
  if (!scenario || scenario.scenarioId === 'empty') return null
  const dates = Array.from(new Set(scenario.schedules.map((schedule) => schedule.serviceDate)))
  const rows = (dates.length > 0 ? dates : ['2026-07-27']).map((serviceDate, index) => ({
    serviceDate,
    dayKey: index === 0 ? 't2' : 't3',
    sourceRowNumber: index + 1,
    sourceColumn: index === 0 ? 'B' : 'C',
    sourceSection: 'Mặn',
    sourceShift: 'Ca sáng',
    dbShiftName: 'MORNING',
    variant: 'savory',
    slot: 'main',
    slotLabel: 'Món chính',
    dishName: `Món kiểm thử PC ${index + 1}`,
    rowSpan: 1,
    isMergedContinuation: false,
    existingDish: false,
  }))
  return {
    committed: true,
    fileName: 'pc-read-only-fixture.xlsx',
    customerId: 'customer-pc',
    customerCode: 'PC',
    customerName: 'Khách hàng PC',
    weekStartDate: '2026-07-27',
    weekEndDate: '2026-08-01',
    detectedLayout: {
      sheetName: 'PC',
      labelColumn: 'A',
      dayColumns: [],
      sections: [],
      rowsScanned: rows.length,
      rowsImported: rows.length,
      rowsSkipped: 0,
    },
    warnings: [],
    validation: {
      isValid: true,
      hasCriticalErrors: false,
      errorCount: 0,
      warningCount: 0,
      issues: [],
    },
    rows,
    previewDiff: {
      addedSlots: 0,
      changedSlots: 0,
      removedSlots: 0,
      unchangedSlots: rows.length,
      rows: [],
    },
    importedWeeklyMenu: {},
  }
}

const purchasingWorkbench = (scenarioId: string) => {
  const serviceDate = phase09Workbench.serviceDates[0]
  return {
    ...phase09Workbench,
    selectedDate: '2026-07-27',
    selectedStage: scenarioId,
    serviceDates: [{
      ...serviceDate,
      serviceDate: '2026-07-27',
      currentStage: scenarioId,
      approvedDemandCount: scenarioId === 'demand' ? 1 : 0,
      shortageLineCount: scenarioId === 'supplier-price' ? 1 : 0,
      supplierReadyLineCount: scenarioId === 'exception' ? 1 : 0,
      blockingExceptionCount: scenarioId === 'exception' ? 1 : 0,
      purchaseRequestId: `pc-purchase-request-${scenarioId}`,
      purchaseRequestCode: `PR-PC-${scenarioId.toUpperCase()}`,
      purchaseRequestStatus: scenarioId === 'submitted' ? 'SUBMITTED' : scenarioId === 'approved-order' ? 'APPROVED' : 'DRAFT',
      orderCount: scenarioId === 'approved-order' ? 0 : 1,
      receivingLineCount: scenarioId === 'receiving' ? 1 : 0,
      fullyReceivedLineCount: 0,
      approvedDemands: scenarioId === 'demand' ? [{
        materialRequestId: `pc-material-request-${scenarioId}`,
        requestCode: `MR-PC-${scenarioId.toUpperCase()}`,
        serviceDate: '2026-07-27',
        scope: 'FULLDAY',
        status: 'APPROVED',
        shortageLineCount: 1,
        currentStage: scenarioId,
        purchaseRequestId: null,
        purchaseRequestCode: null,
        purchaseRequestStatus: null,
      }] : [],
    }],
  }
}

const approvalInbox = () => ({
  items: [{
    inboxItemId: 'pc-approval',
    targetType: 'purchase-request',
    targetId: 'pc-purchase-request',
    targetCode: 'PR-PC-001',
    itemType: 'purchase',
    title: 'Duyệt đơn mua nguyên liệu',
    source: 'PR-PC-001',
    ownerRole: 'Quản lý',
    submittedBy: 'Điều phối',
    dueDate: '2026-07-27',
    status: 'PENDING',
    reason: 'PC fixture',
    nextAction: 'Duyệt',
    tone: 'warning',
    route: '/approvals',
    materials: [],
  }],
  limit: 20,
  hasNext: false,
  nextCursor: null,
})

const resolvePcApiData = (path: string, runtime: PcFixtureRuntime): { matched: boolean; data: unknown } => {
  const { family, scenarioId } = runtime.row
  const weeklyScenario = effectiveWeeklyScenario(runtime)
  if (path === '/api/auth/profile') return { matched: true, data: actorProfile(runtime.actor) }
  if (path === '/api/approvals/inbox') return { matched: true, data: family === 'ApprovalDocument' ? approvalInbox() : { items: [], limit: 20, hasNext: false, nextCursor: null } }
  if (path === '/api/approval-rules') return { matched: true, data: [] }
  if (path === '/api/admin/employees/roles') return { matched: true, data: [] }
  if (path === '/api/admin/employees') return { matched: true, data: emptyPage(200) }
  if (path.startsWith('/api/approval-history/')) return { matched: true, data: [] }
  if (path === '/api/coordination/orders') return { matched: true, data: family === 'CoordinationOrderScopeLifecycle' ? coordinationOrders(scenarioId, runtime) : [] }
  if (path === '/api/coordination/meal-quantity-plans') {
    if (family === 'CoordinationOrderScopeLifecycle') {
      return { matched: true, data: coordinationStatuses(scenarioId, runtime).map((status, index) => ({ quantityPlanId: `pc-plan-${index}`, planCode: `PC-${index}`, serviceDate: '2026-07-27', dayOfWeek: 't2', status, lines: [] })) }
    }
    const quantityPlans = weeklyQuantityPlans(runtime)
    return {
      matched: true,
      data: runtime.mutationState.quickServingsStatus === 'COMPLETED'
        ? quantityPlans.map((plan, index) => index === 0 ? { ...plan, status: 'COMPLETED' } : plan)
        : quantityPlans,
    }
  }
  if (path === '/api/coordination/menu-schedules') return { matched: true, data: weeklyScenario?.schedules ?? [] }
  if (path === '/api/coordination/customers') return { matched: true, data: [{ customerId: 'customer-pc', customerCode: 'PC', customerName: 'Khách hàng PC' }] }
  if (path === '/api/coordination/customer-contracts') return { matched: true, data: [{ contractId: 'contract-pc', customerId: 'customer-pc', customerCode: 'PC', customerName: 'Khách hàng PC', isActive: true, contractStatus: 'ACTIVE', menuScheduleCount: weeklyScenario?.schedules.length ?? 0, activeWeekDays: ['MONDAY'], shiftNames: ['MORNING'], defaultMenuPrice: 25000, defaultBomRatePercent: 100 }] }
  if (path === '/api/coordination/weekly-menu/import-history') return { matched: true, data: [] }
  if (path === '/api/coordination/orders/export-data') return { matched: true, data: coordinationOrders(scenarioId, runtime) }
  if (path === '/api/coordination/weekly-menu') return { matched: true, data: committedWeeklyMenu(weeklyScenario) }
  if (path === '/api/purchase-workflow/workbench') return { matched: true, data: purchasingWorkbench(scenarioId) }
  if (path.startsWith('/api/purchase-workflow/requests/') && path.endsWith('/supplier-evidence')) return {
    matched: true,
    data: {
      candidates: [{
        evidenceId: 'pc-evidence-1',
        evidenceType: 'EffectiveQuotation',
        supplierId: 'supplier-pc',
        supplierName: 'Nhà cung cấp PC',
        unitPrice: 125000,
        evidenceDate: '2026-07-26',
        referencePrice: 120000,
        referenceLabel: 'Báo giá fixture',
        isExpired: false,
      }],
      blocker: null,
    },
  }
  if (path.startsWith('/api/purchase-requests')) return { matched: true, data: path.endsWith('/page') ? emptyPage(8) : [] }
  if (path.startsWith('/api/purchase-orders')) return {
    matched: true,
    data: path.includes('/page') ? phase09PurchaseOrdersPage : [],
  }
  if (path.startsWith('/api/supplemental-material-requests')) return { matched: true, data: emptyPage() }
  if (path.startsWith('/api/supplier-quotations/')) return { matched: true, data: emptyPage(8) }
  if (path === '/api/suppliers') return { matched: true, data: [] }
  if (path === '/api/warehouses/selector') return { matched: true, data: [{ warehouseId: 'warehouse-pc', warehouseCode: 'PC', warehouseName: 'Kho PC' }] }
  if (path.startsWith('/api/inventory-issues') || path.startsWith('/api/inventory-receipts')) return { matched: true, data: [] }
  if (path.startsWith('/api/ingredients')) return { matched: true, data: emptyPage(500) }
  if (path === '/api/dishes/catalog') return { matched: true, data: [] }
  if (path.startsWith('/api/production-plans/')) return { matched: true, data: [] }
  if (path === '/api/material-demand/staleness') return { matched: true, data: { hasExistingPlan: Boolean(demandRequestStatus(runtime)), isStale: false, lastGeneratedAt: null, reasons: [], materialRequestId: demandRequestStatus(runtime) ? `pc-material-request-${scenarioId}` : null, requestCode: demandRequestStatus(runtime) ? `MR-PC-${scenarioId.toUpperCase()}` : null, status: demandRequestStatus(runtime) ?? null, canRegenerate: scenarioId !== 'terminal', regenerationBlockReason: scenarioId === 'terminal' ? 'Terminal fixture is read-only.' : null } }
  if (path.startsWith('/api/workflow-reports/')) {
    if (path === '/api/workflow-reports/ingredient-demand') {
      return { matched: true, data: ingredientDemandRows(runtime) }
    }
    if (path === '/api/workflow-reports/ingredient-demand/aggregate/page') {
      const items = ingredientDemandRows(runtime)
      return { matched: true, data: { ...emptyPage(100), items, totalCount: items.length, totalPages: items.length > 0 ? 1 : 0, shortageCount: items.length } }
    }
    if (path.endsWith('/page')) return { matched: true, data: emptyPage(100) }
    return { matched: true, data: [] }
  }
  return { matched: false, data: null }
}

export const handlePcApiRoute = async (route: Route, runtime: PcFixtureRuntime) => {
  const request = route.request()
  const method = request.method().toUpperCase()
  const path = new URL(request.url()).pathname
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  if (mutation) {
    const record = { method, path, status: 200, intercepted: true, mutation: true, scenario: `${runtime.row.family}/${runtime.row.scenarioId}` }
    runtime.requests.push(record)
    runtime.mutations.push(record)
    if (path.endsWith('/orders/lock')) runtime.mutationState.coordinationStatus = 'CONFIRMED'
    if (path.endsWith('/orders/signoff')) runtime.mutationState.coordinationStatus = 'COMPLETED'
    if (path.endsWith('/orders/unlock')) runtime.mutationState.coordinationStatus = 'DRAFT'
    if (path.endsWith('/material-demand/generate')) runtime.mutationState.demandStatus = 'DRAFT'
    if (path.endsWith('/meal-quantity-plans/quick-servings')) {
      const body = request.postDataJSON() as { complete?: boolean } | null
      if (body?.complete === true) runtime.mutationState.quickServingsStatus = 'COMPLETED'
    }
    const data = path.endsWith('/orders/lock')
      ? { lockedShiftNames: ['MORNING'], lockedLineCount: coordinationOrders(runtime.row.scenarioId, runtime).length }
      : path.endsWith('/orders/signoff')
        ? { affectedPlanCount: 1, serviceDate: '2026-07-27', newStatus: 'COMPLETED' }
        : path.endsWith('/orders/unlock')
          ? { affectedPlanCount: 1 }
          : path.endsWith('/orders/export')
            ? { downloadUrl: '/api/coordination/orders/export-data' }
              : path.includes('/purchase-orders/from-request/')
                ? []
                : path.includes('/purchase-workflow/from-demand')
                  ? { purchaseRequestCode: 'PR-PC-FIXTURE' }
                  : path.endsWith('/material-demand/generate')
                    ? {
                        materialRequestId: `pc-material-request-${runtime.row.scenarioId}`,
                        requestCode: `MR-PC-${runtime.row.scenarioId.toUpperCase()}`,
                        serviceDate: '2026-07-27',
                        scope: 'FULLDAY',
                        status: 'DRAFT',
                        productionPlanLineCount: 1,
                        lines: ingredientDemandRows(runtime),
                        missingBomDishes: [],
                        missingConversionIssues: [],
                      }
                  : { fixtureMutation: true }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrap(data)) })
    return
  }

  const resolved = resolvePcApiData(path, runtime)
  const status = resolved.matched ? 200 : 501
  const record = { method, path, status, intercepted: true, mutation: false, scenario: `${runtime.row.family}/${runtime.row.scenarioId}` }
  runtime.requests.push(record)
  if (!resolved.matched) runtime.unmatchedApi.push(record)
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(wrap(resolved.data, status, resolved.matched ? 'OK' : 'Unhandled PC fixture API')),
  })
}

export const installPcApiFirewall = async (page: Page, runtime: PcFixtureRuntime) => {
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') || request.resourceType() === 'websocket') {
      runtime.observedServiceRequests.push({
        method: request.method().toUpperCase(),
        url: request.url(),
        resourceType: request.resourceType(),
      })
    }
  })
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }))
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const serviceRequest = request.resourceType() === 'websocket'
      || (['xhr', 'fetch'].includes(request.resourceType()) && !url.pathname.startsWith('/api/'))
    if (serviceRequest) {
      const record = {
        method: request.method().toUpperCase(),
        path: url.pathname,
        status: 0,
        intercepted: false,
        mutation: !['GET', 'HEAD', 'OPTIONS'].includes(request.method().toUpperCase()),
        scenario: `${runtime.row.family}/${runtime.row.scenarioId}`,
      }
      runtime.requests.push(record)
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
  await page.route(/^https?:\/\/[^/]+\/api\//, (route) => handlePcApiRoute(route, runtime))
}

export const assertPcFirewallClosed = (
  records: readonly PcFirewallRecord[],
  observedServiceRequests: readonly { method: string; url: string; resourceType: string }[] = [],
) => {
  const escaped = records.filter((record) => !record.intercepted || !record.path.startsWith('/api/'))
  if (escaped.length > 0) throw new Error(`PC request escaped interception: ${escaped.map((record) => `${record.method} ${record.path}`).join(', ')}`)
  const observedApi = observedServiceRequests.filter((request) => new URL(request.url).pathname.startsWith('/api/'))
  const interceptedCounts = new Map<string, number>()
  records.forEach((record) => {
    const key = `${record.method.toUpperCase()} ${record.path}`
    interceptedCounts.set(key, (interceptedCounts.get(key) ?? 0) + 1)
  })
  const observedCounts = new Map<string, number>()
  observedApi.forEach((request) => {
    const url = new URL(request.url)
    const key = `${request.method.toUpperCase()} ${url.pathname}`
    observedCounts.set(key, (observedCounts.get(key) ?? 0) + 1)
  })
  observedCounts.forEach((count, key) => {
    if ((interceptedCounts.get(key) ?? 0) < count) {
      throw new Error(`PC observed API request bypassed the route handler: ${key}`)
    }
  })
}

export const PC_FIXTURE_CONTRACT = {
  readOnly: true,
  evidenceKind: 'FE-fixture-read-only',
  backendDbE2e: false,
  apiPattern: '**/api/**',
  unmatchedStatus: 501,
  mutationMode: 'in-memory-fulfill-only',
  viewports: PC_VIEWPORTS,
} as const
