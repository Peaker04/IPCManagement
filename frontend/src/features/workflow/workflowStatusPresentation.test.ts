import { describe, expect, it } from 'vitest'
import { getWorkflowStatusPresentation, toneFromStatus } from './workflowConfig'

describe('workflow status presentation', () => {
  it.each([
    ['DRAFT', 'Bản nháp', 'neutral'],
    ['APPROVED', 'Đã phê duyệt', 'success'],
    ['PARTIALLY_RECEIVED', 'Đã nhận một phần', 'warning'],
    ['REJECTED', 'Bị từ chối', 'danger'],
    ['CANCELLED', 'Đã hủy', 'danger'],
    ['ROLLED_BACK', 'Đã hoàn tác', 'warning'],
    ['ERROR', 'Có lỗi', 'danger'],
  ] as const)('maps %s explicitly', (status, label, tone) => {
    expect(getWorkflowStatusPresentation(status)).toEqual({ label, tone })
  })

  it('uses text fallback only for legacy display copy', () => {
    expect(toneFromStatus('Đã hủy')).toBe('danger')
    expect(toneFromStatus('Chờ dữ liệu backend')).toBe('warning')
    expect(toneFromStatus('Trạng thái riêng')).toBe('neutral')
  })
})
