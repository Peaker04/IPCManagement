import type { MealQuantityPlanDto, MealQuantityPlanLineDto, MenuScheduleDto } from '../src/types/coordination'
import {
  buildWeeklyMenuLifecycleModel,
  type WeeklyMenuLifecycleModel,
} from '../src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel'
import {
  getDemandActionPresentation,
  type DemandApprovalPresentation,
} from '../src/features/projects/weekly-menu/demand/demandModel'

export const PA2B_WEEK_START = '2026-07-27'
export const PA2B_WEEK_END = '2026-08-01'
export const PA2B_CUSTOMER_ID = 'customer-pa2b'
export const PA2B_CUSTOMER_CODE = 'PA2B'

export const PA2B_VIEWPORTS = [
  { id: '1920x1080', width: 1920, height: 1080 },
  { id: '1440x900', width: 1440, height: 900 },
  { id: '1366x768', width: 1366, height: 768 },
  { id: '1365x900', width: 1365, height: 900 },
  { id: '1280x900', width: 1280, height: 900 },
] as const

export const PA2B_ACTORS = {
  admin: {
    username: 'admin',
    role: 'admin',
    source: 'frontend/src/features/auth/pages/LoginPage.tsx:20-22',
  },
  manager: {
    username: 'quanly',
    role: 'quanly',
    source: 'frontend/src/features/auth/pages/LoginPage.tsx:20-23',
  },
  coordinator: {
    username: 'dieuphoi',
    role: 'dieuphoi',
    source: 'frontend/src/features/auth/pages/LoginPage.tsx:20-24',
  },
} as const

export type Pa2bActorId = keyof typeof PA2B_ACTORS
export type Pa2bDownstreamState = DemandApprovalPresentation['status'] | 'not-applicable'
export type Pa2bActionKind = 'mutation' | 'navigation' | 'presentation' | 'none'
export type Pa2bControlSurface = 'command-bar' | 'admin-contracts' | 'demand-panel'

export type Pa2bActorOracle = {
  backendAvailable: boolean | null
  frontendAvailable: boolean
}

export type WeeklyMenuLifecyclePa2bScenario = {
  object: 'WeeklyMenuLifecycle'
  scenarioId: string
  lifecycleState: Pick<
    WeeklyMenuLifecycleModel,
    'status' | 'phase' | 'demandState' | 'completedPlanCount' | 'expectedPlanCount'
  >
  downstreamState: Pa2bDownstreamState
  downstreamPrimaryAction: ReturnType<typeof getDemandActionPresentation>['primaryAction'] | null
  actionKind: Pa2bActionKind
  expectedAction: string
  expectedControl: {
    surface: Pa2bControlSurface
    role: 'button' | 'link'
    name: string
  } | null
  actors: readonly Pa2bActorId[]
  actorOracle: Readonly<Record<Pa2bActorId, Pa2bActorOracle>>
  source: readonly string[]
  schedules: readonly MenuScheduleDto[]
  quantityPlans: readonly MealQuantityPlanDto[]
  readiness: {
    state: 'ready' | 'loading' | 'error'
    totalCount: number
    shortageCount: number
  }
  demandRequestStatus?: string
}

const allActors = ['admin', 'manager', 'coordinator'] as const
const coordinatorOnly = ['coordinator'] as const

const allAvailable = (): Readonly<Record<Pa2bActorId, Pa2bActorOracle>> => ({
  admin: { backendAvailable: true, frontendAvailable: true },
  manager: { backendAvailable: true, frontendAvailable: true },
  coordinator: { backendAvailable: true, frontendAvailable: true },
})

const presentationOnly = (): Readonly<Record<Pa2bActorId, Pa2bActorOracle>> => ({
  admin: { backendAvailable: null, frontendAvailable: false },
  manager: { backendAvailable: null, frontendAvailable: false },
  coordinator: { backendAvailable: null, frontendAvailable: false },
})

const completionAvailability = (): Readonly<Record<Pa2bActorId, Pa2bActorOracle>> => ({
  admin: { backendAvailable: true, frontendAvailable: true },
  manager: { backendAvailable: true, frontendAvailable: true },
  coordinator: { backendAvailable: true, frontendAvailable: true },
})

