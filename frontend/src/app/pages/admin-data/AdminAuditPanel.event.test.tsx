import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { detailHook, batchHook } = vi.hoisted(() => ({
  batchHook: vi.fn(() => ({ data: { batchId: 'batch-mxe08', lines: [] }, currentData: { batchId: 'batch-mxe08', lines: [] }, isFetching: false, isError: false, refetch: vi.fn() })),
  detailHook: vi.fn(() => ({
  data: {
    issueId: 'issue-mxe08', issueCode: 'ISS-MXE08', reconciliationBatchId: 'batch-mxe08',
    issueDate: '2026-09-05', createdAt: '2026-09-05T09:00:00Z', issuedByName: 'Thủ kho', warehouseName: 'Kho chính',
    lines: [{ issueLineId: 'line-mxe08', reconciliationBatchLineId: 'batch-line-mxe08', ingredientId: 'ingredient-mxe08', ingredientName: 'Gạo', unitId: 'unit-mxe08', unitName: 'kg', requestedQty: 10, issuedQty: 10 }],
  },
  isLoading: false,
  isError: false,
  })),
}))
vi.mock('@/api/reconciliationApi', () => ({ useGetReconciliationIssueQuery: detailHook, useGetReconciliationBatchQuery: batchHook }))
vi.mock('@/app/hooks', () => ({ useAppSelector: () => ({ id: 'admin-mxe08' }) }))

import { AdminAuditPanel } from './AdminAuditPanel'
import type { ReconciliationAdminDataPageModel } from './useReconciliationAdminDataPageModel'

const readyView = { phase: 'ready', data: { items: [], hasNext: false }, isRefreshing: false, truncation: null } as const
const model = {
  isReconciliationMode: true,
  auditSourceFamily: 'MATERIAL_RECONCILIATION', setAuditSourceFamily: vi.fn(),
  effectiveActiveView: 'audit', auditActor: '', auditArea: '', auditCursors: [], auditEntity: '', auditField: '',
  auditResult: { data: { hasNext: false, nextCursorOffset: 0 } }, exportError: undefined, isExportingAudit: false, handleExportAuditCsv: vi.fn(),
  displayLogs: [{
    id: 'issue-mxe08', timestamp: '2026-09-05T09:00:00Z', actor: 'Thủ kho', businessArea: 'Issue', entityName: 'InventoryIssue', fieldName: 'FULLDAY', fieldAffected: 'InventoryIssue / FULLDAY', oldValue: 'batch-mxe08', newValue: 'ISS-MXE08', reason: 'Ngày xuất 2026-09-05',
    sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: 'batch-mxe08', eventId: 'issue-mxe08', eventType: 'InventoryIssue', eventRole: 'UNKNOWN', eventCode: 'ISS-MXE08', eventLineCount: 84, eventStatus: 'CREATED',
  }],
  queryViews: { audit: readyView }, setAuditActor: vi.fn(), setAuditArea: vi.fn(), setAuditCursors: vi.fn(), setAuditEntity: vi.fn(), setAuditField: vi.fn(),
} as unknown as ReconciliationAdminDataPageModel

describe('MXE-08 reconciliation admin audit event surface', () => {
  it('restores event detail from the issue/batch deep link without a row click', async () => {
    render(<MemoryRouter initialEntries={['/admin-data?view=audit&auditIssueId=issue-mxe08&auditBatchId=batch-mxe08']}><AdminAuditPanel model={model} /></MemoryRouter>)

    expect(detailHook).toHaveBeenCalledWith('issue-mxe08', { skip: false })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chi tiết sự kiện xuất kho' })).toBeInTheDocument()
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xuất CSV chi tiết' })).toHaveAttribute('title', expect.stringContaining('không gộp theo sự kiện'))
  })

  it('defaults audit scope to MRX and lets Admin explicitly choose the whole system', async () => {
    render(<MemoryRouter><AdminAuditPanel model={model} /></MemoryRouter>)
    const scope = screen.getByRole('combobox', { name: 'Phạm vi nhật ký' })
    expect(scope).toHaveTextContent('Đối chiếu nguyên liệu')
    expect(scope).not.toHaveTextContent('MATERIAL_RECONCILIATION')
    fireEvent.click(scope)
    expect(screen.getByRole('option', { name: 'Đối chiếu nguyên liệu' })).toBeInTheDocument()
    const allOption = screen.getByRole('option', { name: 'Toàn hệ thống' })
    fireEvent.pointerDown(allOption)
    fireEvent.pointerUp(allOption)
    fireEvent.click(allOption)
    await waitFor(() => expect(model.setAuditSourceFamily).toHaveBeenCalledWith('ALL'))
  })

  it('shows the exact event count and truthful unknown-role label', () => {
    render(<MemoryRouter><AdminAuditPanel model={model} /></MemoryRouter>)
    expect(screen.getByText('ISS-MXE08 · 84 dòng')).toBeInTheDocument()
    expect(screen.getByText('Đã tạo phiếu · Vai trò chưa được lưu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem chi tiết sự kiện ISS-MXE08' })).toBeInTheDocument()
  })

  it('labels an unlinked issue row as line-level fallback instead of inventing an event', () => {
    const fallbackModel = { ...model, displayLogs: [{ ...model.displayLogs[0], id: 'legacy-line', eventId: undefined, eventCode: undefined, eventLineCount: undefined, eventRole: undefined, eventStatus: undefined, reconciliationBatchId: undefined, sourceFamily: 'LEGACY_UNCLASSIFIED' }] } as unknown as ReconciliationAdminDataPageModel
    render(<MemoryRouter><AdminAuditPanel model={fallbackModel} /></MemoryRouter>)
    expect(screen.getByText('Dòng chi tiết · Liên kết sự kiện chưa xác định')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xem chi tiết sự kiện/ })).not.toBeInTheDocument()
  })
})
