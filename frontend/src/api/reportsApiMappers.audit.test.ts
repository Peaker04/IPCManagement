import { describe, expect, it } from 'vitest'
import { mapAuditChange } from './reportsApiMappers'
import { mapAuditChange as mapFeatureAuditChange } from '@/features/reports/reportsApiMappers'
import type { AuditChangeReportDto } from './workflowApiTypes'

const dto = (overrides: Partial<AuditChangeReportDto> = {}): AuditChangeReportDto => ({
  auditId: 'audit-mxe05',
  changedAt: '2026-09-05T08:00:00Z',
  changedBy: 'actor-mxe05',
  changedByName: 'Người kiểm thử',
  businessArea: 'KitchenReceipt',
  entityName: 'InventoryIssue',
  fieldName: 'KitchenReceived',
  oldValue: null,
  newValue: 'receivedAt=2026-09-05T08:00:00Z',
  reason: 'Bếp xác nhận đã nhận',
  ...overrides,
})

describe('MXE-05 audit report mapper', () => {
  it('preserves the full tuple as separate fields and retains the combined compatibility label', () => {
    expect(mapAuditChange(dto())).toMatchObject({
      businessArea: 'KitchenReceipt',
      entityName: 'InventoryIssue',
      fieldName: 'KitchenReceived',
      fieldAffected: 'InventoryIssue / KitchenReceived',
    })
  })

  it('preserves an empty field without inventing a tuple segment', () => {
    expect(mapAuditChange(dto({ entityName: 'MenuVersion', fieldName: null }))).toMatchObject({
      entityName: 'MenuVersion', fieldName: '', fieldAffected: 'MenuVersion',
    })
  })

  it.each([mapAuditChange, mapFeatureAuditChange])('preserves additive event metadata for reconciliation audit summaries', (mapper) => {
    expect(mapper(dto({
      sourceFamily: 'MATERIAL_RECONCILIATION',
      reconciliationBatchId: 'batch-mxe08',
      eventId: 'issue-mxe08',
      eventType: 'InventoryIssue',
      eventRole: 'UNKNOWN',
      eventCode: 'ISS-MXE08',
      eventLineCount: 84,
      eventStatus: 'CREATED',
    }))).toMatchObject({
      sourceFamily: 'MATERIAL_RECONCILIATION',
      reconciliationBatchId: 'batch-mxe08',
      eventId: 'issue-mxe08',
      eventType: 'InventoryIssue',
      eventRole: 'UNKNOWN',
      eventCode: 'ISS-MXE08',
      eventLineCount: 84,
      eventStatus: 'CREATED',
    })
  })

  it.each([mapAuditChange, mapFeatureAuditChange])('removes all values and reason from PasswordHash rows before they reach either report surface', (mapper) => {
    const canary = ['AUDIT_SECRET', 'CANARY_MAPPER_PASSWORD'].join('_')
    const row = mapper(dto({ businessArea: ' admin ', entityName: ' USER ', fieldName: ' passwordhash ', oldValue: canary, newValue: canary, reason: canary }))
    expect(row).toMatchObject({ oldValue: '', newValue: 'Đã đổi mật khẩu', reason: '' })
    expect(JSON.stringify(row)).not.toContain(canary)
  })

  it.each([mapAuditChange, mapFeatureAuditChange])('redacts nested secret material for unknown tuples in either report mapper', (mapper) => {
    const credential = ['fixture', 'credential', '1234567890abcdef'].join('-')
    const row = mapper(dto({ businessArea: 'Unknown', entityName: 'Unknown', fieldName: 'Unknown', oldValue: JSON.stringify({ accessToken: credential }), newValue: `passwordHash=${credential}`, reason: `Bearer ${credential}` }))
    expect(JSON.stringify(row)).not.toContain(credential)
    expect(row).toMatchObject({ oldValue: 'Thông tin nhạy cảm đã được ẩn', newValue: 'Thông tin nhạy cảm đã được ẩn', reason: 'Thông tin nhạy cảm đã được ẩn' })
  })
})
