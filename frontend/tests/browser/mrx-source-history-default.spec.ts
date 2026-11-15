import { expect, test } from '@playwright/test';

test.use({ video: 'off' });

test('MRX source history keeps event list and detail readable without horizontal scrolling', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'isolated-ui-test-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin User', roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'] }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });
  const entry = { eventId: 'amendment:aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', customerCode: 'ANV', customerName: 'AMANN', weekStartDate: '2027-01-18', occurredAt: '2027-01-19T08:00:00Z', actorName: 'Điều phối', status: 'PENDING_REVIEW', approvalStatus: 'PENDING', changeRoute: 'REQUEST', reason: 'Đổi món trong tuần', affectedLineCount: 16 };
  const detail = { event: entry, requesterName: 'Điều phối', requestedAt: entry.occurredAt, reviewerName: null, reviewedAt: null, executorName: null, executedAt: null, revisions: [], materials: { items: [
    { serviceDate: '2027-01-19', ingredientCode: 'ING-1F2388D926', ingredientName: 'Cá bạc má', unitName: 'Kilogram', previousQuantity: 97.778, newQuantity: 99.73356, deltaQuantity: 1.95556, isApplied: false },
    { serviceDate: '2027-01-19', ingredientCode: 'ING-1B39C45C0B', ingredientName: 'Chuối', unitName: 'Quả', previousQuantity: 0, newQuantity: 2.5, deltaQuantity: 2.5, isApplied: false },
  ], totalCount: 2, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false } };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const data = url.pathname === '/api/system-operation-mode'
      ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1, updatedAt: '2026-11-15T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }
      : url.pathname === '/api/reconciliation/source-history'
        ? { items: [entry], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false }
        : url.pathname.startsWith('/api/reconciliation/source-history/') ? detail : null;
    await route.fulfill({ status: data ? 200 : 503, json: { success: Boolean(data), data } });
  });
  for (const width of [1900, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/warehouse?view=mrx-issues');
    await expect(page.getByText('ANV · AMANN')).toBeVisible();
    if (width === 390) {
      const title = await page.getByRole('heading', { name: 'Lịch sử thay đổi nguồn' }).boundingBox();
      const actions = await page.locator('.mrx-source-header [data-slot="header-command-region"]').boundingBox();
      expect(title).not.toBeNull(); expect(actions).not.toBeNull();
      expect(actions!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
    }
    const list = page.getByRole('list', { name: 'Các lần thay đổi nguồn' });
    await expect(list.getByRole('listitem')).toHaveCount(1);
    const overflow = await list.evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    if (width >= 1440) {
      for (const column of [4, 5]) {
        const heading = await page.locator(`.mrx-history-head > span:nth-child(${column})`).boundingBox();
        const badge = await page.locator(`.mrx-history-row > div:nth-child(${column}) > span:last-child`).boundingBox();
        expect(Math.abs((heading!.x + heading!.width / 2) - (badge!.x + badge!.width / 2))).toBeLessThanOrEqual(1);
      }
    }
    await page.screenshot({ path: test.info().outputPath(`source-history-events-${width}.png`) });
    await page.getByRole('button', { name: /Xem chi tiết thay đổi nguồn/ }).click();
    await expect(page.getByRole('dialog').getByText('Ảnh hưởng dự kiến · Chưa ghi nhận cập nhật nguồn')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Cá bạc má')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Chưa duyệt')).toBeVisible();
    const detailOverflow = await page.locator('.mrx-history-detail').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(detailOverflow).toBeLessThanOrEqual(2);
    const afterPositions = await page.locator('.mrx-history-materials tbody td[data-label="Sau"]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().right));
    expect(afterPositions).toHaveLength(2);
    expect(Math.abs(afterPositions[0] - afterPositions[1])).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`source-history-detail-${width}.png`) });
    if (width === 390) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Xem chi tiết thay đổi nguồn/ })).toBeFocused();
    } else {
      await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
    }
  }
});