const draftPublishAvailability = (): Readonly<Record<Pa2bActorId, Pa2bActorOracle>> => ({
  admin: { backendAvailable: true, frontendAvailable: true },
  manager: { backendAvailable: true, frontendAvailable: false },
  coordinator: { backendAvailable: true, frontendAvailable: false },
})

const purchasingAvailability = (): Readonly<Record<Pa2bActorId, Pa2bActorOracle>> => ({
  admin: { backendAvailable: true, frontendAvailable: true },
  manager: { backendAvailable: true, frontendAvailable: true },
  coordinator: { backendAvailable: false, frontendAvailable: false },
})

const noBusinessAction = (): Readonly<Record<Pa2bActorId, Pa2bActorOracle>> => ({
  admin: { backendAvailable: null, frontendAvailable: false },
  manager: { backendAvailable: null, frontendAvailable: false },
  coordinator: { backendAvailable: null, frontendAvailable: false },
})

const schedule = (overrides: Partial<MenuScheduleDto> = {}): MenuScheduleDto => ({
  bomRatePercent: 100,
  customerCode: PA2B_CUSTOMER_CODE,
  customerId: PA2B_CUSTOMER_ID,
  customerName: 'Khách hàng PA-2B',
  dayOfWeek: 't2',
  dishes: [],
  menuCode: 'MENU-PA2B-1',
  menuId: 'menu-pa2b-1',
  menuName: 'Menu PA-2B 1',
  menuPrice: 25000,
  menuScheduleId: 'schedule-pa2b-1',
  menuVersionId: 'version-pa2b-1',
  menuVersionNo: 1,
  menuVersionStatus: 'DRAFT',
  serviceDate: PA2B_WEEK_START,
  shift: 'Ca Sáng',
  shiftName: 'MORNING',
  status: 'DRAFT',
  weekStartDate: PA2B_WEEK_START,
  ...overrides,
})

const activeSchedule = (overrides: Partial<MenuScheduleDto> = {}) => schedule({
  menuVersionStatus: 'ACTIVE',
  publishedAt: '2026-07-29T00:30:00Z',
  publishedBy: 'pa2b-fixture',
  status: 'ACTIVE',
  ...overrides,
})

const planLine = (overrides: Partial<MealQuantityPlanLineDto> = {}): MealQuantityPlanLineDto => ({
  adjustedServings: 0,
  confirmedServings: 100,
  customerCode: PA2B_CUSTOMER_CODE,
  customerId: PA2B_CUSTOMER_ID,
  customerName: 'Khách hàng PA-2B',
  finalServings: 100,
  forecastServings: 100,
  menuCode: 'MENU-PA2B-1',
  menuId: 'menu-pa2b-1',
  menuName: 'Menu PA-2B 1',
  menuScheduleId: 'schedule-pa2b-1',
  quantityPlanLineId: 'plan-line-pa2b-1',
  shift: 'Ca Sáng',
  shiftName: 'MORNING',
  ...overrides,
})

const plan = (
  status: string,
  overrides: Partial<MealQuantityPlanDto> = {},
): MealQuantityPlanDto => ({
  dayOfWeek: 't2',
  lines: [planLine()],
  planCode: 'PLAN-PA2B-1',
  quantityPlanId: 'plan-pa2b-1',
  serviceDate: PA2B_WEEK_START,
  status,
  ...overrides,
})

const lifecycle = (
  schedules: readonly MenuScheduleDto[],
  quantityPlans: readonly MealQuantityPlanDto[],
  readiness: WeeklyMenuLifecyclePa2bScenario['readiness'],
) => buildWeeklyMenuLifecycleModel(schedules, quantityPlans, {
  lineCount: readiness.totalCount,
  shortageCount: readiness.shortageCount,
  isLoading: readiness.state === 'loading',
  isError: readiness.state === 'error',
})

