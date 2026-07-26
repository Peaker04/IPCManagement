import { describe, expect, it } from 'vitest';
import type { ApprovalRecord, WorkflowLane } from './types';
import {
  resolveApprovalAvailability,
  resolveIssueCreationAvailability,
  resolveDemandLinePresentation,
  resolveWorkflowGateAction,
} from './actionEligibility';

const lane = (overrides: Partial<WorkflowLane> = {}): WorkflowLane => ({
  id: 'warehouse',
  label: 'Kho',
  owner: 'Thủ kho',
  stage: 'Xuất kho',
  status: 'Hoàn tất',
  waiting: 0,
  blocked: 0,
  done: 1,
  tone: 'success',
  route: '/warehouse',
  nextAction: 'Tạo phiếu xuất kho',
  ...overrides,
});

describe('project-wide action eligibility', () => {
  it('replaces a stale mutation label when a workflow gate is terminal', () => {
    expect(resolveWorkflowGateAction([lane()])).toBe('Đã hoàn tất');
  });

  it('keeps the server-derived next action while work remains', () => {
    expect(resolveWorkflowGateAction([lane({ waiting: 1, done: 0, tone: 'warning' })]))
      .toBe('Tạo phiếu xuất kho');
  });

  it('describes an empty approval inbox as completed rather than pending', () => {
    expect(resolveApprovalAvailability([], { isFetching: false, isError: false, isDeciding: false }))
      .toMatchObject({ statusLabel: 'Không có việc chờ', statusTone: 'success', firstActionableRecord: undefined });
  });

  it('enables approval only for an actionable inbox record', () => {
    const record = { id: 'approval-1', targetType: 'purchase-request', targetId: 'pr-1' } as ApprovalRecord;
    expect(resolveApprovalAvailability([record], { isFetching: false, isError: false, isDeciding: false }))
      .toMatchObject({ statusLabel: 'Chờ duyệt', disabledReason: null, firstActionableRecord: record });
  });

  it('blocks issue creation with a recovery reason when candidates are exhausted', () => {
    expect(resolveIssueCreationAvailability({ canManageWarehouse: true, isFetching: false, candidateCount: 0 }))
      .toEqual({
        canCreate: false,
        disabledReason: 'Không còn nhu cầu đủ điều kiện xuất kho. Chờ nhu cầu mới hoặc xem lại luân chuyển đã hoàn tất.',
      });
  });

  it('does not reopen shortages after a demand has been exported', () => {
    expect(resolveDemandLinePresentation({ status: 'EXPORTED', shortage: 120 }))
      .toEqual({ status: 'Đã xuất kho', nextAction: 'Đã hoàn tất', tone: 'success' });
  });
});
