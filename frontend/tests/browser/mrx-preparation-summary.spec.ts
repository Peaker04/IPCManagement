import { expect, test } from '@playwright/test';
test.use({ video: 'off' });

test('preparation summary and exact-batch allocation stay readable across viewports', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'isolated-ui-test-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin User', roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'] }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });
  const batches = [1, 2, 3].map(n => ({ batchId: `10000000-0000-4000-8000-00000000000${n}`, customerId: n < 3 ? 'customer-a' : 'customer-b', customerCode: n < 3 ? 'ANV' : 'DRX', customerName: n < 3 ? 'AMANN' : 'Draxlmaier', batchStatus: 'TRANSFERRED', batchVersion: 1, isApplicable: true, hasExistingIssue: false, requiredQuantity: 2, issuedQuantity: 0, remainingQuantity: 2 }));
  const allocation = (index: number, quantity: number, daily: string) => ({ ...batches[index], batchLineId: `line-${index}`, dailyLineId: daily, requiredQuantity: quantity, issuedQuantity: null, remainingQuantity: quantity, status: 'UNTOUCHED' });
  const preparation = { serviceDate: '2026-11-23', batches, aggregatedLines: [{ ingredientId: 'ingredient-a', ingredientCode: 'ING-AB0C477433', ingredientName: 'Cà rốt', canonicalUnitId: 'unit-kg', canonicalUnitName: 'Kilogram', totalRequiredQuantity: 18.5, totalIssuedQuantity: 0, totalRemainingQuantity: 18.5, allocations: [allocation(0, 3, 'd1'), allocation(0, 5, 'd2'), allocation(1, 6.5, 'd3'), allocation(2, 4, 'd4')] }] };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const data = path === '/api/system-operation-mode' ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1, updatedAt: '2026-11-15T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/reconciliation/preparation' ? preparation : null;
    await route.fulfill({ status: data ? 200 : 503, json: { success: Boolean(data), data } });
  });
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/warehouse?view=mrx-preparation&date=2026-11-23');
    const row = page.getByRole('row', { name: /Cà rốt/ });
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell').nth(3)).toHaveText('2');
    await page.screenshot({ path: test.info().outputPath(`preparation-summary-${width}.png`) });
    await page.getByRole('button', { name: 'Phân bổ Cà rốt' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('row', { name: /ANV/ })).toHaveCount(2);
    await expect(dialog.getByRole('row', { name: /ANV/ }).first()).toContainText('8');
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: test.info().outputPath(`preparation-allocation-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Phân bổ Cà rốt' })).toBeFocused();
  }
});
