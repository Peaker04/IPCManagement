import type { ReconciliationBatch, ReconciliationIssueHistoryItem } from '@/api/reconciliationApi'

export const issueStatusLabel = (issue: Pick<ReconciliationIssueHistoryItem, 'receivedAt'>) =>
  issue.receivedAt ? 'Bếp đã nhận' : 'Đã tạo phiếu'

export const issueRoleLabel = () => 'Vai trò chưa được lưu'

export const issueActorLabel = (issue: Pick<ReconciliationIssueHistoryItem, 'issuedByName'>) =>
  issue.issuedByName?.trim() || 'Tài khoản hệ thống'

export const dispositionCategoryLabel = (category?: string | null) => {
  if (!category) return 'Chưa có kết luận xử lý'
  const labels: Record<string, string> = {
    ACCEPTED_VARIANCE: 'Chấp nhận chênh lệch',
    CORRECTION_REQUIRED: 'Cần điều chỉnh số liệu',
    FOLLOW_UP_REQUIRED: 'Cần theo dõi thêm',
  }
  return labels[category] ?? 'Nhóm xử lý chưa có nhãn hiển thị'
}

export interface IssueRelatedNotes {
  notes: string[]
  exactIssueAttributionAvailable: false
}

export const collectIssueRelatedNotes = (
  issue: { lines: readonly { reconciliationBatchLineId?: string | null }[] },
  batch?: ReconciliationBatch,
): IssueRelatedNotes => {
  if (!batch) return { notes: [], exactIssueAttributionAvailable: false }
  const batchLineIds = new Set(issue.lines.map((line) => line.reconciliationBatchLineId).filter(Boolean))
  const notes: string[] = []
  for (const line of batch.lines) {
    if (!batchLineIds.has(line.batchLineId)) continue
    for (const rawNote of line.issueNotes ?? []) {
      const note = rawNote.trim()
      if (note && !notes.includes(note)) notes.push(note)
    }
  }
  return { notes, exactIssueAttributionAvailable: false }
}

export const issueCorrelationIdentity = (issue: Pick<ReconciliationIssueHistoryItem, 'issueId' | 'reconciliationBatchId'>) => ({
  issueId: issue.issueId,
  batchId: issue.reconciliationBatchId ?? null,
})
