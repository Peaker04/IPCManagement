import { describe, expect, it } from 'vitest'
import { buildWeeklyMenuReadiness, type WeeklyMenuReadinessInput } from './readiness'

const readyInput: WeeklyMenuReadinessInput = {
  hasSelectedCustomer: true,
  isSyncing: false,
  hasCatalogIssue: false,
  menuCount: 86,
  missingServingCount: 0,
  missingBomCount: 0,
  invalidBomTierCount: 0,
  demandMaterialCount: 50,
}

describe('buildWeeklyMenuReadiness', () => {
  it.each([
    [{ hasSelectedCustomer: false }, 'neutral', 'Chọn khách hàng để bắt đầu'],
    [{ isSyncing: true }, 'info', 'Đang đồng bộ dữ liệu tuần'],
    [{ hasCatalogIssue: true }, 'warning', 'Thiếu dữ liệu danh mục món'],
    [{ menuCount: 0, demandMaterialCount: 0 }, 'warning', 'Chưa có thực đơn tuần'],
    [{ missingServingCount: 2 }, 'warning', 'Cần bổ sung số lượng khách'],
    [{ missingBomCount: 3 }, 'danger', 'Chưa thể tính nhu cầu'],
    [{ invalidBomTierCount: 1 }, 'danger', 'Chưa thể tính nhu cầu'],
    [{ demandMaterialCount: 0 }, 'info', 'Sẵn sàng tính nhu cầu'],
    [{}, 'success', 'Dữ liệu tuần sẵn sàng'],
  ] as const)('maps %o to %s readiness', (overrides, tone, label) => {
    const result = buildWeeklyMenuReadiness({ ...readyInput, ...overrides })
    expect(result).toMatchObject({ tone, label })
  })

  it('keeps metrics neutral while exposing actionable checkpoint severity', () => {
    const result = buildWeeklyMenuReadiness({ ...readyInput, missingServingCount: 2, missingBomCount: 3, invalidBomTierCount: 1, demandMaterialCount: 0 })
    expect(result.checkpoints).toEqual([
      expect.objectContaining({ key: 'menu', value: '86 dòng món', state: 'complete' }),
      expect.objectContaining({ key: 'servings', value: '2 dòng thiếu suất', state: 'warning' }),
      expect.objectContaining({ key: 'bom', value: '3 món thiếu BOM · 1 lịch/ca sai đơn giá', state: 'danger' }),
      expect.objectContaining({ key: 'demand', value: 'Chưa tính', state: 'pending' }),
    ])
  })
})
