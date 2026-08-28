import { describe, expect, it } from 'vitest';
import warehousePageSource from './WarehousePage.tsx?raw';
import { formatIssueCandidateLabel } from '../warehouseIssueAllocation';

describe('WarehousePage presentation', () => {
  it('describes an issue candidate in user language before its document code', () => {
    expect(
      formatIssueCandidateLabel({
        requestDate: '2026-08-10',
        actionableLineCount: 48,
        materialRequestCode: 'MR-20260810-ANV',
        customerName: 'An Vui',
        customerCode: 'ANV',
      }),
    ).toBe('An Vui (ANV) · Ngày 10/08/2026 · 48 nhóm nguyên liệu · Chứng từ MR-20260810-ANV');
  });

  it('lets long purchase-order identifiers size their column instead of overflowing fixed cells', () => {
    expect(warehousePageSource).toContain('ipc-data-table min-w-[1060px] !table-auto');
    expect(warehousePageSource).not.toContain('ipc-data-table min-w-[1060px] table-fixed');
  });
});
