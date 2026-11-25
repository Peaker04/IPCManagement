import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { ApprovalPage } from '../features/approvals/ApprovalPage';
import * as client from '../api/client';
import { notifyMrxWriteAcknowledged } from '../api/mrxCacheInvalidation';

const id = '20000000-0000-0000-0000-000000000001';
const item = { serviceDates: [], inboxItemId: `material-demand-${id}`, targetType: 'material-demand', targetId: id,
  targetCode: 'MR-20261116', itemType: 'material-demand', title: 'Duyệt nhu cầu nguyên liệu',
  source: 'AMANN', ownerRole: 'Quản lý', submittedBy: 'Điều phối', dueDate: '2026-11-16',
  status: 'DRAFT', reason: 'Chuẩn bị ca sáng', nextAction: 'Duyệt', tone: 'warning', route: '/approvals',
  submittedAt: '2026-11-16T06:00:00Z', materials: [{ name: 'Bầu', quantity: 8.77503, unit: 'Kilogram' }] };
const page = { items: [item], limit: 20, hasNext: false, nextCursor: null, mode: 'DEFAULT', modeVersion: 1, unavailableSources: [],
  targets: [{ targetType: 'material-demand', label: 'Nhu cầu nguyên liệu', mode: 'DEFAULT', permission: 'material-demand.approve' }] };
const detail = { sourceDishNames: {}, mode: 'DEFAULT', modeVersion: 1, item, fingerprint: 'ABC', allowedActions: ['APPROVE', 'REJECT'], blockedReasons: [], materialImpact: [] };
let handler: (url: string, init?: RequestInit) => unknown;
beforeEach(() => {
  handler = url => {
    if (url === '/system-operation-mode') return { mode: 'DEFAULT', label: 'Mặc định', version: 1,
      updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue','history'] } } };
    if (url.startsWith('/operational-approvals/inbox')) return page;
    if (url.endsWith('/history')) return [];
    if (url === `/operational-approvals/material-demand/${id}`) return detail;
    throw new Error(`Unconfigured API: ${url}`);
  };
  vi.spyOn(client, 'apiClient').mockImplementation(async (url, init) => handler(url, init) as never);
});
function openPage() { return render(<AuthProvider><MemoryRouter><ApprovalPage /></MemoryRouter></AuthProvider>); }

it('shows the approved legacy stage as awaiting application and sends explicit APPLY rather than another approval', async () => {
  const base = handler;
  const legacyItem = { ...item, targetType: 'legacy-lineage-disposition', itemType: 'legacy-lineage-disposition',
    title: 'Đối chiếu liên kết chứng từ cũ', targetCode: 'LG-20000000', status: 'APPROVED', materials: [], source: 'Dòng xuất kho · ISS-20261116', submittedBy: 'Admin' };
  const commands: Record<string, unknown>[] = [];
  handler = (url, init) => {
    if (url.endsWith('/decision')) { commands.push(JSON.parse(init?.body as string)); return { targetType: legacyItem.targetType, targetId: id, status: 'APPLIED', newStatus: 'APPLIED', historyId: id, actionAt: item.submittedAt }; }
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, items: [legacyItem], targets: [{ targetType: legacyItem.targetType, label: legacyItem.title, mode: 'DEFAULT', permission: 'inventory.issue.approve' }] };
    if (url === `/operational-approvals/legacy-lineage-disposition/${id}`) return { ...detail, item: legacyItem, allowedActions: ['APPLY'], legacyLineage: {
      dispositionId: id, legacyLineType: 'ISSUE_LINE', legacyLineId: '30000000-0000-0000-0000-000000000001',
      targetMaterialRequestLineId: '40000000-0000-0000-0000-000000000001', targetIssueLineId: null,
      status: 'APPROVED', reason: 'Đối chiếu chứng từ gốc', reviewReason: 'Đúng dòng nguồn', createdBy: id, createdAt: item.submittedAt,
      reviewedBy: '50000000-0000-0000-0000-000000000001', reviewedAt: item.submittedAt, appliedBy: null, appliedAt: null, version: 1,
    } };
    return base(url, init);
  };
  openPage();
  expect(await screen.findByText('Chờ áp dụng')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByText('Dòng chứng từ cũ')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phê duyệt hồ sơ' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Áp dụng liên kết' }));
  await userEvent.type(screen.getByLabelText('Căn cứ quyết định'), 'Áp dụng mapping đã duyệt');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận áp dụng liên kết' }));
  await waitFor(() => expect(commands).toHaveLength(1));
  expect(commands[0]).toMatchObject({ action: 'APPLY', expectedFingerprint: 'ABC', expectedModeVersion: 1, reason: 'Áp dụng mapping đã duyệt' });
});

