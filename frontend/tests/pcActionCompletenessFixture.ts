import type { Page, Route } from '@playwright/test'
import { phase09PurchaseOrdersPage, phase09Workbench } from './phase9-test-fixture'
import { PC_VIEWPORTS, type PcFalseMissingExclusions, type PcMismatch } from './pcActionCompletenessContract'
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
}

export type PcProjectedRegistryRow = {
  family: PcFamily
  scenarioId: string
  operation: string
  registryActor: string
  backendPermission: string
  frontendPermission: string
  actors: readonly PcActorId[]
  expectedControl: PcControlExpectation | null
  source: readonly string[]
  disposition: string
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
        'frontend/src/features/coordination/components/action-toolbar.tsx:378',
      ),
      source: coordinationSource(
        'lock-to-confirmed',
        'frontend/src/features/coordination/components/action-toolbar.tsx:141,378',
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
        'Số suất dự báo',
        'frontend/src/features/coordination/components/order-table.tsx',
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
        'frontend/src/features/coordination/components/action-toolbar.tsx:391',
      ),
      source: coordinationSource(
        'signoff-to-completed',
        'frontend/src/features/coordination/components/action-toolbar.tsx:142,391',
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
        'frontend/src/features/coordination/components/action-toolbar.tsx:404',
      ),
      source: coordinationSource(
        'unlock-to-draft',
        'frontend/src/features/coordination/components/action-toolbar.tsx:143,404',
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
        'Số suất thực tế',
        'frontend/src/features/coordination/components/order-table.tsx',
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
            'frontend/src/features/coordination/components/action-toolbar.tsx:417',
          )
        : null,
      source: coordinationSource(
        'export',
        available
          ? 'frontend/src/features/coordination/components/action-toolbar.tsx:144,417'
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
  registryActor: actors.join('|'),
  backendPermission: operation === 'generate' ? 'DemandGenerateAccess' : UNKNOWN,
  frontendPermission: operation === 'purchasing' ? 'purchase.read' : operation === 'approval' ? 'approval route' : operation === 'generate' ? 'demand.generate' : UNKNOWN,
  actors: actors as PcActorId[],
  expectedControl: operation === 'none'
    ? null
    : {
        role: operation === 'approval' || operation === 'purchasing' ? 'link' : 'button',
        name: name as string,
        source: 'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:37-128',
        route: weeklyMenuRoute,
        tab: 'Nhu cầu',
      },
  source: [
    'frontend/tests/operationalStateActionRegistry.test.ts:315-356',
    'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:16-80',
    'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:37-128',
    'backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-96',
  ],
  disposition: operation === 'none' ? 'Terminal state intentionally has no business action.' : 'Actor set resolved from route and ActionGuard evidence.',
}))

const purchasingOperations = [
  ['demand', 'Tạo đề xuất mua'],
  ['supplier-price', 'Xác nhận nhà cung cấp'],
  ['exception', 'Gửi duyệt ngoại lệ giá'],
  ['submitted', 'Mở phê duyệt đề xuất'],
  ['approved-order', 'Tạo đơn đặt hàng'],
  ['receiving', 'Mở màn hình nhập kho'],
] as const

const purchasingRows: PcProjectedRegistryRow[] = purchasingOperations.map(([scenarioId, operation]) => ({
  family: 'PurchasingWorkflow',
  scenarioId,
  operation,
  registryActor: 'admin|quanly|muahang',
  backendPermission: 'PurchaseRead/PurchaseGenerate',
  frontendPermission: 'purchase.read with stage-specific control',
  actors: ['admin', 'manager', 'procurement'],
  expectedControl: {
    role: ['submitted', 'receiving'].includes(scenarioId) ? 'link' : 'button',
    name: operation,
    source: 'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:149-438',
    route: '/purchasing',
  },
  source: [
    'frontend/tests/operationalStateActionRegistry.test.ts:358-404',
    'frontend/src/features/purchasing/purchasingModel.ts:173-244',
    'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:149-438',
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
  const expectedControl = scenario.expectedControl
    ? {
        ...scenario.expectedControl,
        source: scenario.source.find((item) => item.startsWith('frontend/')) ?? scenario.source[0],
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
      source: 'frontend/src/features/warehouse/pages/WarehousePage.tsx:42-320',
      route: '/warehouse',
    },
    source: [
      'frontend/tests/operationalStateActionRegistry.test.ts:460-489',
      'frontend/src/lib/actionEligibility.ts:49-69',
      `frontend/src/features/warehouse/pages/WarehousePage.tsx:42-320 — ${UNKNOWN}: operation remains page-local`,
      'backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs:1',
    ],
    disposition: 'Operation, actor, entity and permissions remain unresolved; no synthetic canonical operation.',
  },
  ...weeklyRows,
]

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
    fragments: purchasingOperations.map(([, operation]) => `label: '${operation}'`),
  },
] as const

export type PcClassificationInput = {
  expected: boolean
  actualCount: number
  exclusions: PcFalseMissingExclusions
  unknownDimensions?: readonly string[]
  routeMismatch?: boolean
  requestExpected?: boolean
  requestObserved?: boolean
}

