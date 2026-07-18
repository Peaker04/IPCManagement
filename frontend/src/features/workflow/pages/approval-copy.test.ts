import { describe, expect, it } from 'vitest';
import { formatApprovalDecision } from './approvalCopy';

describe('ApprovalPage history copy', () => {
  it('translates approval decisions and statuses for users', () => {
    expect(formatApprovalDecision('APPROVE')).toBe('Đã duyệt');
    expect(formatApprovalDecision('REJECT')).toBe('Từ chối');
    expect(formatApprovalDecision('SUBMIT')).toBe('Đã gửi duyệt');
    expect(formatApprovalDecision('APPROVED')).not.toBe('APPROVED');
  });
});
