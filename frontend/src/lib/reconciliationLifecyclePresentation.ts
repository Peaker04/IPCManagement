export { getMrxLifecyclePresentation as getReconciliationLifecyclePresentation } from '@/lib/workflowConfig'

export const MRX_QUANTITY_TAB_LABEL = 'Định lượng xuất kho'

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
