import { expect, type Page } from '@playwright/test';

// phase18-body-start
export async function stubApprovalDecisionSuccess(page: Page) {
  await page.route('**/api/approvals/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: {
          items: [{
            inboxItemId: 'purchase-pr-1',
            targetType: 'purchase-request',
            targetId: 'pr-1',
            targetCode: 'PR-20260615-FULLDAY',
            itemType: 'purchase',
            title: 'Duyệt đơn mua',
            source: 'PR-20260615-FULLDAY',
            ownerRole: 'Thu mua / Quản lý',
            submittedBy: 'Đinh Thu Mua',
            dueDate: '2026-06-15',
            status: 'PENDING',
            reason: 'Đơn mua đã gửi, chờ duyệt trước khi mua hàng.',
            nextAction: 'Duyệt đơn mua',
            tone: 'warning',
            route: '/approvals',
            materials: [{ name: 'Sườn heo', quantity: 10, unit: 'kg' }],
          }],
          limit: 20,
          hasNext: true,
          nextCursor: 'cursor-2',
        },
      }),
    });
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/workflow-reports/')[1] ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: endpoint.endsWith('/page')
          ? { items: [], limit: 20, hasNext: false, nextCursorDate: null, nextCursorId: null }
          : [],
      }),
    });
  });

  await page.route('**/api/purchase-requests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/approvals/purchase-request/pr-1', async (route) => {
    const body = await route.request().postDataJSON();
    expect(body).toMatchObject({ status: 'Approve', reason: 'Đồng ý mua' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Thực hiện phê duyệt thành công.',
        data: {
          targetType: 'purchase-request',
          targetId: 'pr-1',
          status: 'APPROVE',
          oldStatus: 'SENTTOSUPPLIER',
          newStatus: 'APPROVED',
          historyId: 'hist-1',
          actionAt: '2026-07-02T13:00:00Z',
        },
      }),
    });
  });
}
