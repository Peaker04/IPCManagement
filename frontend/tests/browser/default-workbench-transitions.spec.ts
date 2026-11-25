import { expect, test } from '@playwright/test';
import type { ApprovalInboxItem, OperationalApprovalPage } from '../../src/api/approvalsApi';

for (const mode of ['DEFAULT', 'MATERIAL_RECONCILIATION'] as const) {
test(`approval cursor keeps the shell, previous rows and pager focus in ${mode}`, async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const targetType = mode === 'DEFAULT' ? 'inventory-receipt' : 'mrx-supplemental-demand';
  const actor = {
    userId: 'fixture-admin', username: 'fixture', fullName: 'Quản trị viên thử giao diện',
    roleCode: 'ADMIN', roleName: 'Admin', isAdminFullAccess: true, permissions: ['*'],
  };
  await page.addInitScript(({ user, mode }) => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(user));
    localStorage.setItem('ipc_v3_mode', mode);
  }, { user: actor, mode });

  const item = (id: string, code: string): ApprovalInboxItem => ({
    inboxItemId: id, targetType, itemType: targetType, targetId: id,
    targetCode: code, title: mode === 'DEFAULT' ? 'Phiếu nhập chờ duyệt' : 'Đề nghị bổ sung suất', source: 'Kho', ownerRole: 'Manager',
    submittedBy: 'Thủ kho', submittedAt: '2026-11-24T02:00:00Z', slaDeadline: '2026-11-24T06:00:00Z',
    status: 'PENDING', materials: [], nextAction: 'Xem xét', reason: '', route: '/approvals', serviceDates: [], tone: 'neutral',
  });
  const inbox = (item: ApprovalInboxItem, nextCursor: string | null): OperationalApprovalPage => ({
    items: [item], mode, modeVersion: 1, targets: [], unavailableSources: [], limit: 20, hasNext: Boolean(nextCursor), nextCursor,
  });
  let releasePage!: () => void;
  const pendingPage = new Promise<void>(resolve => { releasePage = resolve; });
  const inboxReads: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (url.pathname === '/api/system-operation-mode') {
      return ok({ mode, label: mode === 'DEFAULT' ? 'Mặc định' : 'Đối soát MRX', version: 1, updatedAt: '2026-11-24T02:00:00Z',
        reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    }
    if (url.pathname === '/api/Auth/me') return ok(actor);
    if (url.pathname === '/api/operational-approvals/inbox') {
      inboxReads.push(url.search);
      if (url.searchParams.get('Cursor') === 'next-page') {
        await pendingPage;
        return ok(inbox(item('receipt-b', 'PN-002'), null));
      }
      return ok(inbox(item('receipt-a', 'PN-001'), 'next-page'));
    }
    return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected fixture request' } });
  });

  await page.goto(`/approvals?targetType=${targetType}`);
  const shell = page.getByRole('complementary', { name: 'Thanh điều hướng chính' });
  await shell.evaluate(node => { node.setAttribute('data-shell-fixture', 'before-page-change'); });
  const firstRow = page.getByRole('row', { name: /PN-001/ });
  await expect(firstRow).toBeVisible();
  const table = page.locator('table').first();
  const before = await table.boundingBox();
  const next = page.getByRole('button', { name: 'Trang sau' });
  try {
    await next.click();
    await expect(next).toBeFocused();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(shell).toHaveAttribute('data-shell-fixture', 'before-page-change');
    await expect(page.getByRole('button', { name: 'Xem xét', includeHidden: true })).toBeDisabled();
    await expect(page.locator('[aria-busy="true"][inert]').filter({ has: table })).toBeVisible();
    await expect(table).toContainText('PN-001');
    const warm = await table.boundingBox();
    expect(warm?.y).toBe(before?.y);
  } finally {
    releasePage();
  }
  await expect(page.getByRole('row', { name: /PN-002/ })).toBeVisible();
  await expect(next).toBeFocused();
  expect(inboxReads).toEqual([`?Limit=20&TargetType=${targetType}`, `?Limit=20&TargetType=${targetType}&Cursor=next-page`]);
});
}
