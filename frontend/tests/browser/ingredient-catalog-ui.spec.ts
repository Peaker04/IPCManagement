import { expect, test } from '@playwright/test';

test.use({ video: 'off' });

test('catalog ingredient dialog uses the shared layout for create and edit', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'isolated-ui-test-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin User', roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'] }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const ingredient = { ingredientId: '10000000-0000-0000-0000-000000000011', ingredientCode: 'ING-1000000000000000', ingredientName: 'Gạo tẻ ST25', unitId: '10000000-0000-0000-0000-000000000021', unitName: 'Kilôgam', warehouseId: '10000000-0000-0000-0000-000000000031', referencePrice: 28000, isFreshDaily: false, isActive: true };
    const data = url.pathname === '/api/system-operation-mode'
      ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1, updatedAt: '2026-11-14T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }
      : url.pathname === '/api/ingredients'
        ? { items: [ingredient], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false }
        : url.pathname === '/api/Units'
          ? [{ unitId: ingredient.unitId, unitCode: 'KG', unitName: 'Kilôgam' }, { unitId: '10000000-0000-0000-0000-000000000022', unitCode: 'HOP', unitName: 'Hộp' },
            ...Array.from({ length: 17 }, (_, index) => ({ unitId: `10000000-0000-0000-0000-${String(index + 23).padStart(12, '0')}`, unitCode: `DV${index + 3}`, unitName: `Đơn vị ${index + 3}` })),
            { unitId: '10000000-0000-0000-0000-000000000099', unitCode: 'THUNG', unitName: 'Thùng lớn' }]
          : null;
    await route.fulfill({ status: data ? 200 : 503, json: { success: Boolean(data), data } });
  });
  for (const { width, height } of [{ width: 1366, height: 768 }, { width: 600, height: 768 }, { width: 600, height: 480 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/admin-data?view=ingredients');
    await page.getByRole('button', { name: 'Thêm nguyên liệu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm nguyên liệu' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Mã nguyên liệu' })).toHaveCount(0);
    const group = dialog.getByRole('combobox', { name: 'Nhóm cung ứng' });
    for (const label of ['Gạo', 'Bún, mỳ & phở', 'Trứng', 'Sữa & chế phẩm', 'Bánh', 'Nước giải khát', 'Bao bì', 'Nước đá']) {
      await expect(group.getByRole('option', { name: label, exact: true })).toHaveCount(1);
    }
    await group.selectOption('NOODLES');
    await dialog.getByRole('combobox', { name: 'Đơn vị tính nguyên liệu' }).click();
    await expect(dialog.getByRole('option', { name: 'Kilôgam' })).toBeVisible();
    await expect(dialog.getByRole('listbox').getByRole('option')).toHaveCount(5);
    await expect(group).toHaveValue('NOODLES');
    await expect(dialog.getByText('Kilôgam (KG)')).toHaveCount(0);
    const unitList = await dialog.getByRole('listbox').boundingBox();
    const price = await dialog.getByRole('spinbutton', { name: 'Giá tham chiếu' }).boundingBox();
    expect(unitList).not.toBeNull();
    expect(price).not.toBeNull();
    expect(unitList!.y + unitList!.height).toBeLessThanOrEqual(price!.y);
    expect(await dialog.getByRole('listbox').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
    await page.screenshot({ path: test.info().outputPath(`ingredient-create-${width}-${height}.png`) });
    await dialog.getByRole('combobox', { name: 'Đơn vị tính nguyên liệu' }).fill('Thùng');
    await expect(dialog.getByRole('option', { name: 'Thùng lớn' })).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Đơn vị tính nguyên liệu' }).press('Enter');
    await expect(dialog.getByRole('combobox', { name: 'Đơn vị tính nguyên liệu' })).toHaveValue('Thùng lớn');
    await expect(dialog.getByRole('listbox')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Hủy' }).click();
    await page.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' }).getByRole('button', { name: 'Hủy thay đổi' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Sửa nguyên liệu Gạo tẻ ST25' }).click();
    const edit = page.getByRole('dialog', { name: 'Sửa nguyên liệu' });
    await expect(edit).toContainText('ING-1000000000000000');
    await expect(edit.getByRole('textbox', { name: 'Đơn vị tính nguyên liệu' })).toBeDisabled();
    await page.screenshot({ path: test.info().outputPath(`ingredient-edit-${width}-${height}.png`) });
  }
});