it('renders stocktake system actual and variance in distinct columns before a stock-changing decision', async () => {
  const base = handler;
  const stocktakeItem = { ...item, targetType: 'stocktake', itemType: 'stocktake', title: 'Duyệt chênh lệch kiểm kê', targetCode: 'KK-1', status: 'REVIEWING', materials: [] };
  handler = (url, init) => {
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, items: [stocktakeItem], targets: [{ targetType: 'stocktake', label: 'Chênh lệch kiểm kê', mode: 'DEFAULT', permission: 'inventory.issue.approve' }] };
    if (url === `/operational-approvals/stocktake/${id}`) return { ...detail, item: stocktakeItem, stocktake: {
      stocktakeId: id, stocktakeCode: 'KK-1', warehouseId: id, warehouseName: 'Kho IPC', status: 'REVIEWING', createdBy: id, createdAt: item.submittedAt,
      lines: [{ lineId: id, ingredientId: id, ingredientName: 'Bầu', unitId: id, unitName: 'Kilogram', systemQty: 10, actualQty: 8, discrepancyQty: -2, reason: 'Kiểm đếm thực tế' }],
    } };
    return base(url, init);
  };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByRole('columnheader', { name: 'Tồn hệ thống' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Kiểm đếm' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Chênh lệch' })).toBeInTheDocument();
  expect(screen.getByText('Kiểm đếm thực tế')).toBeInTheDocument();
  expect(screen.getByText('-2')).toBeInTheDocument();
});

it('shows exact supplemental dish shift variant and extra servings before manager approval', async () => {
  const base = handler;
  const mrxItem = { ...item, targetType: 'mrx-supplemental-demand', itemType: 'mrx-supplemental-demand',
    targetCode: 'PS-20000000', title: 'Nhu cầu suất phát sinh', status: 'PENDING', source: 'ANV · AMANN', submittedBy: 'Thủ kho', reason: 'Khách tăng suất',
    materials: [{ name: 'Bầu', quantity: 2, unit: 'Kilogram' }, { name: 'Tôm', quantity: 0.5, unit: 'Kilogram' }] };
  handler = (url, init) => {
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, mode: 'MATERIAL_RECONCILIATION', items: [mrxItem],
      targets: [{ targetType: mrxItem.targetType, label: mrxItem.title, mode: 'MATERIAL_RECONCILIATION', permission: '' }] };
    if (url === `/operational-approvals/mrx-supplemental-demand/${id}`) return { ...detail, mode: 'MATERIAL_RECONCILIATION', item: mrxItem,
      supplementalDemand: { demandId: id, batchId: id, serviceDate: '2026-11-30', status: 'PENDING', version: 2, batchVersion: 4,
        reason: 'Khách tăng suất', snapshotFingerprint: 'FROZEN', createdBy: id, createdAt: '2026-11-16T06:00:00Z',
        submittedAt: '2026-11-16T06:05:00Z', decidedBy: null, decidedAt: null, decisionReason: null, materials: [
        { demandMaterialId: id, dailyLineId: id, ingredientId: id, canonicalUnitId: id, requiredQuantity: 2 },
        { demandMaterialId: '20000000-0000-0000-0000-000000000002', dailyLineId: '20000000-0000-0000-0000-000000000002',
          ingredientId: '20000000-0000-0000-0000-000000000002', canonicalUnitId: id, requiredQuantity: 0.5 },
      ], dishes: [
          { demandDishId: id, dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory', extraServings: 10 },
          { demandDishId: '20000000-0000-0000-0000-000000000002', dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'AFTERNOON', menuVariant: 'vegetarian', extraServings: 5 },
        ] } };
    return base(url, init);
  };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByRole('heading', { name: 'Suất phát sinh đề nghị' })).toBeInTheDocument();
  expect(screen.getByText('30/11/2026')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Sáng · Mặn' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Chiều · Chay' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Suất thêm' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '10' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '5' })).toBeInTheDocument();
});

