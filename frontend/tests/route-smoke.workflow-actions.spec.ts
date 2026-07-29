import { expect, test } from '@playwright/test';
import { ROUTES } from '../src/lib/routeConfig';
import { PHASE09_DATE, PHASE09_WEEK, phase09Workbench } from './phase9-test-fixture';
import { expectNoPageOverflow, login } from './support/route-smoke/auth';
import { stubApprovalDecisionSuccess } from './support/route-smoke/approvals';
import { stubMobileOperationsSuccess } from './support/route-smoke/mobile-operations';
import { stubPurchasingSubmitFailure } from './support/route-smoke/purchasing';

// phase18-body-start
test.describe('route smoke', () => {
  test('purchasing submit surfaces API validation errors', async ({ page }) => {
    await stubPurchasingSubmitFailure(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(`${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=submitted`);

    await page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' }).getByRole('button', { name: /Gửi đề xuất mua/ }).click();
    await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Gửi đề xuất mua' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gửi đề xuất mua' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Gửi đề xuất mua' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Có dòng mua vượt ngưỡng giá');
  });

  test('purchasing creates a purchase request from a selected material demand', async ({ page }) => {
    await page.route('**/api/supplemental-material-requests**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false },
        }),
      });
    });
    await page.route('**/api/purchase-orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data: [] }),
      });
    });
    await page.route('**/api/approvals/inbox**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data: { items: [], limit: 20, hasNext: false, nextCursor: null } }),
      });
    });
    await page.route('**/api/workflow-reports/**', async (route) => {
      const endpoint = new URL(route.request().url()).pathname.split('/workflow-reports/')[1] ?? '';
      const data = endpoint === 'material-request-candidates/page'
        ? {
            items: [{
              materialRequestId: 'mr-create-1',
              materialRequestCode: 'MR-DAV-20260618-FULLDAY',
              requestDate: '2026-06-18',
              requestScope: 'FULLDAY',
              status: 'APPROVED',
              actionableLineCount: 1,
              actionableQuantity: 15,
              hasExistingPurchaseRequest: false,
            }],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 8,
            totalPages: 1,
            hasPrev: false,
            hasNext: false,
            shortageCount: 1,
          }
        : endpoint.endsWith('/page')
          ? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }
          : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data }),
      });
    });
    await page.route('**/api/purchase-requests**', async (route) => {
      const isPage = new URL(route.request().url()).pathname.endsWith('/page');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: isPage
            ? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }
            : [],
        }),
      });
    });
    await page.route('**/api/suppliers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: [] }) });
    });
    await page.route('**/api/purchase-workflow/from-demand', async (route) => {
      expect(await route.request().postDataJSON()).toEqual({ materialRequestId: 'mr-create-1' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Tạo đề xuất mua hàng thành công.',
          data: {
            purchaseRequestId: 'pr-create-1',
            purchaseRequestCode: 'PR-20260618-FULLDAY',
            materialRequestId: 'mr-create-1',
            purchaseForDate: '2026-06-18',
            status: 'DRAFT',
            lines: [],
          },
        }),
      });
    });
    await page.route('**/api/purchase-workflow/workbench**', async (route) => {
      const serviceDate = phase09Workbench.serviceDates[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            ...phase09Workbench,
            weekStart: '2026-06-15',
            weekEnd: '2026-06-21',
            selectedDate: '2026-06-18',
            selectedStage: 'demand',
            serviceDates: [{
              ...serviceDate,
              serviceDate: '2026-06-18',
              currentStage: 'demand',
              purchaseRequestId: null,
              purchaseRequestCode: null,
              purchaseRequestStatus: null,
              orderCount: 0,
              receivingLineCount: 0,
              fullyReceivedLineCount: 0,
              approvedDemands: [{
                materialRequestId: 'mr-create-1',
                requestCode: 'MR-DAV-20260618-FULLDAY',
                serviceDate: '2026-06-18',
                scope: 'FULLDAY',
                status: 'APPROVED',
                shortageLineCount: 1,
                currentStage: 'demand',
                purchaseRequestId: null,
                purchaseRequestCode: null,
                purchaseRequestStatus: null,
              }],
              purchaseLines: [],
            }],
          },
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto(`${ROUTES.PURCHASING}?week=2026-06-15&date=2026-06-18&stage=demand`);

    await page.getByLabel('Nhu cầu nguyên liệu đã duyệt').selectOption('mr-create-1');
    await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Tạo đề xuất mua', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo đề xuất mua' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Tạo đề xuất mua' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'PR-20260618-FULLDAY' })).toBeVisible();
  });

  test('approval inbox executes approve decision with reason', async ({ page }) => {
    await stubApprovalDecisionSuccess(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.APPROVALS);

    await expect(page.getByText('PR-20260615-FULLDAY').first()).toBeVisible();
    await page.getByRole('button', { name: 'Duyệt' }).first().click();
    await expect(page.getByRole('heading', { name: 'Duyệt chứng từ?' })).toBeVisible();
    await page.getByLabel('Ghi chú duyệt (tùy chọn)').fill('Đồng ý mua');
    await page.getByRole('dialog', { name: 'Duyệt chứng từ?' }).getByRole('button', { name: 'Duyệt chứng từ' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã duyệt chứng từ' })).toBeVisible();
  });

  test('approval inbox loads the next server cursor page', async ({ page }) => {
    await stubApprovalDecisionSuccess(page);
    const approvalRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/approvals/inbox')) approvalRequests.push(request.url());
    });
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.APPROVALS);

    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect.poll(() => approvalRequests.some((url) => url.includes('cursor=cursor-2'))).toBe(true);
  });

  for (const viewport of [
    { name: 'tablet', width: 768, height: 960 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`approve, warehouse issue, and kitchen signoff work at ${viewport.name}`, async ({ page }) => {
      await stubMobileOperationsSuccess(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);

      await page.goto(ROUTES.APPROVALS);
      await page.getByRole('button', { name: 'Duyệt' }).first().click();
      await page.getByLabel('Ghi chú duyệt (tùy chọn)').fill('Đồng ý trên thiết bị');
      await page.getByRole('dialog', { name: 'Duyệt chứng từ?' }).getByRole('button', { name: 'Duyệt chứng từ' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Đã duyệt chứng từ' })).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto(ROUTES.WAREHOUSE);
      await page.getByRole('button', { name: 'Tạo phiếu xuất kho' }).click();
      await expect(page.getByRole('dialog', { name: 'Tạo phiếu xuất kho' })).toBeVisible();
      await page.getByRole('combobox', { name: 'Chọn nhu cầu nguyên liệu' }).click();
      await page.getByRole('option', { name: /MR-20260709-MOBILE/ }).click();
      await page.getByRole('combobox', { name: 'Chọn kho xuất' }).click();
      await page.getByRole('option', { name: 'Kho chính' }).click();
      await page.getByRole('button', { name: 'Xác nhận xuất 1 dòng' }).click();
      await expect(page.getByText('Đã tạo phiếu xuất kho').first()).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto(ROUTES.CHEF_DASHBOARD);
      await expect(page.getByText('KHSX-20260709-MOBILE').first()).toBeVisible();
      await expect(page.getByText('Bún bò').first()).toBeVisible();
      await expect(page.getByText('30k / Dùng chung')).toBeVisible();
      await expect(page.getByText('Đã gửi bếp', { exact: true })).toBeVisible();
      await page.getByRole('checkbox', { name: 'Ký nhận Sườn heo' }).click();
      await page.getByRole('dialog', { name: 'Xác nhận đã nhận nguyên liệu' }).getByRole('button', { name: 'Đã kiểm đếm và nhận' }).click();
      await expect(page.getByText('Đã ký nhận nguyên liệu')).toBeVisible();
      await expectNoPageOverflow(page);
    });
  }
});