export const classifyPcMeasurement = ({
  expected,
  actualCount,
  exclusions,
  unknownDimensions = [],
  routeMismatch = false,
  requestExpected = false,
  requestObserved = false,
}: PcClassificationInput): PcMismatch => {
  if (unknownDimensions.length > 0) return 'CHƯA-KẾT-LUẬN-ĐƯỢC'
  if (routeMismatch && actualCount > 0) return 'LỆCH VỊ TRÍ'
  if (!expected && actualCount > 0) return 'MỒ CÔI'
  if (expected && actualCount === 0) {
    return Object.values(exclusions).every((exclusion) => exclusion.ruledOut)
      ? 'THIẾU'
      : 'CHƯA-KẾT-LUẬN-ĐƯỢC'
  }
  if (expected && actualCount > 0 && requestExpected && !requestObserved) return 'IM LẶNG'
  return 'KHỚP'
}

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
}

export const createPcFixtureRuntime = (
  row: PcProjectedRegistryRow = PC_PROJECTED_REGISTRY_ROWS[0],
  actor: PcActorId = 'admin',
): PcFixtureRuntime => ({ row, actor, requests: [], unmatchedApi: [], mutations: [] })

const actorProfile = (actor: PcActorId) => {
  const profiles = {
    admin: { username: 'admin', roleCode: 'ADMIN', roleName: 'Admin', permissions: ['*'], isAdminFullAccess: true },
    manager: { username: 'quanly', roleCode: 'MANAGER', roleName: 'Quản lý', permissions: ['coordination.read', 'coordination.order.lock', 'catalog.read', 'purchase.read', 'purchase.generate', 'warehouse.read', 'demand.generate', 'purchase.request.approve'], isAdminFullAccess: false },
    coordinator: { username: 'dieuphoi', roleCode: 'COORDINATOR', roleName: 'Điều phối', permissions: ['coordination.read', 'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff', 'demand.generate'], isAdminFullAccess: false },
    procurement: { username: 'muahang', roleCode: 'PROCUREMENT', roleName: 'Thu mua', permissions: ['purchase.read', 'purchase.generate'], isAdminFullAccess: false },
    warehouse: { username: 'thukho', roleCode: 'WAREHOUSE', roleName: 'Thủ kho', permissions: ['warehouse.read', 'warehouse.manage'], isAdminFullAccess: false },
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

const coordinationStatuses = (scenarioId: string) => {
  if (scenarioId === 'mixed-confirmed-completed') return ['CONFIRMED', 'COMPLETED']
  if (scenarioId === 'empty') return []
  return [scenarioId === 'loading-draft' ? 'DRAFT' : scenarioId.toUpperCase()]
}

const coordinationOrders = (scenarioId: string) => coordinationStatuses(scenarioId).map((status, index) => ({
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

const demandRequestStatus = (runtime: PcFixtureRuntime) => (
  effectiveWeeklyScenario(runtime)?.demandRequestStatus
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
      supplierReadyLineCount: 0,
      blockingExceptionCount: scenarioId === 'exception' ? 1 : 0,
      purchaseRequestStatus: scenarioId === 'submitted' ? 'SUBMITTED' : scenarioId === 'approved-order' ? 'APPROVED' : 'DRAFT',
      orderCount: scenarioId === 'approved-order' ? 0 : 1,
      receivingLineCount: scenarioId === 'receiving' ? 1 : 0,
      fullyReceivedLineCount: 0,
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
  if (path.startsWith('/api/approval-history/')) return { matched: true, data: [] }
  if (path === '/api/coordination/orders') return { matched: true, data: family === 'CoordinationOrderScopeLifecycle' ? coordinationOrders(scenarioId) : [] }
  if (path === '/api/coordination/meal-quantity-plans') {
    if (family === 'CoordinationOrderScopeLifecycle') {
      return { matched: true, data: coordinationStatuses(scenarioId).map((status, index) => ({ quantityPlanId: `pc-plan-${index}`, planCode: `PC-${index}`, serviceDate: '2026-07-27', dayOfWeek: 't2', status, lines: [] })) }
    }
    return { matched: true, data: weeklyScenario?.quantityPlans ?? [] }
  }
  if (path === '/api/coordination/menu-schedules') return { matched: true, data: weeklyScenario?.schedules ?? [] }
  if (path === '/api/coordination/customers') return { matched: true, data: [{ customerId: 'customer-pc', customerCode: 'PC', customerName: 'Khách hàng PC' }] }
  if (path === '/api/coordination/customer-contracts') return { matched: true, data: [{ contractId: 'contract-pc', customerId: 'customer-pc', customerCode: 'PC', customerName: 'Khách hàng PC', isActive: true, contractStatus: 'ACTIVE', menuScheduleCount: weeklyScenario?.schedules.length ?? 0, activeWeekDays: ['MONDAY'], shiftNames: ['MORNING'], defaultMenuPrice: 25000, defaultBomRatePercent: 100 }] }
  if (path === '/api/coordination/weekly-menu/import-history') return { matched: true, data: [] }
  if (path === '/api/coordination/weekly-menu') return { matched: true, data: null }
  if (path === '/api/purchase-workflow/workbench') return { matched: true, data: purchasingWorkbench(scenarioId) }
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrap({ fixtureMutation: true })) })
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
  await page.route(/^https?:\/\/[^/]+\/api\//, (route) => handlePcApiRoute(route, runtime))
}

export const assertPcFirewallClosed = (records: readonly PcFirewallRecord[]) => {
  const escaped = records.filter((record) => !record.intercepted || !record.path.startsWith('/api/'))
  if (escaped.length > 0) throw new Error(`PC request escaped interception: ${escaped.map((record) => `${record.method} ${record.path}`).join(', ')}`)
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