it('opens processed records with their immutable timeline and no decision controls', async () => {
  const base = handler;
  handler = (url, init) => {
    if (url.startsWith('/operational-approvals/inbox') && url.includes('State=PROCESSED')) return { ...page,
      items: [{ ...item, status: 'MANAGERAPPROVED' }] };
    if (url.endsWith('?state=PROCESSED')) return { ...detail, item: { ...item, status: 'MANAGERAPPROVED' }, allowedActions: [] };
    return base(url, init);
  };
  openPage();
  await screen.findByText('MR-20261116');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phạm vi hàng đợi' }), 'PROCESSED');
  await screen.findByText('Đã duyệt nhu cầu');
  await userEvent.click(screen.getByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByText('Kilogram')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phê duyệt hồ sơ' })).not.toBeInTheDocument();
});

it('opens authoritative detail with real units and server cursor pagination', async () => {
  const base = handler;
  handler = (url, init) => url.startsWith('/operational-approvals/inbox') ? { ...page, hasNext: true, nextCursor: 'cursor-A' } : base(url, init);
  openPage();
  expect(await screen.findByText('MR-20261116')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(client.apiClient).toHaveBeenCalledWith(expect.stringContaining('Cursor=cursor-A')));
  await userEvent.click(screen.getByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByText('Kilogram')).toBeInTheDocument();
  expect(screen.getByText('8,77503')).toBeInTheDocument();
  expect(screen.queryByText(/Tổng quy mô/)).not.toBeInTheDocument();
});

it('shows history failure and retries with the backend timeline DTO', async () => {
  const base = handler;
  let failed = true;
  handler = (url, init) => { if (url.endsWith('/history')) { if (failed) throw new Error('Lịch sử không khả dụng'); return [{ historyId: id, targetType: item.targetType, targetId: id, decision: 'APPROVE', oldStatus: 'DRAFT', newStatus: 'PENDING_NEXT_APPROVAL', actionBy: id, actionByName: 'Quản lý ca', actionAt: '2026-11-16T07:00:00Z', reason: 'Đã kiểm tra' }]; } return base(url, init); };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByText('Lịch sử không khả dụng')).toBeInTheDocument();
  failed = false;
  await userEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }));
  expect(await screen.findByText('Quản lý ca')).toBeInTheDocument();
});

it('preserves rejected draft and sends the reviewed evidence fingerprint', async () => {
  const base = handler;
  handler = (url, init) => { if (url.endsWith('/decision')) throw new client.ApiError(409, 'Hồ sơ đã thay đổi'); return base(url, init); };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Từ chối hồ sơ' }));
  await userEvent.type(screen.getByLabelText('Căn cứ quyết định'), 'Thiếu bằng chứng');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
  expect(await screen.findByText('Hồ sơ đã thay đổi')).toBeInTheDocument();
  expect(screen.getByLabelText('Căn cứ quyết định')).toHaveValue('Thiếu bằng chứng');
  const sent = vi.mocked(client.apiClient).mock.calls.find(([url]) => url.endsWith('/decision'))!;
  expect(JSON.parse(sent[1]!.body as string)).toEqual({ commandId: expect.any(String), expectedModeVersion: 1,
    expectedFingerprint: 'ABC', decision: 'Reject', reason: 'Thiếu bằng chứng' });
});

it('reconciles a lost decision response with the same command and preserves the reviewed payload', async () => {
  const base = handler;
  const bodies: string[] = [];
  handler = (url, init) => {
    if (url.endsWith('/decision')) {
      bodies.push(String(init?.body));
      if (bodies.length === 1) throw new TypeError('Failed to fetch');
      return { targetType: item.targetType, targetId: id, status: 'APPROVE', newStatus: 'MANAGERAPPROVED', historyId: id, actionAt: '2026-11-16T07:00:00Z' };
    }
    return base(url, init);
  };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Phê duyệt hồ sơ' }));
  await userEvent.type(screen.getByLabelText('Căn cứ quyết định'), 'Đã kiểm tra');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận phê duyệt' }));
  expect(await screen.findByLabelText('Căn cứ quyết định')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Hủy bỏ' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Xác nhận phê duyệt' })).toBeInTheDocument();
  expect(screen.getByLabelText('Căn cứ quyết định')).toHaveValue('Đã kiểm tra');
  expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết quả' }));
  expect(await screen.findByText(/Đã ghi nhận quyết định.*Đã duyệt nhu cầu/)).toBeInTheDocument();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});

