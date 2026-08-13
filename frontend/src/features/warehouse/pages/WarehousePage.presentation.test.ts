import { describe, expect, it } from 'vitest';
import { formatIssueCandidateLabel } from './WarehousePage';

describe('WarehousePage presentation', () => {
  it('describes an issue candidate in user language before its document code', () => {
    expect(
      formatIssueCandidateLabel({
        requestDate: '2026-08-10',
        actionableLineCount: 48,
        materialRequestCode: 'MR-20260810-ANV',
      }),
    ).toBe('Ngày 10/08/2026 · 48 nhóm nguyên liệu (MR-20260810-ANV)');
  });
});
