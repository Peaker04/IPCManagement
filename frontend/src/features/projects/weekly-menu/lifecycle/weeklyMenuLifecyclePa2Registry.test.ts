import { describe, expect, it } from 'vitest'
import type { MealQuantityPlanDto, MenuScheduleDto } from '@/types/coordination'
import { buildWeeklyMenuLifecycleModel, type WeeklyMenuLifecycleModel } from './weeklyMenuLifecycleModel'
import materialDemandSource from '../demand/MaterialDemandSection.tsx?raw'

const adminContractsSources = import.meta.glob('../../../../app/pages/admin-data/AdminContractsPanel.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>
const adminContractsSource = Object.values(adminContractsSources)[0] ?? ''

const UNKNOWN = 'KHÔNG-XÁC-ĐỊNH-ĐƯỢC'
const CORRESPONDENCE_VALUES = ['KHỚP', 'FE-CHẶT-HƠN', 'FE-LỎNG-HƠN', 'CHỈ-CÓ-Ở-BE', 'CHỈ-CÓ-Ở-FE'] as const

type Correspondence = typeof CORRESPONDENCE_VALUES[number]

export type WeeklyMenuLifecyclePa2RegistryRow = {
  object: 'WeeklyMenuLifecycle'
  state: string
  role: typeof UNKNOWN
  action: string
  operation: string
  source: string[]
  backendPermission: string
  frontendPermission: string
  correspondence: Correspondence
}

const schedule = (overrides: Partial<MenuScheduleDto> = {}): MenuScheduleDto => ({
  bomRatePercent: 100,
  customerCode: 'ANV',
  customerId: 'customer-1',
  customerName: 'ANV',
  dayOfWeek: 't2',
  dishes: [],
  menuCode: 'MENU-1',
  menuId: 'menu-1',
  menuName: 'Menu 1',
  menuPrice: 25000,
  menuScheduleId: 'schedule-1',
  menuVersionId: 'version-1',
  menuVersionNo: 1,
  menuVersionStatus: 'DRAFT',
  serviceDate: '2026-07-27',
  shift: 'Ca Sáng',
  shiftName: 'MORNING',
  status: 'DRAFT',
  weekStartDate: '2026-07-27',
  ...overrides,
})

const plan = (status: string): MealQuantityPlanDto => ({
  dayOfWeek: 't2',
  lines: [],
  planCode: 'PLAN-1',
  quantityPlanId: 'plan-1',
  serviceDate: '2026-07-27',
  status,
})

const activeSchedule = (overrides: Partial<MenuScheduleDto> = {}) => schedule({
  menuVersionStatus: 'ACTIVE',
  publishedAt: '2026-07-29T00:30:00Z',
  status: 'ACTIVE',
  ...overrides,
})

const lifecycle = (
  schedules: readonly MenuScheduleDto[],
  quantityPlans: readonly MealQuantityPlanDto[],
  demand: Parameters<typeof buildWeeklyMenuLifecycleModel>[2] = {
    lineCount: 0,
    shortageCount: 0,
    isLoading: false,
    isError: false,
  },
) => buildWeeklyMenuLifecycleModel(schedules, quantityPlans, demand)

const stateLabel = (model: WeeklyMenuLifecycleModel) => [
  model.status,
  model.phase,
  `demand=${model.demandState}`,
  `plans=${model.completedPlanCount}/${model.expectedPlanCount}`,
].join(' · ')

const row = (
  model: WeeklyMenuLifecycleModel,
  details: Omit<WeeklyMenuLifecyclePa2RegistryRow, 'object' | 'state' | 'role' | 'action'>,
): WeeklyMenuLifecyclePa2RegistryRow => ({
  object: 'WeeklyMenuLifecycle',
  state: stateLabel(model),
  role: UNKNOWN,
  action: model.nextAction,
  ...details,
})

const emptyModel = lifecycle([], [])
const draftModel = lifecycle([schedule(), schedule({ menuScheduleId: 'schedule-2' })], [])
const activeIncompleteModel = lifecycle(
  [activeSchedule(), activeSchedule({ menuScheduleId: 'schedule-2' })],
  [plan('COMPLETED')],
)
const activeNotGeneratedModel = lifecycle([activeSchedule()], [plan('COMPLETED')])
const activeLoadingModel = lifecycle([activeSchedule()], [plan('COMPLETED')], {
  lineCount: 0,
  shortageCount: 0,
  isLoading: true,
  isError: false,
})
const activeErrorModel = lifecycle([activeSchedule()], [plan('COMPLETED')], {
  lineCount: 0,
  shortageCount: 0,
  isLoading: false,
  isError: true,
})
const activeShortageModel = lifecycle([activeSchedule()], [plan('COMPLETED')], {
  lineCount: 161,
  shortageCount: 2,
  isLoading: false,
  isError: false,
})
const activeNoShortageModel = lifecycle([activeSchedule()], [plan('COMPLETED')], {
  lineCount: 161,
  shortageCount: 0,
  isLoading: false,
  isError: false,
})
const inconsistentModel = lifecycle([schedule(), schedule({ menuPrice: 30000 })], [])
const supersededModel = lifecycle([schedule({
  menuVersionStatus: 'SUPERSEDED',
  status: 'SUPERSEDED',
})], [])

export const weeklyMenuLifecyclePa2Registry: readonly WeeklyMenuLifecyclePa2RegistryRow[] = [
  row(emptyModel, {
    operation: 'POST /api/coordination/weekly-menu/import/commit',
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:45-59',
      'backend/src/IPCManagement.Api/Features/SampleData/Controllers/WeeklyMenuImportsController.cs:19,166',
    ],
    backendPermission: 'CoordinationAccess → CoordinationRoles',
    frontendPermission: 'coordination.read ở route; không có ActionGuard riêng cho import',
    correspondence: 'KHỚP',
  }),
  row(draftModel, {
    operation: 'PATCH /api/coordination/menu-schedules/{id}/version với status ACTIVE',
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:101-114',
      'frontend/src/app/pages/admin-data/AdminContractsPanel.tsx:240-304',
      'backend/src/IPCManagement.Api/Features/Coordination/Controllers/MenuSchedulesController.cs:13,51-68',
      'backend/src/IPCManagement.Api/Features/Coordination/Services/MenuScheduleService.cs:152-197',
    ],
    backendPermission: 'CoordinationAccess → CoordinationRoles',
    frontendPermission: 'Admin Data route yêu cầu wildcard; control Publish chỉ có trong Contract',
    correspondence: 'FE-CHẶT-HƠN',
  }),
  row(activeIncompleteModel, {
    operation: 'POST /api/coordination/meal-quantity-plans/quick-servings với complete=true',
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:105-116',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:231-239',
      'backend/src/IPCManagement.Api/Features/Coordination/Controllers/MealQuantityPlansController.cs:15,34',
      'backend/src/IPCManagement.Api/Features/Coordination/Services/MealQuantityPlanService.cs:149-156',
    ],
    backendPermission: 'CoordinationAccess → CoordinationRoles',
    frontendPermission: 'ActionGuard: quanly/dieuphoi + coordination.order.lock',
    correspondence: 'KHỚP',
  }),
  row(activeNotGeneratedModel, {
    operation: 'POST /api/material-demand/generate',
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:117-128',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:100-111',
      'backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15,31-60',
    ],
    backendPermission: 'DemandGenerateAccess → CoordinationRoles',
    frontendPermission: 'ActionGuard: quanly/dieuphoi + demand.generate',
    correspondence: 'KHỚP',
  }),
  row(activeLoadingModel, {
    operation: UNKNOWN,
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-44,117-120',
    ],
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    correspondence: 'CHỈ-CÓ-Ở-FE',
  }),
  row(activeErrorModel, {
    operation: UNKNOWN,
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-44,117-121',
    ],
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    correspondence: 'CHỈ-CÓ-Ở-FE',
  }),
  row(activeShortageModel, {
    operation: 'Điều hướng tới /purchasing theo ngày/tuần đang chọn',
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:121-124',
      'frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:31,97-99',
    ],
    backendPermission: UNKNOWN,
    frontendPermission: 'ActionGuard purchase.read + purchase.read ở route đích',
    correspondence: 'CHỈ-CÓ-Ở-FE',
  }),
  row(activeNoShortageModel, {
    operation: UNKNOWN,
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:123-125',
    ],
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    correspondence: 'CHỈ-CÓ-Ở-FE',
  }),
  row(inconsistentModel, {
    operation: UNKNOWN,
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:62-92',
    ],
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    correspondence: 'CHỈ-CÓ-Ở-FE',
  }),
  row(supersededModel, {
    operation: UNKNOWN,
    source: [
      'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:101-128',
      'backend/src/IPCManagement.Api/Features/Coordination/Services/MenuSchedulePolicy.cs:61-67',
    ],
    backendPermission: UNKNOWN,
    frontendPermission: UNKNOWN,
    correspondence: 'KHỚP',
  }),
]