const stateProjection = (model: WeeklyMenuLifecycleModel) => ({
  status: model.status,
  phase: model.phase,
  demandState: model.demandState,
  completedPlanCount: model.completedPlanCount,
  expectedPlanCount: model.expectedPlanCount,
})

type ScenarioInput = Omit<
  WeeklyMenuLifecyclePa2bScenario,
  'object' | 'lifecycleState' | 'expectedAction'
>

const scenario = (input: ScenarioInput): WeeklyMenuLifecyclePa2bScenario => {
  const model = lifecycle(input.schedules, input.quantityPlans, input.readiness)
  return {
    ...input,
    object: 'WeeklyMenuLifecycle',
    lifecycleState: stateProjection(model),
    expectedAction: model.nextAction,
  }
}

const draftSchedules = [schedule(), schedule({
  dayOfWeek: 't3',
  menuScheduleId: 'schedule-pa2b-2',
  serviceDate: '2026-07-28',
})]

const activeSchedules = [activeSchedule()]
const completedPlans = [plan('COMPLETED')]
const activeIncompleteSchedules = [
  activeSchedule(),
  activeSchedule({
    dayOfWeek: 't3',
    menuScheduleId: 'schedule-pa2b-2',
    serviceDate: '2026-07-28',
  }),
]
const activeIncompletePlans = [
  plan('DRAFT'),
  plan('COMPLETED', {
    dayOfWeek: 't3',
    lines: [planLine({
      menuScheduleId: 'schedule-pa2b-2',
      quantityPlanLineId: 'plan-line-pa2b-2',
    })],
    planCode: 'PLAN-PA2B-2',
    quantityPlanId: 'plan-pa2b-2',
    serviceDate: '2026-07-28',
  }),
]

const readyEmpty = { state: 'ready', totalCount: 0, shortageCount: 0 } as const
const readyShortage = { state: 'ready', totalCount: 161, shortageCount: 2 } as const
const readyNoShortage = { state: 'ready', totalCount: 161, shortageCount: 0 } as const

const notCreatedAction = getDemandActionPresentation('not-created').primaryAction
const approvedAction = getDemandActionPresentation('approved').primaryAction
const terminalAction = getDemandActionPresentation('terminal').primaryAction

