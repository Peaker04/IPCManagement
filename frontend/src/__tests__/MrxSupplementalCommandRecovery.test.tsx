import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWarehouse } from '../test/renderWarehouse';
import { apiClient } from '../api/client';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';
import type { CreateMrxIssueRequest, MrxWarehouseDaily, MrxSupplementalFulfillment } from '../api/mrxApi';

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiClient: vi.fn() }));
const batch = '20000000-0000-0000-0000-000000000001';
const actor = '10000000-0000-0000-0000-000000000001';
const day = '2026-11-30';
const line = { dailyLineId: batch, batchLineId: batch, ingredientId: batch, ingredientName: 'Bầu', canonicalUnitId: batch,
  canonicalUnitName: 'Kilogram', frozenBaselineQuantity: 8.77503, approvedSupplementalQuantity: 0, requiredQuantity: 8.77503,
  issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 6.77503, quantityStatus: 'SHORT', hasValidDisposition: false };
const daily: MrxWarehouseDaily = { batchId: batch, batchStatus: 'IN_PROGRESS', sourceVersion: 7, weeklyStatus: 'IN_PROGRESS',
  compatibility: { canRead: true, canIssueByDate: true }, dates: [{ serviceDate: day, status: 'PARTIAL', isApplicable: true,
    requiredQuantity: 8.77503, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 6.77503, lines: [line] }] };
const fulfillment: MrxSupplementalFulfillment = { batchId: batch, serviceDate: day, pendingDemandCount: 0,
  lines: [{ dailyLineId: batch, ingredientId: batch, canonicalUnitId: batch, baselineRequiredQuantity: 8.77503,
    baselineIssuedQuantity: 2, baselineRemainingQuantity: 6.77503, netIssuedQuantity: 2, unplannedIssuedQuantity: 0,
    unallocatedIssuedQuantity: 0, hasIncompleteAllocation: false, hasAmbiguousReturn: false, isDemandFulfilled: false, extraDemands: [] }] };
let version = 7;
let modeVersion = 1;
let fullyReturned = false;
let requests: CreateMrxIssueRequest[];
beforeEach(() => {
  localStorage.clear(); serverStateCache.clearAll(); workspaceSessionStore.clearScope(); version = 7; modeVersion = 1; fullyReturned = false; requests = [];
  localStorage.setItem('ipc_v3_token', 'fixture-only'); localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  localStorage.setItem('ipc_v3_mode_version', '1');
  localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: actor, username: 'admin', fullName: 'Admin', roleCode: 'ADMIN', roleName: 'Admin',
    isActive: true, isAdminFullAccess: true, permissions: [] }));
  vi.mocked(apiClient).mockImplementation(async (url, init) => {
    if (url === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', version: modeVersion, label: 'Đối soát',
      updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } } as never;
    if (url.startsWith('/reconciliation/batches?')) return { items: [{ batchId: batch, status: 'IN_PROGRESS', version,
      customerId: batch, customerCode: 'ANV', customerName: 'AMANN', weekStartDate: day, weekEndDate: '2026-12-05', createdAt: '2026-11-16T00:00:00Z' }],
      totalCount: 1, totalPages: 1, pageNumber: 1, pageSize: 50, hasNext: false, hasPrev: false } as never;
    if (url.endsWith('/warehouse-daily')) return { ...daily, sourceVersion: version,
      dates: fullyReturned ? [{ ...daily.dates[0], issuedQuantity: 0, returnedQuantity: 2,
        lines: [{ ...line, issuedQuantity: 0, returnedQuantity: 2 }] }] : daily.dates } as never;
    if (url.startsWith('/inventory-issues?')) return { items: [], totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 25, hasNext: false, hasPrev: false } as never;
    if (url.includes('/fulfillment?')) return fulfillment as never;
    if (url === '/inventory-issues' && init?.method === 'POST') {
      requests.push(JSON.parse(String(init.body)));
      if (requests.length === 1) throw new TypeError('Mất phản hồi');
      return { issueId: batch, issueCode: 'ISS-1', concurrencyVersion: 1, provisions: [] } as never;
    }
    throw new Error(`Unconfigured API ${url}`);
  });
});
it.each(['same-actor', 'other-actor', 'new-mode-version'])('recovers an immutable uncertain supplemental command with scope %s', async scope => {
  const route = `/warehouse?view=mrx-daily&batchId=${batch}&date=${day}`;
  const first = renderWarehouse(route);
  await userEvent.click(await screen.findByRole('button', { name: 'Xuất bổ sung ca' }));
  await userEvent.type(await screen.findByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' }), '2');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' }), 'Bù phần thiếu');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' }));
  await screen.findByText('Chưa xác nhận được kết quả xuất kho');
  expect(requests).toHaveLength(1);
  first.unmount(); serverStateCache.clearAll(); version = 8;
  if (scope === 'other-actor') {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_user', JSON.stringify({ ...user, userId: '10000000-0000-0000-0000-000000000002' }));
  }
  if (scope === 'new-mode-version') { modeVersion = 2; localStorage.setItem('ipc_v3_mode_version', '2'); }
  renderWarehouse(route);
  if (scope === 'other-actor') {
    await screen.findByRole('button', { name: 'Xuất bổ sung ca' });
    expect(screen.queryByRole('button', { name: 'Kiểm tra lại lệnh xuất đã gửi' })).not.toBeInTheDocument();
    expect(requests).toHaveLength(1); return;
  }
  const recovery = await screen.findByRole('button', { name: 'Kiểm tra lại lệnh xuất đã gửi' });
  expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toBeDisabled();
  await userEvent.click(recovery);
  if (scope === 'new-mode-version') {
    expect(await screen.findByText(/Người dùng hoặc phiên bản chế độ đã thay đổi/)).toBeInTheDocument();
    expect(requests).toHaveLength(1); return;
  }
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[1].expectedVersion).toBe(7);
  expect(requests[1].lines[0].allocations).toEqual([{ purpose: 'BASELINE_SHORTAGE', quantity: 2 }]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('protects a dirty supplemental form on cancel and restores its quantity after reopening', async () => {
  renderWarehouse(`/warehouse?view=mrx-daily&batchId=${batch}&date=${day}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Xuất bổ sung ca' }));
  await userEvent.type(await screen.findByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' }), '2');
  await userEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
  expect(await screen.findByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeInTheDocument();
  expect(requests).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(screen.getByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' })).toHaveValue(2);
});
it('keeps initial issue locked after all its quantity was returned and opens only supplemental issuing', async () => {
  fullyReturned = true;
  renderWarehouse(`/warehouse?view=mrx-daily&batchId=${batch}&date=${day}`);
  expect(await screen.findByRole('button', { name: 'Xuất bổ sung ca' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Xác nhận xuất kho' })).not.toBeInTheDocument();
  expect(requests).toHaveLength(0);
});