describe('PA-2 WeeklyMenuLifecycle registry', () => {
  it('derives every state and action cell from the existing lifecycle model', () => {
    const expected = [
      emptyModel,
      draftModel,
      activeIncompleteModel,
      activeNotGeneratedModel,
      activeLoadingModel,
      activeErrorModel,
      activeShortageModel,
      activeNoShortageModel,
      inconsistentModel,
      supersededModel,
    ]

    expect(weeklyMenuLifecyclePa2Registry.map((item) => item.state)).toEqual(expected.map(stateLabel))
    expect(weeklyMenuLifecyclePa2Registry.map((item) => item.action)).toEqual(expected.map((item) => item.nextAction))
    expect(weeklyMenuLifecyclePa2Registry.every((item) => item.role === UNKNOWN)).toBe(true)
    expect(weeklyMenuLifecyclePa2Registry.every((item) => CORRESPONDENCE_VALUES.includes(item.correspondence))).toBe(true)
  })

  it('fails if the frontend action permission/status sources drift', () => {
    expect(adminContractsSource).toContain("handleUpdateScheduleVersion('ACTIVE')")
    expect(materialDemandSource).toContain("requiredPermissions={['demand.generate']}")
    expect(materialDemandSource).toContain("requiredPermissions={['coordination.order.lock']}")
    expect(materialDemandSource).toContain("requiredPermissions={['purchase.read']}")
  })

  it('proves production source does not import the audit registry', () => {
    const productionSources = import.meta.glob([
      '../../../../*.ts',
      '../../../../*.tsx',
      '../../../../**/*.ts',
      '../../../../**/*.tsx',
    ], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>

    const registryImports = Object.entries(productionSources)
      .filter(([file]) => !file.includes('.test.'))
      .filter(([, source]) => source.includes('weeklyMenuLifecyclePa2Registry'))

    expect(registryImports).toEqual([])
  })
})
