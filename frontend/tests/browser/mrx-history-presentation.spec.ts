import { expect, test } from '@playwright/test';
import { MOCK_RECONCILIATION_BATCH_DTO } from '../../src/test/fixtures';
import type { BomCoverageReport } from '../../src/api/bomApi';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'test-jwt-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin User',
      roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'],
    }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });
});

test('keeps frozen BOM dialog bounds stable after quick reconciliation navigation on desktop and narrow screens', async ({ page }) => {
  let releaseDishes!: () => void;
  let dishesReady = new Promise<void>((resolve) => { releaseDishes = resolve; });
  await page.route('**/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path.endsWith('/kitchen-cooking')) {
      return route.fulfill({ status: 409, json: { success: false, message: 'KITCHEN_FROZEN_LINEAGE_MISSING' } });
    }
    if (path.endsWith('/dishes')) {
      await dishesReady;
      return route.fulfill({ status: 409, json: { success: false, message: 'KITCHEN_FROZEN_LINEAGE_MISSING' } });
    }
    const disposition = { category: 'ACCEPTED_VARIANCE', reason: 'Đã được Quản lý duyệt trước đó', version: 1, disposedAt: '2026-09-28T07:00:00Z' };
    const batch = {
      ...MOCK_RECONCILIATION_BATCH_DTO, status: 'COMPLETED', completedAt: '2026-09-28T07:00:00Z',
      lines: MOCK_RECONCILIATION_BATCH_DTO.lines.map((line) => ({ ...line, disposition })),
      dailyReview: { ...MOCK_RECONCILIATION_BATCH_DTO.dailyReview, lines: MOCK_RECONCILIATION_BATCH_DTO.dailyReview!.lines.map((line) => ({ ...line, disposition })) },
    };
    const data = path === '/api/system-operation-mode'
      ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/coordination/customers'
        ? [{ customerId: batch.customerId, customerCode: batch.customerCode, customerName: batch.customerName }]
        : path === '/api/reconciliation/batches'
          ? { items: [batch], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false }
        : path === '/api/reconciliation/reports/completed-register'
          ? { rows: [{ batchId: batch.batchId, customerName: batch.customerName, weekStartDate: batch.weekStartDate, weekEndDate: batch.weekEndDate,
            completedBy: 'Quản lý', completedAt: '2026-09-28T07:00:00Z', version: batch.version, totalIngredientsCount: batch.lines.length,
            totalRequired: 72, totalIssued: null, totalVariance: null, quantityUnitName: null }], totalCount: 1 }
          : path === `/api/reconciliation/batches/${batch.batchId}` ? batch : null;
    if (!data) return route.fulfill({ status: 503, json: { success: false, message: 'API unavailable in isolated dialog test.' } });
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/reconciliation?view=completed');
    await expect(page.getByRole('columnheader', { name: 'Mã lô', exact: true })).toHaveCount(0);
    const quickOpen = page.getByRole('button', { name: `Đối chiếu lô tuần 21/09/2026 · ${MOCK_RECONCILIATION_BATCH_DTO.customerName}` });
    await expect(quickOpen).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('completed-register-desktop.png') });
    await page.setViewportSize({ width: 600, height: 480 });
    await quickOpen.scrollIntoViewIfNeeded();
    const actionBounds = await quickOpen.evaluate((button) => {
      const cell = button.closest('td')!;
      return { scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth };
    });
    expect(actionBounds.scrollWidth).toBeLessThanOrEqual(actionBounds.clientWidth + 1);
    await page.screenshot({ path: test.info().outputPath('completed-register-narrow.png') });
    await page.setViewportSize({ width: 1366, height: 768 });
    await quickOpen.click();
    await expect(page.getByRole('navigation', { name: 'Tra cứu hồ sơ lô' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Ngày đối soát' })).toHaveValue('21/09/2026');
    await expect(page.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('archived-profile-desktop.png') });
    for (const viewport of [{ width: 1366, height: 768 }, { width: 600, height: 480 }]) {
      await page.setViewportSize(viewport);
      dishesReady = new Promise<void>((resolve) => { releaseDishes = resolve; });
      const trigger = page.getByRole('button', { name: 'Món & BOM đã đóng băng', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Món & BOM đã đóng băng', exact: true });
      await expect(dialog.getByRole('status')).toBeVisible();
      const panel = dialog.locator(':scope > div');
      const pending = await panel.boundingBox();
      releaseDishes();
      await expect(dialog.getByText('Chưa đủ dữ liệu món & BOM đã đóng băng', { exact: true })).toBeVisible();
      const settled = await panel.boundingBox();
      expect(pending).not.toBeNull();
      expect(settled).not.toBeNull();
      expect(Math.abs(settled!.height - pending!.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(settled!.y - pending!.y)).toBeLessThanOrEqual(1);
      expect(settled!.y).toBeGreaterThanOrEqual(0);
      expect(settled!.y + settled!.height).toBeLessThanOrEqual(viewport.height);
      await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`frozen-unavailable-${viewport.width}.png`) });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    await page.goto(`/chef?view=mrx-cooking&batchId=${MOCK_RECONCILIATION_BATCH_DTO.batchId}`);
    await expect(page.getByText('Chưa đủ dữ liệu phiếu nấu', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Về Bàn điều hành', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'In phiếu nấu', exact: true })).toBeDisabled();
    await page.screenshot({ path: test.info().outputPath('chef-short-guidance.png') });
  } finally {
    releaseDishes();
    await page.waitForLoadState('networkidle');
  }
});

test('keeps the BOM action inside its cell without an overflow ellipsis at desktop and narrow widths', async ({ page }) => {
  const coverage: BomCoverageReport = {
    generatedAt: '2026-10-28T12:00:00Z', totalDishes: 1, completeDishes: 1, missingBomDishes: 0, totalBomLines: 3,
    dishes: [{ dishId: 'd-1', dishCode: 'MON-01', dishName: 'Cơm sườn nướng', dishType: 'Món mặn',
      dishGroup: 'Heo', bomLineCount: 3, hasBom: true, status: 'COMPLETE', statusLabel: 'Đã có BOM' }],
  };
  await page.route('**/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const data = path === '/api/system-operation-mode'
      ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/Dishes/bom-coverage' ? coverage : null;
    return route.fulfill({ status: data ? 200 : 503, json: { success: Boolean(data), data } });
  });
  try {
    await page.goto('/admin-data?view=bom');
    for (const viewport of [{ width: 1366, height: 768 }, { width: 600, height: 480 }]) {
    await page.setViewportSize(viewport);
    const action = page.getByRole('button', { name: 'Chỉnh sửa BOM', exact: true });
    await expect(action).toBeVisible();
    const bounds = await action.evaluate((button) => {
      const cell = button.closest('td')!;
      const style = getComputedStyle(cell);
      const rect = cell.getBoundingClientRect();
      const actionRect = button.getBoundingClientRect();
      return { cellWidth: rect.width, actionWidth: actionRect.width, scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth,
        availableWidth: rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        left: actionRect.left - rect.left, right: rect.right - actionRect.right };
    });
    expect(bounds.actionWidth, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.availableWidth + 1);
    expect(bounds.scrollWidth, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.clientWidth + 1);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeGreaterThanOrEqual(0);
    await action.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`bom-action-${viewport.width}.png`) });
    }
  } finally {
    await page.waitForLoadState('networkidle');
  }
});
