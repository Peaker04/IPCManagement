import { describe, expect, it } from 'vitest'
import { formatMenuVersionStatus, formatReceiptLifecycleStatus, formatShiftName, getWorkflowStatusPresentation, toneFromStatus } from '@/lib/workflowConfig'

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

describe('receipt lifecycle presentation', () => {
  it('translates coupled receipt enums into one user-facing state', () => {
    expect(formatReceiptLifecycleStatus('DRAFT', 'PENDING_INSPECTION')).toBe('Chờ kiểm tra chất lượng')
    expect(formatReceiptLifecycleStatus('PENDING_APPROVAL', 'ACCEPTED')).toBe('Chờ Quản lý duyệt')
    expect(formatReceiptLifecycleStatus('APPROVED', 'ACCEPTED')).toBe('Sẵn sàng ghi sổ kho')
    expect(formatReceiptLifecycleStatus('POSTED', 'ACCEPTED')).toBe('Đã ghi sổ kho')
  })
})

describe('contract presentation', () => {
  it('keeps shifts and menu versions out of the user-facing interface as codes', () => {
    expect(formatShiftName('MORNING')).toBe('Ca sáng')
    expect(formatShiftName('AFTERNOON')).toBe('Ca chiều')
    expect(formatMenuVersionStatus('ACTIVE')).toBe('Đang áp dụng')
  })
})