it.each(['same-actor', 'changed-role', 'other-actor', 'changed-mode-version'])('recovers the identical MRX decision after hard reload with scope %s', async recoveryScope => {
  const base = handler;
  const mode = 'MATERIAL_RECONCILIATION';
  const row = { ...item, targetType: 'mrx-supplemental-demand', status: 'PENDING' };
  const bodies: string[] = [];
  let modeVersion = 1;
  localStorage.setItem('ipc_v3_mode', mode);
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { ...base(url, init) as object, mode, version: modeVersion };
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, mode, items: bodies.length ? [] : [row] };
    if (url.endsWith('/decision')) {
      bodies.push(String(init?.body));
      if (bodies.length === 1) throw new TypeError('Lost after commit');
      return { targetType: row.targetType, targetId: id, status: 'APPROVED', newStatus: 'APPROVED' };
    }
    if (url.endsWith('/mrx-supplemental-demand/' + id)) return { ...detail, mode, item: row };
    return base(url, init);
  };
  const first = openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Phê duyệt hồ sơ' }));
  await userEvent.type(screen.getByLabelText('Căn cứ quyết định'), 'Đã đối chiếu đúng khách hàng');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận phê duyệt' }));
  await screen.findByRole('button', { name: 'Kiểm tra kết quả' });
  first.unmount();
  if (recoveryScope === 'changed-mode-version') {
    modeVersion = 2;
    localStorage.setItem('ipc_v3_mode_version', '2');
  } else if (recoveryScope !== 'same-actor') {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_user', JSON.stringify(recoveryScope === 'changed-role'
      ? { ...user, roleCode: 'MANAGER', isAdminFullAccess: false } : { ...user, userId: '30000000-0000-0000-0000-000000000001' }));
  }
  openPage();
  if (recoveryScope === 'other-actor') {
    await screen.findByText('Không có hồ sơ chờ xử lý');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    return;
  }
  if (recoveryScope === 'changed-role' || recoveryScope === 'changed-mode-version') {
    expect(await screen.findByText(/Vai trò hoặc phiên bản chế độ đã thay đổi/)).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tra cứu lịch sử hồ sơ' })).toBeEnabled();
    expect(bodies).toHaveLength(1);
    return;
  }
  const modal = await screen.findByRole('dialog', { name: 'Xác nhận phê duyệt' });
  expect(within(modal).getByLabelText('Căn cứ quyết định')).toHaveValue('Đã đối chiếu đúng khách hàng');
  expect(within(modal).getByRole('button', { name: 'Hủy bỏ' })).toBeDisabled();
  await userEvent.click(within(modal).getByRole('button', { name: 'Kiểm tra kết quả' }));
  await screen.findByText(/Đã ghi nhận quyết định.*Đã duyệt/);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});

