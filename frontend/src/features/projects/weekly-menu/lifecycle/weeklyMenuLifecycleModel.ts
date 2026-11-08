import type { MealQuantityPlanDto, MenuScheduleDto } from '@/types/coordination'

export type WeeklyMenuLifecyclePhase = 'empty' | 'draft' | 'active' | 'blocked'
export type WeeklyMenuLifecycleDemandState = 'loading' | 'error' | 'not-generated' | 'generated'

export type WeeklyMenuLifecycleDemand = {
  lineCount: number
  shortageCount: number
  isLoading: boolean
  isError: boolean
}

export type WeeklyMenuLifecycleModel = {
  phase: WeeklyMenuLifecyclePhase
  status: string
  scheduleCount: number
  completedPlanCount: number
  expectedPlanCount: number
  demandState: WeeklyMenuLifecycleDemandState
  demandLineCount: number
  shortageCount: number
  versionNo?: number | null
  publishedAt?: string | null
  publishedBy?: string | null
  sourceImportBatch?: string | null
  canPublish: boolean
  publishScheduleId?: string
  nextAction: string
  blockedReason?: string
}

const normalize = (value?: string | null) => value?.trim().toUpperCase() || 'DRAFT'

export const buildWeeklyMenuLifecycleModel = (
  schedules: readonly MenuScheduleDto[],
  quantityPlans: readonly MealQuantityPlanDto[],
  demand: WeeklyMenuLifecycleDemand = { lineCount: 0, shortageCount: 0, isLoading: false, isError: false },
): WeeklyMenuLifecycleModel => {
  const demandState: WeeklyMenuLifecycleDemandState = demand.isLoading
    ? 'loading'
    : demand.isError
      ? 'error'
      : demand.lineCount > 0
        ? 'generated'
        : 'not-generated'
  if (schedules.length === 0) {
    return {
      phase: 'empty',
      status: 'EMPTY',
      scheduleCount: 0,
      completedPlanCount: 0,
      expectedPlanCount: 0,
      demandState,
      demandLineCount: demand.lineCount,
      shortageCount: demand.shortageCount,
      canPublish: false,
      nextAction: 'Import và lưu thực đơn tuần',
      blockedReason: 'Chưa có lịch thực đơn cho khách hàng và tuần đã chọn.',
    }
  }

  const statuses = new Set(schedules.map((schedule) => normalize(schedule.menuVersionStatus ?? schedule.status)))
  const prices = new Set(schedules.map((schedule) => schedule.menuPrice))
  const versionIds = new Set(schedules.map((schedule) => schedule.menuVersionId).filter(Boolean))
  const first = schedules[0]
  const completedPlanCount = quantityPlans.filter((plan) => ['CONFIRMED', 'COMPLETED'].includes(normalize(plan.status))).length
  const expectedPlanCount = schedules.length

  if (statuses.size !== 1 || prices.size !== 1 || versionIds.size > 1) {
    const reasons = [
      statuses.size !== 1 ? 'trạng thái version không đồng nhất' : '',
      prices.size !== 1 ? 'một khách hàng đang có nhiều đơn giá trong cùng tuần' : '',
      versionIds.size > 1 ? 'lịch tuần đang trỏ tới nhiều version' : '',
    ].filter(Boolean)
    return {
      phase: 'blocked',
      status: 'INCONSISTENT',
      scheduleCount: schedules.length,
      completedPlanCount,
      expectedPlanCount,
      demandState,
      demandLineCount: demand.lineCount,
      shortageCount: demand.shortageCount,
      versionNo: first.menuVersionNo,
      publishedAt: first.publishedAt,
      publishedBy: first.publishedBy,
      sourceImportBatch: first.sourceImportBatch,
      canPublish: false,
      nextAction: 'Kiểm tra lại dữ liệu lịch thực đơn',
      blockedReason: `Không thể tiếp tục vì ${reasons.join(', ')}.`,
    }
  }

  const status = [...statuses][0]
  const isActive = status === 'ACTIVE' || status === 'PUBLISHED'
  const isDraft = status === 'DRAFT'

  return {
    phase: isActive ? 'active' : isDraft ? 'draft' : 'blocked',
    status,
    scheduleCount: schedules.length,
    completedPlanCount,
    expectedPlanCount,
    demandState,
    demandLineCount: demand.lineCount,
    shortageCount: demand.shortageCount,
    versionNo: first.menuVersionNo,
    publishedAt: first.publishedAt,
    publishedBy: first.publishedBy,
    sourceImportBatch: first.sourceImportBatch,
    canPublish: isDraft,
    publishScheduleId: isDraft ? first.menuScheduleId : undefined,
    nextAction: isDraft
      ? 'Phát hành thực đơn'
      : isActive && completedPlanCount < expectedPlanCount
        ? 'Nhập và hoàn tất số suất theo ca'
        : isActive && demandState === 'loading'
          ? 'Đang đối chiếu nhu cầu vật tư'
          : isActive && demandState === 'error'
            ? 'Tải lại nhu cầu vật tư'
            : isActive && demandState === 'generated' && demand.shortageCount > 0
              ? 'Chuyển các dòng thiếu sang Thu mua'
              : isActive && demandState === 'generated'
                ? 'Theo dõi cấp phát kho và bếp'
                : isActive
                  ? 'Tạo nhu cầu vật tư'
          : 'Kiểm tra trạng thái version trên server',
    blockedReason: isDraft || isActive
      ? undefined
      : `Version đang ở trạng thái ${status}; server không cho phép phát hành lại từ trạng thái này.`,
  }
}
