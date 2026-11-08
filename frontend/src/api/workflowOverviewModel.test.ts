import { describe, expect, it } from 'vitest';
import type { RoleInboxItem, WorkflowDocument } from '@/types/workflow';
import { buildWorkflowLanes } from './workflowOverviewModel';

const document = (id: string, tone: 'warning' | 'danger'): WorkflowDocument => ({
  id, type: 'Phiếu nhập', title: 'Cùng tên', status: 'Chờ xử lý', owner: 'Kho', summary: '', route: '/warehouse', lines: [], tone,
});

const inbox = (id: string, tone: 'warning' | 'danger'): RoleInboxItem => ({
  id, laneId: 'warehouse', owner: 'Kho', title: 'Cùng tên', description: '', due: '', nextAction: '', tone, route: '/warehouse',
});

describe('buildWorkflowLanes count semantics', () => {
  it('counts each warning record once instead of counting its source document twice', () => {
    const lanes = buildWorkflowLanes([document('doc-1', 'warning')], [inbox('doc-doc-1', 'warning')], []);
    expect(lanes.find((lane) => lane.id === 'warehouse')).toMatchObject({ waiting: 1, blocked: 0 });
  });

  it('keeps distinct records with the same display name and separates blocked from waiting', () => {
    const lanes = buildWorkflowLanes([], [inbox('one', 'danger'), inbox('two', 'warning')], []);
    expect(lanes.find((lane) => lane.id === 'warehouse')).toMatchObject({ waiting: 1, blocked: 1 });
  });
});
