import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ApprovalQueue } from '@/components/common/ApprovalQueue';
import type { ApprovalRecord } from '@/features/workflow';
import { formatApprovalDecision, getApprovalDecisionCopy } from './approvalCopy';

describe('ApprovalPage history copy', () => {
  it('translates approval decisions and statuses for users', () => {
    expect(formatApprovalDecision('APPROVE')).toBe('Đã duyệt');
    expect(formatApprovalDecision('REJECT')).toBe('Từ chối');
    expect(formatApprovalDecision('SUBMIT')).toBe('Đã gửi duyệt');
    expect(formatApprovalDecision('APPROVED')).not.toBe('APPROVED');
  });

  it.each([
    ['material-demand', 'Reject', 'Từ chối nhu cầu nguyên liệu?', 'Giữ nhu cầu', 'Từ chối nhu cầu'],
    ['purchase-price-exception', 'Reject', 'Từ chối ngoại lệ giá?', 'Giữ ngoại lệ giá', 'Từ chối ngoại lệ'],
    ['material-demand', 'Approve', 'Duyệt nhu cầu nguyên liệu?', 'Giữ nhu cầu', 'Duyệt nhu cầu'],
    ['purchase-price-exception', 'Approve', 'Duyệt ngoại lệ giá?', 'Giữ ngoại lệ giá', 'Duyệt ngoại lệ'],
  ] as const)('uses contextual, safe confirmation copy for %s %s', (targetType, decision, title, safeLabel, submitLabel) => {
    expect(getApprovalDecisionCopy(targetType, decision)).toMatchObject({ title, safeLabel, submitLabel });
  });

  it('renders complete material-demand evidence with a visible Vietnamese target type', () => {
    const record: ApprovalRecord = {
      id: 'material-demand-42',
      targetType: 'material-demand',
      targetId: '42',
      targetCode: 'MR-20260722-FULLDAY',
      type: 'purchase',
      title: 'Duyệt nhu cầu nguyên liệu',
      source: 'MR-20260722-FULLDAY',
      sourceDocumentCode: 'KHSX-20260722-FULLDAY',
      owner: 'Quản lý',
      submittedBy: 'Điều phối A',
      deadline: '22/07/2026',
      status: 'PENDING',
      reason: 'Chờ quản lý duyệt.',
      nextAction: 'Duyệt nhu cầu',
      tone: 'warning',
      weekStartDate: '2026-07-20',
      serviceDate: '2026-07-22',
      scope: 'FULLDAY',
      lineCount: 2,
      totalQuantity: 15,
      materials: [
        { name: 'Gạo', quantity: 10, unit: 'KG' },
        { name: 'Thịt heo', quantity: 5, unit: 'KG' },
      ],
    };

    render(createElement(ApprovalQueue, { records: [record], pageSize: 1 }));

    const row = screen.getByRole('article');
    expect(within(row).getByText('Nhu cầu nguyên liệu')).toBeInTheDocument();
    expect(within(row).getByText('Cả ngày (FULLDAY)')).toBeInTheDocument();
    expect(within(row).getByText('KHSX-20260722-FULLDAY')).toBeInTheDocument();
    expect(within(row).getByText('2 dòng thiếu')).toBeInTheDocument();
  });

  it('renders server-owned price evidence without recomputing the variance', () => {
    const record: ApprovalRecord = {
      id: 'price-exception-7',
      targetType: 'purchase-price-exception',
      targetId: '7',
      targetCode: 'PR-42-RICE-V3',
      type: 'price-alert',
      title: 'Duyệt ngoại lệ giá mua',
      source: 'PR-42',
      owner: 'Quản lý',
      submittedBy: 'Thu mua B',
      deadline: '22/07/2026',
      status: 'PENDING',
      reason: 'Nhà cung cấp thay đổi giá.',
      nextAction: 'Duyệt hoặc từ chối ngoại lệ giá',
      tone: 'danger',
      supplierName: 'Nhà cung cấp Minh Tâm',
      referencePrice: 100_000,
      proposedPrice: 118_000,
      variancePercent: 18,
      evidenceType: 'EffectiveQuotation',
      evidenceDate: '2026-07-21',
      proposalVersion: 3,
      materials: [{ name: 'Gạo', quantity: 25, unit: 'KG' }],
    };

    render(createElement(ApprovalQueue, { records: [record], pageSize: 1 }));

    const row = screen.getByRole('article');
    expect(within(row).getByText('Ngoại lệ giá')).toBeInTheDocument();
    expect(within(row).getByText('Nhà cung cấp Minh Tâm')).toBeInTheDocument();
    expect(within(row).getByText('+18%')).toBeInTheDocument();
    expect(within(row).getByText('Phiên bản 3')).toBeInTheDocument();
  });
});