it('does not offer resend after an acknowledged decision and failed reload', async () => {
  const base = handler;
  let committed = false;
  handler = (url, init) => {
    if (url.endsWith('/decision')) { committed = true; return { targetType: item.targetType, targetId: id, status: 'PENDING_NEXT_APPROVAL', newStatus: 'PENDING', historyId: id, actionAt: '2026-11-16T07:00:00Z' }; }
    if (url.startsWith('/operational-approvals/inbox') && committed) throw new Error('Không tải lại được danh sách');
    return base(url, init);
  };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Phê duyệt hồ sơ' }));
  await userEvent.type(screen.getByLabelText('Căn cứ quyết định'), 'Đã kiểm tra');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận phê duyệt' }));
  expect(await screen.findByText(/Đã ghi nhận quyết định.*Chờ bước duyệt tiếp theo/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phê duyệt hồ sơ' })).not.toBeInTheDocument();
});


it('opens the MRX reconciliation context for batch review with no generic decision', async () => {
  const base = handler;
  const batchItem = { ...item, targetType: 'mrx-batch-review', title: 'Rà soát và chốt lô',
    status: 'COMPLETION_READY', nextAction: 'Mở đối soát', route: '/reconciliation?batchId=' + id,
    weekStartDate: '2026-11-30', materials: [] };
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'MRX', version: 1,
      updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false,
      capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue', 'history'] } } };
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, mode: 'MATERIAL_RECONCILIATION',
      items: [batchItem], targets: [{ targetType: batchItem.targetType, label: batchItem.title, mode: 'MATERIAL_RECONCILIATION', permission: '' }] };
    if (url === '/operational-approvals/mrx-batch-review/' + id + '/history') return [{ historyId: 'batch-created', targetType: batchItem.targetType, targetId: id, decision: 'DRAFT', newStatus: 'DRAFT', actionBy: id, actionByName: 'Admin', actionAt: item.submittedAt }];
    if (url === '/operational-approvals/mrx-batch-review/' + id) return { ...detail, mode: 'MATERIAL_RECONCILIATION',
      item: batchItem, allowedActions: [], blockedReasons: ['Mở trạm đối soát để xem số liệu theo ngày và kiểm tra điều kiện chốt lô.'] };
    return base(url, init);
  };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByRole('button', { name: 'Mở đối soát' })).toBeEnabled();
  expect(screen.getByText('Tuần phục vụ')).toBeInTheDocument();
  expect(screen.getAllByText('Sẵn sàng chốt lô')).toHaveLength(2);
  expect(await screen.findByText('Đã tạo lô')).toBeInTheDocument();
  expect(screen.queryByText('Chờ duyệt')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phê duyệt hồ sơ' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Từ chối hồ sơ' })).not.toBeInTheDocument();
});


it('sends MRX customer and serving date filters to the server and clears the cursor', async () => {
  const base = handler;
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'MRX', version: 1,
      updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false,
      capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue', 'history'] } } };
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, mode: 'MATERIAL_RECONCILIATION' };
    return base(url, init);
  };
  openPage();
  const customer = await screen.findByRole('textbox', { name: 'Lọc mã khách hàng' });
  await userEvent.type(customer, 'anv');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lọc ngày phục vụ' }), '01/12/2026');
  await userEvent.click(screen.getByRole('button', { name: 'Tìm' }));
  await waitFor(() => expect(client.apiClient).toHaveBeenCalledWith(
    '/operational-approvals/inbox?Limit=20&CustomerCode=ANV&Date=2026-12-01'));
});


it('shows source servings and changed dishes before accepting a MRX source decision', async () => {
  const base = handler;
  const source = { ...item, targetType: 'mrx-source-change', title: 'Thay đổi nguồn thực đơn', status: 'PENDING_REVIEW', materials: [] };
  handler = (url, init) => {
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, items: [source] };
    if (url === '/operational-approvals/mrx-source-change/' + id) return { ...detail, item: source,
      sourceChange: { impactLines: [{ serviceDate: '2026-12-01', shiftName: 'MORNING', oldDishId: id, newDishId: 'new-dish',
        currentSavoryServings: 100, newSavoryServings: 120, currentVegetarianServings: 20, newVegetarianServings: 25,
        currentServings: 120, newServings: 145 }], materialImpact: [] },
      sourceDishNames: { [id]: 'Bầu nấu tôm', 'new-dish': 'Bí xào' } };
    return base(url, init);
  };
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByRole('columnheader', { name: 'Mặn trước' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Mặn sau' })).toBeInTheDocument();
  expect(screen.getByText('100')).toBeInTheDocument();
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('Bầu nấu tôm')).toBeInTheDocument();
  expect(screen.getByText('Bí xào')).toBeInTheDocument();
});


