import { describe, expect, it } from 'vitest'
import { presentAudit } from '@/lib/auditPresentation'
import { getMrxLifecyclePresentation } from '@/lib/workflowConfig'
import {
  MRX_QUANTITY_TAB_LABEL,
  getReconciliationLifecyclePresentation,
  getReconciliationResultPresentation,
} from '@/lib/reconciliationLifecyclePresentation'

describe('MRX reconciliation lifecycle presentation contract', () => {
  it('uses the approved MRX quantity tab label', () => {
    expect(MRX_QUANTITY_TAB_LABEL).toBe('Định lượng xuất kho')
    expect(MRX_QUANTITY_TAB_LABEL).not.toBe('Tổng hợp mua')
  })

  it.each([
    ['DRAFT', 'Đang chuẩn bị', 1, 'Xác nhận và khóa', '/weekly-menu?view=demand'],
    ['READY', 'Đã khóa', 2, 'Chuyển sang Kho', '/weekly-menu?view=demand'],
    ['TRANSFERRED', 'Chờ Kho xuất', 3, 'Mở danh sách cần xuất', '/warehouse?view=demand'],
    ['IN_PROGRESS', 'Đang đối chiếu', 4, 'Mở đối chiếu', '/reconciliation'],
    ['COMPLETED', 'Hoàn tất', 5, 'Mở kết quả', '/reconciliation'],
  ] as const)('maps %s to one status, phase and next route', (status, label, phase, actionLabel, route) => {
    expect(getReconciliationLifecyclePresentation(status)).toMatchObject({
      label,
      phase,
      phaseCount: 5,
      action: { label: actionLabel, route },
    })
  })

  it.each(['DRAFT', 'READY', 'TRANSFERRED', 'IN_PROGRESS', 'COMPLETED'] as const)('uses the same visible %s label in lifecycle and Audit surfaces', (status) => {
    const label = getMrxLifecyclePresentation(status).label
    expect(getReconciliationLifecyclePresentation(status).label).toBe(label)
    expect(presentAudit({ businessArea: 'Reconciliation', entityName: 'ReconciliationBatch', fieldName: 'Status', newValue: status }).after).toBe(label)
  })

  it('keeps the all-lot comparison identity stable when an issue drawer is selected', () => {
    expect(getReconciliationResultPresentation({ total: 2, actionable: 0, issueId: 'issue-1', showAll: false })).toEqual({
      title: 'Đối chiếu theo nguyên liệu',
      description: '2/2 nguyên liệu đã khớp',
      state: 'all-matched',
      showTable: false,
      showAllLabel: 'Xem toàn bộ',
      detailSurface: 'drawer',
    })
  })
})