export const weeklyMenuLifecyclePa2bRegistry: readonly WeeklyMenuLifecyclePa2bScenario[] = [
  scenario({
    scenarioId: 'empty',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'mutation',
    expectedControl: { surface: 'command-bar', role: 'button', name: 'Nhập Excel' },
    actors: allActors,
    actorOracle: allAvailable(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:46-59',
      'frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:42-49',
      'backend/src/IPCManagement.Api/Features/SampleData/Controllers/WeeklyMenuImportsController.cs:19,166',
      'backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs:42-47',
    ],
    schedules: [],
    quantityPlans: [],
    readiness: readyEmpty,
  }),
  scenario({
    scenarioId: 'draft',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'mutation',
    expectedControl: { surface: 'admin-contracts', role: 'button', name: 'Publish' },
    actors: allActors,
    actorOracle: draftPublishAvailability(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:94-116',
      'frontend/src/app/pages/admin-data/AdminContractsPanel.tsx:236-315',
      'backend/src/IPCManagement.Api/Features/Coordination/Controllers/MenuSchedulesController.cs:13,51-68',
      'backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs:42-47',
    ],
    schedules: draftSchedules,
    quantityPlans: [],
    readiness: readyEmpty,
  }),
  scenario({
    scenarioId: 'active-incomplete',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'mutation',
    expectedControl: { surface: 'demand-panel', role: 'button', name: 'Hoàn tất Ca Sáng' },
    actors: allActors,
    actorOracle: completionAvailability(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:113-116',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:245-258',
      'frontend/src/features/auth/pages/LoginPage.tsx:20-24',
      'backend/src/IPCManagement.Api/Features/Coordination/Controllers/MealQuantityPlansController.cs:15,34',
      'backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs:42-47',
    ],
    schedules: activeIncompleteSchedules,
    quantityPlans: activeIncompletePlans,
    readiness: readyEmpty,
  }),
  scenario({
    scenarioId: 'active-not-generated',
    downstreamState: 'not-created',
    downstreamPrimaryAction: notCreatedAction,
    actionKind: 'mutation',
    expectedControl: { surface: 'demand-panel', role: 'button', name: 'Tạo nhu cầu từ KHSX' },
    actors: allActors,
    actorOracle: allAvailable(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:117-127',
      'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:17-32',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:116-128',
      'backend/src/IPCManagement.Api/Program.cs:176-177',
    ],
    schedules: activeSchedules,
    quantityPlans: completedPlans,
    readiness: readyEmpty,
  }),
  scenario({
    scenarioId: 'active-loading',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'presentation',
    expectedControl: null,
    actors: coordinatorOnly,
    actorOracle: presentationOnly(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-45,117-120',
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:117-120',
    ],
    schedules: activeSchedules,
    quantityPlans: completedPlans,
    readiness: { state: 'loading', totalCount: 0, shortageCount: 0 },
  }),
  scenario({
    scenarioId: 'active-error',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'presentation',
    expectedControl: null,
    actors: coordinatorOnly,
    actorOracle: presentationOnly(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-45,117-121',
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:117-121',
    ],
    schedules: activeSchedules,
    quantityPlans: completedPlans,
    readiness: { state: 'error', totalCount: 0, shortageCount: 0 },
  }),
  scenario({
    scenarioId: 'active-shortage-approved',
    downstreamState: 'approved',
    downstreamPrimaryAction: approvedAction,
    actionKind: 'navigation',
    expectedControl: { surface: 'demand-panel', role: 'link', name: 'Mở thu mua' },
    actors: allActors,
    actorOracle: purchasingAvailability(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:121-124',
      'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:17-32,53-60',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:33,108-117',
      'frontend/src/routes/AppRouter.tsx:60',
      'backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs:150-187',
    ],
    schedules: activeSchedules,
    quantityPlans: completedPlans,
    readiness: readyShortage,
    demandRequestStatus: 'APPROVED',
  }),
  scenario({
    scenarioId: 'active-shortage-terminal',
    downstreamState: 'terminal',
    downstreamPrimaryAction: terminalAction,
    actionKind: terminalAction,
    expectedControl: null,
    actors: allActors,
    actorOracle: noBusinessAction(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:121-124',
      'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:17-32,53-60',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:107-128',
    ],
    schedules: activeSchedules,
    quantityPlans: completedPlans,
    readiness: readyShortage,
    demandRequestStatus: 'SENTTOWAREHOUSE',
  }),
  scenario({
    scenarioId: 'active-no-shortage',
    downstreamState: 'terminal',
    downstreamPrimaryAction: terminalAction,
    actionKind: 'none',
    expectedControl: null,
    actors: coordinatorOnly,
    actorOracle: noBusinessAction(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:123-124',
      'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:17-32,57-60',
    ],
    schedules: activeSchedules,
    quantityPlans: completedPlans,
    readiness: readyNoShortage,
    demandRequestStatus: 'EXPORTED',
  }),
  scenario({
    scenarioId: 'inconsistent',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'presentation',
    expectedControl: null,
    actors: coordinatorOnly,
    actorOracle: presentationOnly(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:62-92',
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:62-92',
    ],
    schedules: [schedule(), schedule({ menuPrice: 30000 })],
    quantityPlans: [],
    readiness: readyEmpty,
  }),
  scenario({
    scenarioId: 'superseded',
    downstreamState: 'not-applicable',
    downstreamPrimaryAction: null,
    actionKind: 'presentation',
    expectedControl: null,
    actors: coordinatorOnly,
    actorOracle: presentationOnly(),
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:94-130',
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:94-130',
      'backend/src/IPCManagement.Api/Features/Coordination/Services/MenuSchedulePolicy.cs:61-67',
    ],
    schedules: [schedule({ menuVersionStatus: 'SUPERSEDED', status: 'SUPERSEDED' })],
    quantityPlans: [],
    readiness: readyEmpty,
  }),
]

export const terminalDemandAction = terminalAction