it('keeps available MRX items visible and identifies an unavailable queue source with retry', async () => {
  localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  const base = handler;
  const mode = 'MATERIAL_RECONCILIATION';
  const row = { ...item, targetType: 'mrx-supplemental-demand', itemType: 'mrx-supplemental-demand', status: 'PENDING' };
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { ...(base(url, init) as object), mode };
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, items: [row], mode, targets: [], hasNext: true, nextCursor: 'partial-cursor',
      unavailableSources: [
        { targetType: 'mrx-source-change', message: 'Thay đổi nguồn thực đơn chưa tải được' },
        { targetType: 'mrx-historical-purpose', message: 'Phân bổ phiếu lịch sử chưa tải được' },
      ] };
    return base(url, init);
  };
  openPage();
  expect(await screen.findByText('Thay đổi nguồn thực đơn chưa tải được')).toBeInTheDocument();
  expect(screen.getByText('Phân bổ phiếu lịch sử chưa tải được')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Tải lại hàng đợi' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Làm mới' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem xét' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(client.apiClient).toHaveBeenCalledWith('/operational-approvals/inbox?Limit=20&Cursor=partial-cursor'));
  await userEvent.click(screen.getByRole('button', { name: 'Tải lại hàng đợi' }));
  await waitFor(() => {
    const reads = vi.mocked(client.apiClient).mock.calls.filter(([url]) => url.startsWith('/operational-approvals/inbox'));
    expect(reads.at(-1)?.[0]).toBe('/operational-approvals/inbox?Limit=20');
  });
});



it('blocks opening a previous-scope row while new queue filters are loading', async () => {
  const base = handler;
  let finish: (value: unknown) => void = () => {};
  const pending = new Promise<unknown>(resolve => { finish = resolve; });
  handler = (url, init) => url.startsWith('/operational-approvals/inbox') && url.includes('SearchKeyword=another')
    ? pending : base(url, init);
  openPage();
  await screen.findByRole('button', { name: 'Xem xét' });
  await userEvent.type(screen.getByRole('textbox', { name: 'Tìm hồ sơ' }), 'another');
  await userEvent.click(screen.getByRole('button', { name: 'Tìm' }));
  expect(screen.getByRole('button', { name: 'Xem xét' })).toBeDisabled();
  await userEvent.click(screen.getByText(item.title));
  expect(vi.mocked(client.apiClient).mock.calls.some(([url]) => url === '/operational-approvals/material-demand/' + id)).toBe(false);
  finish({ ...page, items: [] });
  expect(await screen.findByText('Không có hồ sơ chờ xử lý')).toBeInTheDocument();
});

it('keeps the DEFAULT inbox and selected detail stable on an MRX acknowledgement', async () => {
  openPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByRole('button', { name: 'Phê duyệt hồ sơ' })).toBeEnabled();
  const callsBefore = vi.mocked(client.apiClient).mock.calls.length;

  notifyMrxWriteAcknowledged();

  expect(vi.mocked(client.apiClient).mock.calls).toHaveLength(callsBefore);
  expect(screen.getByRole('button', { name: 'Phê duyệt hồ sơ' })).toBeEnabled();
});

