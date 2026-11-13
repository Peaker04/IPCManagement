import { beforeEach, describe, expect, it } from 'vitest';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

describe('MRX workspace session scope', () => {
  beforeEach(() => workspaceSessionStore.clearScope());

  it('keeps valid dates and never persists the local whole-week sentinel', () => {
    workspaceSessionStore.setScope({ customerId: 'A', batchId: 'batch-A', serviceDate: '2026-09-16' });
    workspaceSessionStore.setScope({ serviceDate: 'ALL', weekStartDate: undefined });
    expect(workspaceSessionStore.getScope()).toMatchObject({ batchId: 'batch-A', serviceDate: '2026-09-16', weekStartDate: '2026-09-14' });
    workspaceSessionStore.setScope({ serviceDate: '2026-02-30', weekStartDate: 'ALL' });
    expect(workspaceSessionStore.getScope()).toMatchObject({ serviceDate: '2026-09-16', weekStartDate: '2026-09-14' });
  });

  it('drops a stale batch on customer or week change but keeps it when customer metadata arrives', () => {
    workspaceSessionStore.setScope({ customerId: 'A', customerCode: 'A', batchId: 'batch-A', weekStartDate: '2026-09-14' });
    workspaceSessionStore.setScope({ customerId: 'B', customerCode: 'B' });
    expect(workspaceSessionStore.getScope()).toMatchObject({ customerId: 'B', batchId: '' });
    workspaceSessionStore.setScope({ batchId: 'batch-B', weekStartDate: '2026-09-21' });
    workspaceSessionStore.setScope({ customerId: 'B', customerCode: 'B hydrated' });
    expect(workspaceSessionStore.getScope().batchId).toBe('batch-B');
    workspaceSessionStore.setScope({ weekStartDate: '2026-09-28' });
    expect(workspaceSessionStore.getScope()).toMatchObject({ weekStartDate: '2026-09-28', batchId: '' });
  });
});
