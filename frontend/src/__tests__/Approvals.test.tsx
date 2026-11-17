import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { ApprovalPage } from '../features/approvals/ApprovalPage';
import * as client from '../api/client';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { isRouteEligible } from '../routes/navigationEligibility';

const empty = { items: [], limit: 20, hasNext: false, nextCursor: null, mode: 'DEFAULT', modeVersion: 1, unavailableSources: [],
  targets: [{ targetType: 'purchase-request', label: 'Đề nghị mua hàng', mode: 'DEFAULT', permission: 'purchase.request.approve' }] };
let readInbox: () => unknown;
function renderPage() { render(<AuthProvider><MemoryRouter><ApprovalPage /></MemoryRouter></AuthProvider>); }
beforeEach(() => {
  readInbox = () => empty;
  vi.spyOn(client, 'apiClient').mockImplementation(async url => {
    if (url === '/system-operation-mode') return { mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue','history'] } } } as never;
    if (url.startsWith('/operational-approvals/inbox')) return readInbox() as never;
    throw new Error(`Unexpected API ${url}`);
  });
});
it('keeps one operational workbench and displays the authoritative empty queue', async () => {
  renderPage();
  expect(await screen.findByText('Không có hồ sơ chờ xử lý')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Duyệt vận hành' })).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tạo mới' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phê duyệt hồ sơ' })).not.toBeInTheDocument();
});
it('shows server errors and retries the read', async () => {
  readInbox = () => { throw new Error('Lỗi hàng đợi'); };
  renderPage();
  expect(await screen.findByText('Lỗi hàng đợi')).toBeInTheDocument();
  readInbox = () => empty;
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Không có hồ sơ chờ xử lý')).toBeInTheDocument();
});
it('shows permission denial without document content', async () => {
  readInbox = () => { throw new client.ApiError(403, 'Không có quyền duyệt'); };
  renderPage();
  expect(await screen.findByText('Truy cập bị hạn chế')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('filters by the real wire type on the server and resets the cursor', async () => {
  renderPage();
  await screen.findByText('Không có hồ sơ chờ xử lý');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc loại yêu cầu phê duyệt' }), 'purchase-request');
  await waitFor(() => expect(client.apiClient).toHaveBeenCalledWith('/operational-approvals/inbox?Limit=20&TargetType=purchase-request'));
});
it('makes the hub available to managers in both modes while denying warehouse navigation', () => {
  expect(isRouteEligible(CANONICAL_ROUTES, '/approvals', '', { roleCode: 'Manager' }, 'DEFAULT')).toBe(true);
  expect(isRouteEligible(CANONICAL_ROUTES, '/approvals', '', { roleCode: 'Manager' }, 'MATERIAL_RECONCILIATION')).toBe(true);
  expect(isRouteEligible(CANONICAL_ROUTES, '/approvals', '', { roleCode: 'WarehouseStaff' }, 'MATERIAL_RECONCILIATION')).toBe(false);
});
