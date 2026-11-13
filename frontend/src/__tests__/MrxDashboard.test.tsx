import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { isRouteEligible } from '../routes/navigationEligibility';
import { mrxApi, type MrxOperationalSummary } from '../api/mrxApi';
import * as apiTransport from '../api/client';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { systemApi } from '../api/systemApi';
import { ReconciliationDashboardPage } from '../features/dashboard/ReconciliationDashboardPage';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { adminApi } from '../api/adminApi';
import { bomApi } from '../api/bomApi';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

const summary: MrxOperationalSummary = {
  queueCounts: {}, queuePageNumber: 1, queuePageSize: 10, queueTotalCount: 0, queueTotalPages: 0,
  pendingSourceChangesCount: 3, awaitingWarehouseBatchesCount: 4, pendingDeltasCount: 0,
  unresolvedVariancesCount: 2, completionReadyBatchesCount: 1, items: [],
  customerOptions: [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }],
};

function renderDashboard(entry = '/') {
  return render(<AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}><MemoryRouter initialEntries={[entry]}><ReconciliationDashboardPage /></MemoryRouter></AuthProvider>);
}

describe('MRX Dashboard — authoritative facts and scope', () => {
  it.each([
    ['/?period=YEAR&year=2024', '2024-01-01', '2024-12-31'],
    ['/?period=RANGE&from=2023-01-01&to=2025-12-31', '2023-01-01', '2025-12-31'],
  ])('sends historical boundaries from %s to both summary and batch reads', async (url, weekFrom, weekTo) => {
    const read = vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue(summary);
    renderDashboard(url);
    await waitFor(() => expect(read).toHaveBeenCalledWith({ weekFrom, weekTo }));
    expect(mrxApi.getBatchPage).toHaveBeenCalledWith({ weekFrom, weekTo, pageNumber: 1, pageSize: 20 });
  });

  it('pages batches without repeating the operational summary read', async () => {
    const read = vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue(summary);
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async filters => ({ items: [], totalCount: 21, totalPages: 2,
      pageNumber: filters?.pageNumber ?? 1, pageSize: 20, hasNext: filters?.pageNumber !== 2, hasPrev: filters?.pageNumber === 2 }));
    renderDashboard();
    const pager = await screen.findByRole('navigation', { name: 'Phân trang lô đối soát' });
    await waitFor(() => expect(within(pager).getByRole('button', { name: 'Trang sau' })).toBeEnabled());
    await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(mrxApi.getBatchPage).toHaveBeenCalledWith({ pageNumber: 2, pageSize: 20 }));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('applies a complete year once without requests for partial keystrokes', async () => {
    const read = vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue(summary);
    renderDashboard();
    await screen.findByText('Lô chờ Kho xuất');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Kỳ thời gian' }), 'YEAR');
    const year = screen.getByRole('textbox', { name: 'Năm tra cứu' });
    await userEvent.clear(year);
    await userEvent.type(year, '2024');
    expect(read).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng kỳ' }));
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ weekFrom: '2024-01-01', weekTo: '2024-12-31' }));
    expect(read).toHaveBeenCalledTimes(2);
  });
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'manager-1', username: 'manager', fullName: 'Quản lý', roleCode: 'MANAGER', roleName: 'Manager', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read', 'reconciliation.read'] }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 20 });
  });

  it.each([
    { roleCode: 'MANAGER', permissions: ['reconciliation.source.read', 'reconciliation.read'], count: 4 },
    { roleCode: 'WAREHOUSESTAFF', permissions: ['reconciliation.warehouse.read'], count: 1 },
    { roleCode: 'CHEF', permissions: ['reconciliation.kitchen.read', 'reconciliation.read'], count: 0 },
  ])('keeps the $roleCode loading canvas consistent with its visible metrics', async ({ roleCode, permissions, count }) => {
    const actor = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_user', JSON.stringify({ ...actor, roleCode, roleName: roleCode, permissions }));
    let resolveSummary!: (value: MrxOperationalSummary) => void;
    vi.spyOn(mrxApi, 'getOperationalSummary').mockImplementation(() => new Promise(resolve => { resolveSummary = resolve; }));
    await act(async () => { renderDashboard(); });
    const header = screen.getByRole('heading', { name: 'Bàn điều hành đối soát' });
    const flow = screen.getByRole('region', { name: 'Sơ đồ quy trình đối chiếu 4 bước' });
    const command = within(flow).getAllByRole('button')[0];
    command.focus();
    const loading = screen.queryByRole('status', { name: 'Đang tải chỉ số điều hành' });
    if (count) { expect(loading).toBeVisible(); expect(loading?.childElementCount).toBe(count); }
    else expect(loading).not.toBeInTheDocument();
    expect(screen.queryByText('Đổi nguồn chờ duyệt')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await act(async () => resolveSummary(count === 4 ? summary : { ...summary,
      queueCounts: {}, queuePageNumber: 1, queuePageSize: 10, queueTotalCount: 0, queueTotalPages: 0,
      pendingSourceChangesCount: null, awaitingWarehouseBatchesCount: count ? 4 : null,
      unresolvedVariancesCount: null, completionReadyBatchesCount: null,
    }));
    expect(await screen.findByRole('heading', { name: 'Sơ đồ quy trình đối chiếu 4 bước' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Bàn điều hành đối soát' })).toBe(header);
    expect(screen.getByRole('region', { name: 'Sơ đồ quy trình đối chiếu 4 bước' })).toBe(flow);
    expect(command).toHaveFocus();
    expect(screen.queryByRole('status', { name: 'Đang tải chỉ số điều hành' })).not.toBeInTheDocument();
  });

  it('hydrates expired facts then revalidates on mount and re-entry without manual refresh', async () => {
    const actor = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    const actorKey = JSON.stringify([actor.userId, actor.roleCode, actor.roleName, actor.permissions, 'MATERIAL_RECONCILIATION']);
    const key = `mrx_dashboard_${actorKey}_{}_1`;
    serverStateCache.set(key, { summary, customers: summary.customerOptions,
      batches: { items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 20 } }, -1);
    let resolveSummary!: (value: MrxOperationalSummary) => void;
    const read = vi.spyOn(apiTransport, 'apiClient').mockImplementation(endpoint => {
      if (endpoint !== '/reconciliation/reports/operational-summary') throw new Error(`Unexpected dashboard request ${endpoint}`);
      return new Promise<MrxOperationalSummary>(resolve => { resolveSummary = resolve; });
    });
    const view = renderDashboard();
    expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('4');
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await act(async () => resolveSummary({ ...summary, awaitingWarehouseBatchesCount: 1 }));
    await waitFor(() => expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('1'));
    view.unmount();
    read.mockResolvedValue({ ...summary, awaitingWarehouseBatchesCount: 2 });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('2'));
    expect(read).toHaveBeenCalledTimes(2);
    expect(mrxApi.getBatchPage).toHaveBeenCalledTimes(2);
  });

  it('keeps stale facts visible with retry but never offers their next-work action after revalidation fails', async () => {
    const actor = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    const actorKey = JSON.stringify([actor.userId, actor.roleCode, actor.roleName, actor.permissions, 'MATERIAL_RECONCILIATION']);
    serverStateCache.set(`mrx_dashboard_${actorKey}_{}_1`, {
      summary: { ...summary, items: [{ queueType: 'AWAITING_WAREHOUSE', workObjectId: 'batch-1', title: 'Lô chờ', subtitle: 'Cũ', targetUrl: '/reconciliation?batchId=batch-1', createdAt: '2026-10-19T00:00:00Z', ownerRole: 'MANAGER', actionKind: 'OWN_ACTION' }] },
      customers: summary.customerOptions, batches: { items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 20 },
    }, -1);
    const read = vi.spyOn(apiTransport, 'apiClient').mockRejectedValueOnce(new Error('Không thể xác minh dữ liệu mới')).mockResolvedValue({ ...summary, awaitingWarehouseBatchesCount: 1 });
    renderDashboard();
    expect(await screen.findByText('Không thể xác minh dữ liệu mới')).toBeVisible();
    expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('4');
    expect(screen.queryByRole('button', { name: 'Mở việc tiếp theo' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('1'));
    expect(read).toHaveBeenCalledTimes(2);
    let resolveOld!: (value: MrxOperationalSummary) => void;
    read.mockImplementationOnce(() => new Promise<MrxOperationalSummary>(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ ...summary, awaitingWarehouseBatchesCount: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo khách hàng' }), 'customer-1');
    await waitFor(() => expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('2'));
    expect(read).toHaveBeenLastCalledWith('/reconciliation/reports/operational-summary?customerId=customer-1');
    await act(async () => resolveOld({ ...summary, awaitingWarehouseBatchesCount: 99 }));
    expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('2');
  });

  it('uses summary entity counts instead of recent batch rows and sends the selected scope to the server', async () => {
    const getSummary = vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue(summary);
    vi.mocked(mrxApi.getBatchPage).mockResolvedValue({
      items: [{ batchId: 'batch-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'COMPLETED', version: 4, createdAt: '2026-10-19T00:00:00Z' }],
      totalCount: 1, totalPages: 1, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 20,
    });
    renderDashboard();
    expect((await screen.findByText('Đổi nguồn chờ duyệt')).parentElement).toHaveTextContent('3');
    expect(screen.getByText('Lô chờ Kho xuất').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Dòng lệch cần xử lý').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Lô sẵn sàng chốt').parentElement).toHaveTextContent('1');
    expect(screen.getByRole('cell', { name: 'DAV · Draxlmaier' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Mã lô đối soát' })).toBeVisible();
    expect(screen.getByText('batch-1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mở trạm làm việc' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Kho xuất định lượng ngày/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo khách hàng' }), 'customer-1');
    await waitFor(() => expect(getSummary).toHaveBeenLastCalledWith({ customerId: 'customer-1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mở trạm làm việc' }));
    expect(workspaceSessionStore.getScope()).toMatchObject({ customerId: 'customer-1', batchId: 'batch-1', weekStartDate: '2026-10-19' });
  });

  it('carries the selected dashboard batch into a naked Chef route despite an older Chef snapshot', async () => {
    workspaceSessionStore.clearScope();
    serverStateCache.clearAll();
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'admin-1', username: 'admin', fullName: 'Quản trị',
      roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: [] }));
    const selected = { batchId: 'batch-2', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 2, createdAt: '2026-10-19T00:00:00Z' };
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue(summary);
    vi.mocked(mrxApi.getBatchPage).mockResolvedValue({ items: [selected], totalCount: 1, pageNumber: 1, pageSize: 20,
      totalPages: 1, hasPrev: false, hasNext: false });
    const cooking = vi.spyOn(mrxApi, 'getKitchenCooking').mockResolvedValue({ batchId: selected.batchId, sourceVersion: 2, rows: [] });
    serverStateCache.set('snapshot:mrx_cooking', { batchId: 'batch-1', selectedShift: 'ALL' });
    const router = createMemoryRouter([
      { path: '/', element: <ReconciliationDashboardPage /> },
      { path: '/reconciliation', element: null },
      { path: '/chef', element: <ChefDashboardPage /> },
    ]);
    render(<AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
      <RouterProvider router={router} />
    </AuthProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Mở trạm làm việc' }));
    expect(workspaceSessionStore.getScope().batchId).toBe('batch-2');
    await act(async () => { await router.navigate('/chef?view=mrx-cooking'); });
    await waitFor(() => expect(cooking).toHaveBeenCalledWith('batch-2'));
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát nấu' })).toHaveValue('batch-2');
    expect(cooking).not.toHaveBeenCalledWith('batch-1');
  });

  it('loads Chef facts and MRX customer filters without requiring Coordination access', async () => {
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'chef-1', username: 'chef', fullName: 'Bếp trưởng', roleCode: 'CHEF', roleName: 'HeadChef', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.kitchen.read', 'reconciliation.read'] }));
    const sourceCustomers = vi.mocked(weeklyMenuApi.getCustomers).mockRejectedValue(new Error('403: Không có quyền Điều phối'));
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({ ...summary, pendingSourceChangesCount: null, awaitingWarehouseBatchesCount: null, pendingDeltasCount: null, unresolvedVariancesCount: null, completionReadyBatchesCount: null });
    renderDashboard();
    expect(await screen.findByRole('button', { name: /Phân rã phiếu nấu Bếp/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lập lô đối soát mới' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kho xuất định lượng ngày/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'DAV · Draxlmaier' })).toBeInTheDocument();
    expect(screen.queryByText('Dòng lệch cần xử lý')).not.toBeInTheDocument();
    expect(sourceCustomers).not.toHaveBeenCalled();
  });

  it('restores the four-step dashboard and source action with working authorized destinations', async () => {
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'admin-1', username: 'admin', fullName: 'Quản trị', roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: [] }));
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue(summary);
    workspaceSessionStore.setScope({ customerId: 'customer-1', weekStartDate: '2026-10-19', batchId: 'completed-1' });
    const completed = { batchId: 'completed-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1', status: 'COMPLETED', version: 5, createdAt: '2026-10-18T00:00:00Z', lines: [] };
    vi.mocked(mrxApi.getBatchPage).mockResolvedValue({ items: [completed], totalCount: 1, pageNumber: 1, pageSize: 20, totalPages: 1, hasPrev: false, hasNext: false });
    vi.spyOn(mrxApi, 'getBatch').mockResolvedValue(completed);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-v1', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [], validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] } });
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue({ batchId: 'completed-1', batchStatus: 'COMPLETED', batchVersion: 5, menuVersionId: 'menu-v1', days: [] });
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([]);
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue({ token: 'token', expiresAt: '2026-10-18T01:00:00Z', contentFingerprint: 'fp', fingerprintFormatVersion: 2, plans: [], diagnostics: [] });
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false });
    vi.spyOn(bomApi, 'getSupportedPriceTiers').mockResolvedValue([]);
    const commit = vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport');
    const router = createMemoryRouter([
      { path: '/', element: <ReconciliationDashboardPage /> },
      { path: '/weekly-menu', element: <WeeklyMenuPage /> },
      { path: '/chef', element: null },
    ]);
    render(<AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}><RouterProvider router={router} /></AuthProvider>);

    expect(await screen.findByRole('heading', { name: 'Sơ đồ quy trình đối chiếu 4 bước' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Lập lô & Nguồn thực đơn/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Kho xuất định lượng ngày/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Giám sát đối soát & Quyết toán/ })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Phân rã phiếu nấu Bếp/ }));
    expect(router.state.location.pathname).toBe('/chef');
    expect(router.state.location.search).toBe('?view=mrx-cooking');
    await act(async () => { await router.navigate('/'); });
    await userEvent.click(await screen.findByRole('button', { name: 'Lập lô đối soát mới' }));
    expect(router.state.location.pathname).toBe('/weekly-menu');
    expect(router.state.location.search).toBe('?view=mrx-batch&action=import');
    expect(await screen.findByRole('dialog', { name: 'Nhập thực đơn tuần từ file Excel' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');
    expect(commit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?view=mrx-batch');
    expect(screen.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('19/10/2026');
    await act(async () => { await router.navigate('/'); });
    await userEvent.click(await screen.findByRole('button', { name: /Lập lô & Nguồn thực đơn/ }));
    expect(router.state.location.search).toBe('?view=mrx-batch');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a failed summary read with retry instead of invented empty counts', async () => {
    const getSummary = vi.spyOn(mrxApi, 'getOperationalSummary').mockRejectedValueOnce(new Error('Không tải được tổng quan')).mockResolvedValue(summary);
    renderDashboard();
    expect(await screen.findByText('Không tải được tổng quan')).toBeInTheDocument();
    expect(screen.queryByText('Đổi nguồn chờ duyệt')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect((await screen.findByText('Đổi nguồn chờ duyệt')).parentElement).toHaveTextContent('3');
    expect(getSummary).toHaveBeenCalledTimes(2);
  });

  it('hides the empty work queue without hiding the batch overview', async () => {
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({
      ...summary,
      items: [],
    });
    renderDashboard();
    expect(await screen.findByRole('region', { name: 'Danh sách lô theo bộ lọc' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Công việc theo vai trò' })).not.toBeInTheDocument();
    expect(screen.queryByText('Không có công việc chờ xử lý theo bộ lọc hiện tại.')).not.toBeInTheDocument();
  });

  it('I9: ReconciliationDashboardPage renders Danh sách lô theo bộ lọc above Công việc theo vai trò so queue item count changes never shift the batch table vertically', async () => {
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({ ...summary, items: [{ queueType: 'AWAITING_WAREHOUSE', workObjectId: 'batch-1', title: 'Lô chờ', subtitle: 'Chờ xuất kho', targetUrl: '/reconciliation?batchId=batch-1', createdAt: '2026-10-19T00:00:00Z', ownerRole: 'MANAGER', actionKind: 'OWN_ACTION' }] });
    renderDashboard();
    const batchSection = await screen.findByRole('region', { name: 'Danh sách lô theo bộ lọc' });
    const queueSection = await screen.findByRole('region', { name: 'Công việc theo vai trò' });
    expect(batchSection.compareDocumentPosition(queueSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
