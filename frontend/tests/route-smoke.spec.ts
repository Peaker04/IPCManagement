import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ROUTES } from '../src/lib/routeConfig';
import { expectNoPageOverflow, login, protectedRoutes, viewports } from './support/route-smoke/auth';
import { stubProductionReportStages, stubWorkflowReports } from './support/route-smoke/reports';

// phase18-body-start
test.describe('route smoke', () => {
  for (const viewport of viewports) {
    test(`login route renders without app shell at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(ROUTES.LOGIN);

      await expect(page.getByRole('heading', { name: 'IPC Management System' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
      await expect(page.locator('.ipc-app-shell')).toHaveCount(0);
      await expectNoPageOverflow(page);
    });
  }

  for (const viewport of viewports) {
    test(`protected routes render at ${viewport.name}`, async ({ page }) => {
      await stubWorkflowReports(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);

      for (const route of protectedRoutes) {
        if (page.url() !== new URL(route.path, 'http://127.0.0.1:5173').toString()) {
          await page.goto(route.path);
          await expect(page).toHaveURL(route.path);
        }

        await expect(page.locator('.ipc-app-shell')).toBeVisible();
        await expect(page.locator('.ipc-page-title')).toHaveText(route.heading);
        const primaryNavigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
        if (!(await primaryNavigation.isVisible())) {
          await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
        }
        await expect(primaryNavigation).toBeVisible();
        await expect(page.getByRole('link', { name: 'Tổng quan' }).first()).toBeVisible();
        await expect(page.locator('main.ipc-main')).toBeVisible();
        await expectNoPageOverflow(page);
      }
    });
  }

  test('reports price table exposes paging for long-lived data', async ({ page }) => {
    await stubWorkflowReports(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Biến động giá' }).click();
    await expect(page).toHaveURL(ROUTES.REPORTS);

    await expect(page.getByText('Đang xem 1–6 trên tổng 7 dòng giá')).toBeVisible();
    const nextPageButton = page.getByLabel('Trang sau');
    await nextPageButton.click();
    await expect(page.getByText('Đang xem 7–7 trên tổng 7 dòng giá')).toBeVisible();
    await expect(page.getByLabel('Trang trước')).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');

    await page.reload();
    await expect(page.getByText('Đang xem 7–7 trên tổng 7 dòng giá')).toBeVisible();

    await page.getByRole('combobox', { name: 'Số dòng mỗi trang' }).selectOption('20');
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
    await expect.poll(() => new URL(page.url()).searchParams.get('pageSize')).toBe('20');
  });

  test('reports movement loads the next server cursor page', async ({ page }) => {
    await stubProductionReportStages(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.REPORTS);

    await page.getByRole('tab', { name: 'Nhập/xuất kho' }).click();
    const movementTable = page.getByLabel('Bảng biến động kho');
    await expect(movementTable.getByText('Gạo tẻ trang 1')).toBeVisible();

    const nextCursorButton = page.getByRole('button', { name: 'Trang sau' });
    await nextCursorButton.click();
    await expect(movementTable.getByText('Sườn heo trang 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trang trước' })).toBeFocused();
    await expect(page.getByText('Đã tải hết dữ liệu')).toBeVisible();
    await expect(page.getByText('Trang 2', { exact: true })).toBeVisible();
  });

  test('warehouse movement uses bounded server cursor pages', async ({ page }) => {
    const reportRequests = await stubProductionReportStages(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Kho nguyên liệu' }).click();
    await expect(page).toHaveURL(ROUTES.WAREHOUSE);

    await expect.poll(() => reportRequests.hasEndpoint('current-stock/page')).toBe(true);

    const movementTable = page.getByLabel('Bảng biến động kho');
    await expect(movementTable.getByText('Gạo tẻ trang 1')).toBeVisible();
    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(movementTable.getByText('Sườn heo trang 2')).toBeVisible();
    await expect(page.getByText('Đã tải hết dữ liệu')).toBeVisible();
    await expect(page.getByText('Trang 2', { exact: true })).toBeVisible();
  });

  test('reports cover filters, export, and audit grouping with seeded workflow stages', async ({ page }) => {
    const reportRequests = await stubProductionReportStages(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.REPORTS);
    await expect(page).toHaveURL(ROUTES.REPORTS);

    await page.getByLabel('Từ ngày').fill('2026-06-15');
    await page.getByLabel('Đến ngày').fill('2026-06-15');
    await page.getByLabel('Ca').selectOption('MORNING');

    await page.getByRole('tab', { name: 'Nhu cầu nguyên liệu' }).click();
    await expect.poll(() => reportRequests.hasFilteredRequest('ingredient-demand')).toBe(true);
    await expect(page.getByText('Bún bò').first()).toBeVisible();
    await expect(page.getByLabel('Bảng nhu cầu nguyên liệu').getByText('Thiếu nguyên liệu')).toBeVisible();

    await page.getByRole('tab', { name: 'Kế hoạch thu mua' }).click();
    await expect(page.getByText('Nhà cung cấp A')).toBeVisible();
    await expect.poll(() => reportRequests.hasPurchasePlanGroupRequest('day')).toBe(true);
    await page.getByRole('button', { name: 'Tuần' }).click();
    await expect.poll(() => reportRequests.hasPurchasePlanGroupRequest('week')).toBe(true);
    await expect(page.getByText('Nhà cung cấp Tuần')).toBeVisible();
    await expect(page.getByText('2026-06-15/2026-06-21')).toBeVisible();
    await page.getByRole('tab', { name: 'Tồn kho' }).click();
    await expect(page.getByText('Kho chính').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Nhập/xuất kho' }).click();
    await expect(page.getByText('Nhập kho').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Xuất bếp' }).click();
    await expect(page.getByText('PXB-20260615-M').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Sử dụng thực tế' }).click();
    await expect(page.getByText('17 kg')).toBeVisible();

    await page.getByRole('tab', { name: 'Chất lượng dữ liệu' }).click();
    await expect(page.getByText('Kitchen Admin')).toBeVisible();
    await expect(page.getByText('P2 / 4h')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Xử lý' })).toHaveAttribute('href', ROUTES.WEEKLY_MENU);

    await page.getByRole('tab', { name: 'Nhật ký thay đổi' }).click();
    await expect.poll(() => reportRequests.hasFilteredRequest('audit-changes/page')).toBe(true);
    await expect(page.getByText('Mảng nghiệp vụ')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Import', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Receipt', exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(download.suggestedFilename()).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(downloadPath).toBeTruthy();

    const csv = await readFile(downloadPath!, 'utf8');
    expect(csv).toContain('Mảng nghiệp vụ');
    expect(csv).toContain('Import');
    expect(csv).toContain('Receipt');
  });

});
