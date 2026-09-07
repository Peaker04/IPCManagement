import type { ReconciliationBatch } from '@/api/reconciliationApi'

export type ReconciliationLifecycleStatus = ReconciliationBatch['status']

export const MRX_QUANTITY_TAB_LABEL = 'Định lượng xuất kho'

interface LifecyclePresentation {
  label: string
  phase: number
  phaseCount: 5
  owner: string
  action: { label: string; route: string }
}

const lifecyclePresentation: Record<ReconciliationLifecycleStatus, LifecyclePresentation> = {
  DRAFT: { label: 'Đang chuẩn bị', phase: 1, phaseCount: 5, owner: 'Điều phối', action: { label: 'Xác nhận và khóa', route: '/weekly-menu?view=demand' } },
  READY: { label: 'Đã khóa', phase: 2, phaseCount: 5, owner: 'Điều phối', action: { label: 'Chuyển sang Kho', route: '/weekly-menu?view=demand' } },
  TRANSFERRED: { label: 'Chờ Kho xuất', phase: 3, phaseCount: 5, owner: 'Kho nguyên liệu', action: { label: 'Mở danh sách cần xuất', route: '/warehouse?view=demand' } },
  IN_PROGRESS: { label: 'Đang đối chiếu', phase: 4, phaseCount: 5, owner: 'Đối chiếu nguyên liệu', action: { label: 'Mở đối chiếu', route: '/reconciliation' } },
  COMPLETED: { label: 'Hoàn tất', phase: 5, phaseCount: 5, owner: 'Đối chiếu nguyên liệu', action: { label: 'Mở kết quả', route: '/reconciliation' } },
}

export const getReconciliationLifecyclePresentation = (status: ReconciliationLifecycleStatus) => lifecyclePresentation[status]

export const getReconciliationResultPresentation = ({ total, actionable, issueId, showAll }: { total: number; actionable: number; issueId?: string | null; showAll: boolean }) => {
  const allMatched = total > 0 && actionable === 0
  return {
    title: 'Đối chiếu theo nguyên liệu',
    description: allMatched ? `${total}/${total} nguyên liệu đã khớp` : `${actionable} dòng cần xử lý · số liệu kho chỉ đọc`,
    state: allMatched && !showAll ? 'all-matched' as const : 'ledger' as const,
    showTable: !allMatched || showAll,
    showAllLabel: 'Xem toàn bộ',
    detailSurface: issueId ? 'drawer' as const : null,
  }
}
