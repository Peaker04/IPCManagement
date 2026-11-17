import { afterEach, expect, it, vi } from 'vitest';
import { mrxApi } from '../api/mrxApi';
import { approvalsApi } from '../api/approvalsApi';
import { apiClient } from '../api/client';
import { serverStateCache } from '../store/serverStateCache';
import type { components } from '../shared/api/contracts/schema';

vi.mock('../api/client', () => ({ apiClient: vi.fn() }));
const id = '20000000-0000-0000-0000-000000000001';
const commandId = '30000000-0000-0000-0000-000000000001';
const draft: components['schemas']['ReconciliationSupplementalDemandWriteRequest'] = {
  commandId, expectedVersion: 0, expectedBatchVersion: 2, batchId: id, serviceDate: '2026-11-30', reason: 'Khách tăng suất',
  dishes: [{ dishId: id, shiftName: 'MORNING', menuVariant: 'savory', extraServings: 10 }],
};
const result: components['schemas']['ReconciliationSupplementalDemandDto'] = {
  demandId: commandId, batchId: id, serviceDate: '2026-11-30', status: 'DRAFT', version: 1, batchVersion: 2,
  reason: draft.reason, snapshotFingerprint: 'FROZEN', createdBy: id, createdAt: '2026-11-16T07:00:00Z',
  dishes: [{ demandDishId: id, dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory', extraServings: 10 }],
  materials: [{ demandMaterialId: id, dailyLineId: id, ingredientId: id, canonicalUnitId: id, requiredQuantity: 2 }],
};
afterEach(() => { vi.clearAllMocks(); serverStateCache.clearAll(); });

it.each(['DEFAULT', 'MATERIAL_RECONCILIATION'])('invalidates warehouse evidence only after an acknowledged %s decision', async mode => {
  serverStateCache.set('mrx_supplemental_demand:batch:date', result);
  const detail: components['schemas']['OperationalApprovalDetail'] = {
    mode, modeVersion: 1, fingerprint: 'FROZEN', allowedActions: ['APPROVE'], blockedReasons: [], materialImpact: [], sourceDishNames: {},
    item: { serviceDates: [], inboxItemId: `mrx-supplemental-demand:${commandId}`, targetType: 'mrx-supplemental-demand', targetId: commandId,
      title: 'Nhu cầu suất phát sinh', status: 'PENDING', submittedAt: result.createdAt,
      targetCode: 'SD-1', itemType: 'mrx-supplemental-demand', source: 'AMANN', ownerRole: 'Quản lý', submittedBy: 'Thủ kho',
      reason: 'Khách tăng suất', nextAction: 'Duyệt', tone: 'warning', route: '/approvals', materials: [] },
  };
  vi.mocked(apiClient).mockRejectedValueOnce(new Error('Mất phản hồi'));
  await expect(approvalsApi.decideOperational(detail, 'APPROVE', 'Đủ nhu cầu', commandId)).rejects.toThrow('Mất phản hồi');
  expect(serverStateCache.get('mrx_supplemental_demand:batch:date')?.data).toEqual(result);
  vi.mocked(apiClient).mockResolvedValueOnce({});
  await approvalsApi.decideOperational(detail, 'APPROVE', 'Đủ nhu cầu', commandId);
  expect(serverStateCache.get('mrx_supplemental_demand:batch:date') === null).toBe(mode === 'MATERIAL_RECONCILIATION');
});

it('forwards reviewed proposal command identity and invalidates only MRX queue and workbench caches after acknowledgment', async () => {
  const mrxQueue = 'snapshot:operational-approvals:MATERIAL_RECONCILIATION:actor:filters';
  const defaultQueue = 'snapshot:operational-approvals:DEFAULT:actor:filters';
  serverStateCache.set(mrxQueue, { items: [] }); serverStateCache.set(defaultQueue, { items: [] });
  serverStateCache.set('mrx_supplemental_demand:batch:date', result);
  vi.mocked(apiClient).mockResolvedValue(result);
  expect(await mrxApi.createSupplementalDemand(draft)).toEqual(result);
  expect(apiClient).toHaveBeenCalledWith('/reconciliation/supplemental-demands', { method: 'POST', body: JSON.stringify(draft) });
  expect(serverStateCache.get(mrxQueue)).toBeNull();
  expect(serverStateCache.get('mrx_supplemental_demand:batch:date')).toBeNull();
  expect(serverStateCache.get(defaultQueue)?.data).toEqual({ items: [] });
});

it('retains the same submit command and propagates unknown outcomes without fabricating success or clearing cached evidence', async () => {
  serverStateCache.set('mrx_supplemental_demand:batch:date', result);
  const failure = new Error('Mất phản hồi'); vi.mocked(apiClient).mockRejectedValue(failure);
  const command = { commandId, expectedVersion: 1, expectedBatchVersion: 2, reason: 'Gửi duyệt' };
  await expect(mrxApi.submitSupplementalDemand(commandId, command)).rejects.toBe(failure);
  expect(apiClient).toHaveBeenCalledWith(`/reconciliation/supplemental-demands/${commandId}/submit`, { method: 'POST', body: JSON.stringify(command) });
  expect(serverStateCache.get('mrx_supplemental_demand:batch:date')?.data).toEqual(result);
});

it('uses authoritative paged demand and purpose fulfillment read contracts for the selected batch and day', async () => {
  const page: components['schemas']['ReconciliationSupplementalDemandSummaryDtoPagedResponseDto'] = {
    items: [], totalCount: 0, pageNumber: 2, pageSize: 10, totalPages: 0, hasPrev: true, hasNext: false,
  };
  vi.mocked(apiClient).mockResolvedValueOnce(page);
  expect(await mrxApi.getSupplementalDemandPage({ batchId: id, serviceDate: '2026-11-30', status: 'PENDING', pageNumber: 2, pageSize: 10 })).toEqual(page);
  const params = new URL(String(vi.mocked(apiClient).mock.calls[0][0]), 'http://fixture').searchParams;
  expect(params.get('BatchId')).toBe(id); expect(params.get('ServiceDate')).toBe('2026-11-30');
  expect(params.get('Status')).toBe('PENDING'); expect(params.get('PageNumber')).toBe('2');
  const balance: components['schemas']['ReconciliationSupplementalFulfillmentDto'] = { batchId: id, serviceDate: '2026-11-30', pendingDemandCount: 1, lines: [] };
  vi.mocked(apiClient).mockResolvedValueOnce(balance);
  expect(await mrxApi.getSupplementalFulfillment(id, '2026-11-30')).toEqual(balance);
  expect(apiClient).toHaveBeenLastCalledWith(`/reconciliation/supplemental-demands/batches/${id}/fulfillment?serviceDate=2026-11-30`);
});

it('loads frozen dish choices with explicit scope and never constructs choices from current dish names', async () => {
  const choices: components['schemas']['ReconciliationSupplementalDishOptionsDto'] = {
    batchId: id, batchVersion: 2, serviceDate: '2026-11-30', canCreate: true, requiresApproval: true, dishes: [
      { dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory' },
    ],
  };
  vi.mocked(apiClient).mockResolvedValueOnce(choices);
  expect(await mrxApi.getSupplementalDishOptions(id, '2026-11-30')).toEqual(choices);
  expect(apiClient).toHaveBeenCalledWith(`/reconciliation/supplemental-demands/batches/${id}/dish-options?serviceDate=2026-11-30`);
});
