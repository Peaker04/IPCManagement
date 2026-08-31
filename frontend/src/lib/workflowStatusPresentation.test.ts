import { describe, expect, it } from 'vitest'
import { formatMenuVersionStatus, formatReceiptLifecycleStatus, formatShiftName, formatWorkflowStatus, getWorkflowStatusPresentation, toneFromStatus } from '@/lib/workflowConfig'

describe('workflow status presentation', () => {
  it.each([
    ['DRAFT', 'Bản nháp', 'neutral'],
    ['APPROVED', 'Đã duyệt', 'neutral'],
    ['PARTIALLY_RECEIVED', 'Nhận một phần', 'warning'],
    ['REJECTED', 'Bị từ chối', 'danger'],
    ['CANCELLED', 'Đã hủy', 'danger'],
    ['ROLLED_BACK', 'Đang mở', 'warning'],
    ['ERROR', 'Bị chặn', 'danger'],
    ['PUBLISHED', 'Hoàn tất', 'neutral'],
    ['READY', 'Sẵn sàng', 'neutral'],
    ['TRANSFERRED', 'Hoàn tất', 'neutral'],
    ['IN_PROGRESS', 'Đang mở', 'warning'],
  ] as const)('maps %s explicitly', (status, label, tone) => {
    expect(getWorkflowStatusPresentation(status)).toEqual({ label, tone })
  })

  it('uses text fallback only for legacy display copy', () => {
    expect(toneFromStatus('Đã hủy')).toBe('danger')
    expect(toneFromStatus('Chưa đồng bộ dữ liệu')).toBe('neutral')
    expect(toneFromStatus('Trạng thái riêng')).toBe('neutral')
  })
})

describe('receipt lifecycle presentation', () => {
  it('translates coupled receipt enums into one user-facing state', () => {
    expect(formatReceiptLifecycleStatus('DRAFT', 'PENDING_INSPECTION')).toBe('Chờ kiểm tra chất lượng')
    expect(formatReceiptLifecycleStatus('PENDING_APPROVAL', 'ACCEPTED')).toBe('Chờ Quản lý duyệt')
    expect(formatWorkflowStatus('PENDING_APPROVAL')).toBe('Chờ duyệt')
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
