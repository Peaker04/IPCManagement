import { beforeEach, expect, it } from 'vitest';
import { clearSessionState } from '../store/clearSessionState';
import { getDraftStorageKey } from '../hooks/useClientDraftPersistence';

const actor = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const proposal = getDraftStorageKey('mrx_supplemental_demand_MATERIAL_RECONCILIATION_1_batch_day', actor);
const otherProposal = getDraftStorageKey('mrx_supplemental_demand_MATERIAL_RECONCILIATION_1_batch_day', other);
const initial = getDraftStorageKey('mrx_initial_batch_day', actor);
const actualCommand = getDraftStorageKey('mrx_supplemental_command_MATERIAL_RECONCILIATION_batch_day', actor);
const approvalCommand = getDraftStorageKey('mrx_approval_command_MATERIAL_RECONCILIATION', actor);
const defaultDraft = getDraftStorageKey('default_issue', actor);
const pending = JSON.stringify({ rows: [], reason: 'Khách tăng suất', pending: { action: 'submit', id: 'request-id',
  body: { commandId: '20000000-0000-0000-0000-000000000001', expectedVersion: 1, expectedBatchVersion: 2, reason: 'Khách tăng suất' } } });
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('ipc_v3_token', 'fixture-only');
  localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: actor, username: 'warehouse', fullName: 'Thủ kho', roleCode: 'WAREHOUSE',
    roleName: 'WarehouseStaff', isActive: true, isAdminFullAccess: false, permissions: [] }));
  localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  localStorage.setItem(proposal, pending); localStorage.setItem(otherProposal, pending);
  localStorage.setItem(initial, 'initial-draft'); localStorage.setItem(defaultDraft, 'default-draft');
  localStorage.setItem(actualCommand, pending);
  localStorage.setItem(approvalCommand, pending);
});
it('retains only the expired MRX actor proposal and exact pending command, including follow-up anonymous expiry', () => {
  clearSessionState('expired');
  expect(localStorage.getItem(proposal)).toBe(pending);
  expect(localStorage.getItem(initial)).toBe('initial-draft');
  expect(localStorage.getItem(actualCommand)).toBe(pending);
  expect(localStorage.getItem(approvalCommand)).toBe(pending);
  expect(localStorage.getItem(otherProposal)).toBeNull();
  expect(localStorage.getItem(defaultDraft)).toBeNull();
  clearSessionState('expired');
  expect(localStorage.getItem(proposal)).toBe(pending);
});
it('clears proposals and pending commands on explicit logout', () => {
  clearSessionState('logout');
  expect(localStorage.getItem(proposal)).toBeNull();
  expect(localStorage.getItem(initial)).toBeNull();
  expect(localStorage.getItem(actualCommand)).toBeNull();
  expect(localStorage.getItem(approvalCommand)).toBeNull();
  expect(localStorage.getItem(otherProposal)).toBeNull();
});