it('retries the currently selected MRX detail after failure without reviving a late prior selection', async () => {
  const base = handler;
  const mode = 'MATERIAL_RECONCILIATION';
  const rows = ['A', 'B', 'C'].map(letter => ({ ...item, title: 'Lô ' + letter, status: 'COMPLETION_READY',
    targetType: 'mrx-batch-review', targetId: letter, inboxItemId: letter, route: '/reconciliation?batchId=' + letter }));
  const detailFor = (row: typeof item) => ({ ...detail, mode, item: row, allowedActions: [] });
  let resolveB!: (value: ReturnType<typeof detailFor>) => void;
  const slowB = new Promise<ReturnType<typeof detailFor>>(resolve => { resolveB = resolve; });
  let callsC = 0;
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { ...base(url, init) as object, mode };
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, mode, items: rows };
    if (url.endsWith('/mrx-batch-review/A')) return detailFor(rows[0]);
    if (url.endsWith('/mrx-batch-review/B')) return slowB;
    if (url.endsWith('/mrx-batch-review/C')) {
      if (++callsC === 1) throw new client.ApiError(500, 'Không tải được lô C');
      return detailFor(rows[2]);
    }
    return base(url, init);
  };
  openPage();
  for (const letter of ['A', 'B', 'C']) {
    await userEvent.click(within(await screen.findByRole('row', { name: new RegExp('Lô ' + letter) })).getByRole('button', { name: 'Xem xét' }));
    if (letter === 'A') await screen.findByRole('button', { name: 'Mở đối soát' });
  }
  expect(await screen.findByText('Không tải được lô C')).toBeVisible();
  await act(async () => { resolveB(detailFor(rows[1])); });
  expect(screen.queryByRole('heading', { name: 'Lô B' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
  expect(await screen.findByRole('heading', { name: 'Lô C' })).toBeVisible();
  expect(callsC).toBe(2);
  expect(screen.getByRole('button', { name: 'Mở đối soát' })).toBeEnabled();
});

it('discards pending MRX detail when changing from queue to decision history', async () => {
  const base = handler;
  const mode = 'MATERIAL_RECONCILIATION';
  const row = { ...item, title: 'Lô đang chờ', status: 'COMPLETION_READY', targetType: 'mrx-batch-review', targetId: 'A', inboxItemId: 'A' };
  const late = { ...detail, mode, item: row, allowedActions: [] };
  let resolveDetail!: (value: typeof late) => void;
  const pending = new Promise<typeof late>(resolve => { resolveDetail = resolve; });
  const inboxCalls: string[] = [];
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { ...base(url, init) as object, mode };
    if (url.startsWith('/operational-approvals/inbox')) {
      inboxCalls.push(url);
      return { ...page, mode, items: url.includes('PROCESSED') ? [] : [row] };
    }
    if (url.endsWith('/mrx-batch-review/A')) return pending;
    return base(url, init);
  };
  openPage();
  await userEvent.click(within(await screen.findByRole('row', { name: /Lô đang chờ/ })).getByRole('button', { name: 'Xem xét' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phạm vi hàng đợi' }), 'PROCESSED');
  await waitFor(() => expect(inboxCalls.some(url => url.includes('PROCESSED'))).toBe(true));
  await act(async () => { resolveDetail(late); });
  expect(screen.queryByRole('heading', { name: 'Lô đang chờ' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mở đối soát' })).not.toBeInTheDocument();
});

it('keeps the MRX detail frame locked until the latest selected batch resolves', async () => {
  const base = handler;
  const mode = 'MATERIAL_RECONCILIATION';
  const [a, b, c] = ['A', 'B', 'C'].map(letter => ({
    ...item, title: 'Lô ' + letter, status: 'COMPLETION_READY', targetType: 'mrx-batch-review',
    targetId: letter, inboxItemId: letter, targetCode: letter, route: '/reconciliation?batchId=' + letter,
  }));
  const detailFor = (row: typeof a) => ({ ...detail, mode, item: row, allowedActions: [] });
  let resolveB!: (value: ReturnType<typeof detailFor>) => void;
  let resolveC!: (value: ReturnType<typeof detailFor>) => void;
  const slowB = new Promise<ReturnType<typeof detailFor>>(resolve => { resolveB = resolve; });
  const slowC = new Promise<ReturnType<typeof detailFor>>(resolve => { resolveC = resolve; });
  handler = (url, init) => {
    if (url === '/system-operation-mode') return { ...base(url, init) as object, mode, label: 'MRX' };
    if (url.startsWith('/operational-approvals/inbox')) return { ...page, mode, items: [a, b, c], targets: [] };
    if (url.endsWith('/mrx-batch-review/A')) return detailFor(a);
    if (url.endsWith('/mrx-batch-review/B')) return slowB;
    if (url.endsWith('/mrx-batch-review/C')) return slowC;
    return base(url, init);
  };
  openPage();
  const rowA = await screen.findByRole('row', { name: /Lô A/ });
  await userEvent.click(within(rowA).getByRole('button', { name: 'Xem xét' }));
  expect(await screen.findByRole('button', { name: 'Mở đối soát' })).toBeEnabled();

  await userEvent.click(within(screen.getByRole('row', { name: /Lô B/ })).getByRole('button', { name: 'Xem xét' }));
  expect(screen.getByRole('heading', { name: 'Lô A' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Mở đối soát' })).toBeDisabled();
  await userEvent.click(within(screen.getByRole('row', { name: /Lô C/ })).getByRole('button', { name: 'Xem xét' }));

  await act(async () => { resolveC(detailFor(c)); });
  expect(screen.getByRole('heading', { name: 'Lô C' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Mở đối soát' })).toBeEnabled();
  await act(async () => { resolveB(detailFor(b)); });
  expect(screen.getByRole('heading', { name: 'Lô C' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Lô B' })).not.toBeInTheDocument();
});
