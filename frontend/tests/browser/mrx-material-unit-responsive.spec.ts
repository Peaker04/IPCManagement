import { expect, test } from '@playwright/test';

test.use({ video: 'off' });

test('MRX material unit remains readable across split-workbench widths', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'isolated-ui-test-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin User', roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'] }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });
  const material = { dishBomId: 'bom-1', ingredientId: 'i-1', ingredientCode: 'ING-1', ingredientName: 'ba chỉ lóc sườn', grossQuantityPerServing: 0.015, sourceUnitId: 'kg', sourceUnitName: 'Kilogram', requiredQuantity: 0.18, canonicalUnitId: 'kg', canonicalUnitName: 'Kilogram' };
  const inspection = { menuVersionId: 'mv-w42', contentFingerprint: 'fingerprint', fingerprintFormatVersion: 3, diagnostics: [], page: { items: [{ ingredientId: 'i-1', ingredientCode: 'ING-1', ingredientName: 'ba chỉ lóc sườn', canonicalUnitId: 'kg', canonicalUnitName: 'Kilogram', requiredQuantity: 0.6, contributions: [{ serviceDate: '2026-11-23', shift: 'MORNING', quantityPlanLineId: 'line-1', dishId: 'dish-1', dishName: 'Heo xào măng', dishSlot: 'main', finalServings: 12, material }] }], totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false } };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const data = url.pathname === '/api/system-operation-mode'
      ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1, updatedAt: '2026-11-15T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }
      : url.pathname === '/api/coordination/customers' ? [{ customerId: 'c-anv', customerCode: 'ANV', customerName: 'AMANN' }]
        : url.pathname === '/api/reconciliation/weekly-menu' ? { customerId: 'c-anv', weekStartDate: '2026-11-23', menuVersionId: 'mv-w42', menuVersionStatus: 'PUBLISHED', menuVersionNo: 1, warnings: [] }
          : url.pathname === '/api/reconciliation/batches/quantity-import/materials' ? inspection : null;
    await route.fulfill({ status: data ? 200 : 503, json: { success: Boolean(data), data } });
  });
  for (const width of [1600, 1280, 1024, 768, 600]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/weekly-menu?view=mrx-materials&customerId=c-anv&weekStartDate=2026-11-23');
    const row = page.getByRole('row', { name: /ba chỉ lóc sườn/ });
    await expect(row).toBeVisible();
    const unit = row.getByText('Kilogram', { exact: true });
    await expect(unit).toBeVisible();
    const geometry = await unit.evaluate(element => {
      const cell = element.closest('td')!;
      const text = document.createRange(); text.selectNodeContents(element);
      const textBox = text.getBoundingClientRect();
      const cellBox = cell.getBoundingClientRect();
      return { textRight: textBox.right, cellRight: cellBox.right, textLeft: textBox.left, cellLeft: cellBox.left };
    });
    expect(geometry.textLeft).toBeGreaterThanOrEqual(geometry.cellLeft - 1);
    expect(geometry.textRight).toBeLessThanOrEqual(geometry.cellRight + 1);
    await page.screenshot({ path: test.info().outputPath(`mrx-material-unit-${width}.png`) });
  }
});
