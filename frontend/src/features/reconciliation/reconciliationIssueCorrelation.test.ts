import { describe, expect, it } from 'vitest'
import { collectIssueRelatedNotes, dispositionCategoryLabel, issueActorLabel, issueCorrelationIdentity, issueRoleLabel, issueStatusLabel } from './reconciliationIssueCorrelation'

const linkedIssue = {
  issueId: 'issue-1',
  reconciliationBatchId: 'batch-1',
  issuedByName: 'Thủ kho',
  receivedAt: null,
  lines: [{ reconciliationBatchLineId: 'line-1' }, { reconciliationBatchLineId: 'line-2' }],
}

describe('MXE-09 reconciliation issue correlation presentation', () => {
  it('uses persisted issue and batch identity and never infers an issue role', () => {
    expect(issueCorrelationIdentity(linkedIssue)).toEqual({ issueId: 'issue-1', batchId: 'batch-1' })
    expect(issueActorLabel(linkedIssue)).toBe('Thủ kho')
    expect(issueStatusLabel(linkedIssue)).toBe('Đã tạo phiếu')
    expect(issueRoleLabel()).toBe('Vai trò chưa được lưu')
  })

  it('labels only known disposition tokens and keeps unknown values explicit', () => {
    expect(dispositionCategoryLabel('ACCEPTED_VARIANCE')).toBe('Chấp nhận chênh lệch')
    expect(dispositionCategoryLabel('NEW_UNPERSISTED_TOKEN')).toBe('Nhóm xử lý chưa có nhãn hiển thị')
    expect(dispositionCategoryLabel()).toBe('Chưa có kết luận xử lý')
  })

  it('collects notes only from exactly linked batch lines and declares issue attribution unavailable', () => {
    const result = collectIssueRelatedNotes(linkedIssue, {
      batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-05T09:00:00Z',
      lines: [
        { batchLineId: 'line-1', ingredientId: 'ingredient-1', canonicalUnitId: 'kg', requiredQuantity: 1, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1, issueNotes: ['Xuất thêm ca trưa'] },
        { batchLineId: 'line-other', ingredientId: 'ingredient-2', canonicalUnitId: 'kg', requiredQuantity: 2, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1, issueNotes: ['Không được lộ sang phiếu'] },
      ],
    })
    expect(result).toEqual({ notes: ['Xuất thêm ca trưa'], exactIssueAttributionAvailable: false })
  })
})
