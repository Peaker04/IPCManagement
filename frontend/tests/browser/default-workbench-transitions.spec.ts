import { expect, test } from '@playwright/test';

test('approval cursor keeps the shell, previous rows and pager focus while the next page loads', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const actor = {
    userId: 'fixture-admin', username: 'fixture', fullName: 'Quản trị viên thử giao diện',
    roleCode: 'ADMIN', roleName: 'Admin', isAdminFullAccess: true, permissions: ['*'],
  };
  await page.addInitScript(user => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(user));
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
  }, actor);

  const item = (id: string, code: string) => ({
    inboxItemId: id, targetType: 'inventory-receipt', itemType: 'inventory-receipt', targetId: id,
    targetCode: code, title: 'Phiếu nhập chờ duyệt', source: 'Kho', ownerRole: 'Manager',
    submittedBy: 'Thủ kho', submittedAt: '2026-11-24T02:00:00Z', slaDeadline: '2026-11-24T06:00:00Z',
    status: 'PENDING',
  });
  let releasePage!: () => void;
  const pendingPage = new Promise<void>(resolve => { releasePage = resolve; });
  const inboxReads: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (url.pathname === '/api/system-operation-mode') {
      return ok({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-11-24T02:00:00Z',
        reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    }
    if (url.pathname === '/api/Auth/me') return ok(actor);
    if (url.pathname.startsWith('/api/approval-history/')) return ok([]);
    if (url.pathname === '/api/approvals/inbox') {
      inboxReads.push(url.search);
      if (url.searchParams.get('cursor') === 'next-page') {
        await pendingPage;
        return ok({ items: [item('receipt-b', 'PN-002')], limit: 20, hasNext: false, nextCursor: null });
      }
      return ok({ items: [item('receipt-a', 'PN-001')], limit: 20, hasNext: true, nextCursor: 'next-page' });
    }
    return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected fixture request' } });
  });

  await page.goto('/approvals?type=inventory-receipt');
  const shell = page.getByRole('complementary', { name: 'Thanh điều hướng chính' });
  await shell.evaluate(node => { node.setAttribute('data-shell-fixture', 'before-page-change'); });
  const firstRow = page.getByRole('row', { name: /PN-001/ });
  await expect(firstRow).toBeVisible();
  const table = page.locator('table').first();
  const before = await table.boundingBox();
  const pager = page.getByRole('navigation', { name: 'Phân trang hàng đợi phê duyệt' });
  const next = pager.getByRole('button', { name: 'Trang sau' });
  try {
    await next.click();
    await expect(next).toBeFocused();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(shell).toHaveAttribute('data-shell-fixture', 'before-page-change');
    await expect(page.getByRole('button', { name: 'Phê duyệt hồ sơ' })).toBeDisabled();
    await expect(page.locator('[aria-busy="true"][inert]').filter({ has: table })).toBeVisible();
    await expect(table).toContainText('PN-001');
    const warm = await table.boundingBox();
    expect(warm?.y).toBe(before?.y);
  } finally {
    releasePage();
  }
  await expect(page.getByRole('row', { name: /PN-002/ })).toBeVisible();
  await expect(next).toBeFocused();
  expect(inboxReads).toEqual(['?targetType=inventory-receipt', '?targetType=inventory-receipt&cursor=next-page']);
});
