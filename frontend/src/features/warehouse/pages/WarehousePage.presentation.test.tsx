import { describe, expect, it } from 'vitest'
import {
  formatIssueCandidateLabel,
  issueScopeLabel,
  issueShiftName,
} from '../warehouseIssueAllocation'

describe('WarehousePage presentation behavioral contract', () => {
  it('describes an issue candidate in user language before its document code', () => {
    expect(
      formatIssueCandidateLabel({
        requestDate: '2026-08-10',
        requestScope: 'MORNING',
        actionableLineCount: 48,
        materialRequestCode: 'MR-20260810-ANV',
        customerName: 'An Vui',
        customerCode: 'ANV',
      }),
    ).toBe('An Vui (ANV) · Ngày 10/08/2026 · Ca sáng · 48 nhóm nguyên liệu · Chứng từ MR-20260810-ANV')
  })

  it('handles candidate without customer code or name using safe default copy', () => {
    expect(
      formatIssueCandidateLabel({
        requestDate: '2026-08-10',
        requestScope: 'FULLDAY',
        actionableLineCount: 12,
        materialRequestCode: 'MR-20260810-DEF',
      }),
    ).toBe('Khách hàng chưa xác định · Ngày 10/08/2026 · Cả ngày · 12 nhóm nguyên liệu · Chứng từ MR-20260810-DEF')
  })

  it('maps issue scopes to human-readable Vietnamese labels', () => {
    expect(issueScopeLabel('FULLDAY')).toBe('Cả ngày')
    expect(issueScopeLabel('MORNING')).toBe('Ca sáng')
    expect(issueScopeLabel('AFTERNOON')).toBe('Ca chiều')
  })

  it('maps API shift name correctly distinguishing FULLDAY from single-shift scopes', () => {
    expect(issueShiftName('FULLDAY')).toBeNull()
    expect(issueShiftName('MORNING')).toBe('MORNING')
    expect(issueShiftName('AFTERNOON')).toBe('AFTERNOON')
  })
})
