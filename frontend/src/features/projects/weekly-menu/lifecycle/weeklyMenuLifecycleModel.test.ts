import { describe, expect, it } from 'vitest'
import type { MealQuantityPlanDto, MenuScheduleDto } from '@/types/coordination'
import { buildWeeklyMenuLifecycleModel } from './weeklyMenuLifecycleModel'

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

describe('buildWeeklyMenuLifecycleModel', () => {
  it('requires an imported schedule before lifecycle can start', () => {
    expect(buildWeeklyMenuLifecycleModel([], [])).toMatchObject({
      phase: 'empty',
      canPublish: false,
      nextAction: 'Import và lưu thực đơn tuần',
    })
  })

  it('exposes one publish action for a consistent draft version', () => {
    expect(buildWeeklyMenuLifecycleModel([schedule(), schedule({ menuScheduleId: 'schedule-2' })], [])).toMatchObject({
      phase: 'draft',
      canPublish: true,
      publishScheduleId: 'schedule-1',
      scheduleCount: 2,
      nextAction: 'Phát hành thực đơn',
    })
  })

  it('moves to quantity completion after the version is active', () => {
    const result = buildWeeklyMenuLifecycleModel([
      schedule({ status: 'ACTIVE', menuVersionStatus: 'ACTIVE', publishedAt: '2026-07-29T00:30:00Z' }),
      schedule({ menuScheduleId: 'schedule-2', status: 'ACTIVE', menuVersionStatus: 'ACTIVE' }),
    ], [plan('COMPLETED')])

    expect(result).toMatchObject({
      phase: 'active',
      canPublish: false,
      completedPlanCount: 1,
      expectedPlanCount: 2,
      nextAction: 'Nhập và hoàn tất số suất theo ca',
    })
  })

  it('moves from completed servings to purchasing when daily demand already exists', () => {
    const result = buildWeeklyMenuLifecycleModel([
      schedule({ status: 'ACTIVE', menuVersionStatus: 'ACTIVE' }),
    ], [plan('COMPLETED')], {
      lineCount: 161,
      shortageCount: 2,
      isLoading: false,
      isError: false,
    })

    expect(result).toMatchObject({
      demandState: 'generated',
      demandLineCount: 161,
      shortageCount: 2,
      nextAction: 'Chuyển các dòng thiếu sang Thu mua',
    })
  })

  it.each([
    [{ lineCount: 0, shortageCount: 0, isLoading: true, isError: false }, 'loading', 'Đang đối chiếu nhu cầu vật tư'],
    [{ lineCount: 0, shortageCount: 0, isLoading: false, isError: true }, 'error', 'Tải lại nhu cầu vật tư'],
  ] as const)('does not claim demand is missing while aggregate state is %s', (demand, demandState, nextAction) => {
    const result = buildWeeklyMenuLifecycleModel([
      schedule({ status: 'ACTIVE', menuVersionStatus: 'ACTIVE' }),
    ], [plan('COMPLETED')], demand)

    expect(result).toMatchObject({ demandState, nextAction })
  })

  it.each([
    [[schedule(), schedule({ status: 'ACTIVE', menuVersionStatus: 'ACTIVE' })], 'trạng thái version không đồng nhất'],
    [[schedule(), schedule({ menuPrice: 30000 })], 'nhiều đơn giá'],
    [[schedule(), schedule({ menuVersionId: 'version-2' })], 'nhiều version'],
  ] as const)('blocks inconsistent weekly data %#', (schedules, message) => {
    expect(buildWeeklyMenuLifecycleModel(schedules, [])).toMatchObject({
      phase: 'blocked',
      canPublish: false,
      blockedReason: expect.stringContaining(message),
    })
  })
})
