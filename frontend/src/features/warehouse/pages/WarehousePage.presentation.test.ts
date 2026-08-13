import { describe, expect, it } from 'vitest';
import { formatIssueCandidateLabel } from '../warehouseIssueAllocation';

describe('WarehousePage presentation', () => {
  it('describes an issue candidate in user language before its document code', () => {
    expect(
      formatIssueCandidateLabel({
        requestDate: '2026-08-10',
        actionableLineCount: 48,
        customerName: 'An Vui',
        customerCode: 'ANV',
      }),
    ).toBe('An Vui (ANV) · Ngày 10/08/2026 · 48 nhóm nguyên liệu');
  });
});
