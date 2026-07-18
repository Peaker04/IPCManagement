import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

const protectedRoutes = [
  { path: ROUTES.DASHBOARD, heading: 'Bàn điều hành hôm nay' },
  { path: ROUTES.WEEKLY_MENU, heading: 'KHSX và định lượng' },
  { path: ROUTES.MEAL_ORDERS, heading: 'Điều phối suất ăn' },
  { path: ROUTES.CHEF_DASHBOARD, heading: 'Bếp sản xuất' },
  { path: ROUTES.REPORTS, heading: 'Phân tích biến động giá' },
  { path: ROUTES.APPROVALS, heading: 'Duyệt vận hành' },
  { path: ROUTES.PURCHASING, heading: 'Thu mua' },
  { path: ROUTES.WAREHOUSE, heading: 'Kho nguyên liệu' },
  { path: ROUTES.ADMIN_DATA, heading: 'Quản trị dữ liệu' },
] as const;

async function fulfillJson(route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data }),
  });
}

async function stubOperationalApis(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Playwright mock login fallback' }),
    });
  });
  await page.route('**/api/auth/profile', async (route) => {
    await fulfillJson(route, {
      userId: '1',
      username: 'admin',
      fullName: 'Admin User',
      roleName: 'Admin',
      isAdminFullAccess: true,
      permissions: ['*'],
    });
  });
  await page.route('**/api/approvals/inbox**', async (route) => fulfillJson(route, []));
  await page.route('**/api/approval-rules**', async (route) => fulfillJson(route, []));
  await page.route('**/api/admin/employees**', async (route) => fulfillJson(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 200,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));
  await page.route('**/api/workflow-reports/**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-requests**', async (route) => fulfillJson(route, []));
  await page.route('**/api/dishes/catalog**', async (route) => fulfillJson(route, []));
  await page.route('**/api/suppliers**', async (route) => fulfillJson(route, []));
  await page.route('**/api/production-plans/daily**', async (route) => fulfillJson(route, []));
  await page.route('**/api/coordination/customers', async (route) =>
    fulfillJson(route, [{ customerId: 'customer-dav', customerCode: 'DAV', customerName: 'Draxlmaier' }]),
  );
  await page.route('**/api/coordination/customer-contracts', async (route) =>
    fulfillJson(route, [
      {
        contractId: 'contract-dav',
        customerId: 'customer-dav',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        isActive: true,
        contractStatus: 'ACTIVE',
        menuScheduleCount: 0,
        activeWeekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        shiftNames: ['MORNING', 'AFTERNOON'],
        defaultMenuPrice: 25000,
        defaultBomRatePercent: 100,
      },
    ]),
  );
  await page.route('**/api/coordination/orders**', async (route) => fulfillJson(route, []));
  await page.route('**/api/coordination/menu-schedules**', async (route) => fulfillJson(route, []));
  await page.route('**/api/coordination/meal-quantity-plans**', async (route) => fulfillJson(route, []));
  await page.route('**/api/coordination/weekly-menu**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await fulfillJson(route, pathname.endsWith('/import-history') ? [] : null);
  });
}

async function stubMealOrderDraftShift(page: Page) {
  const orders = [
    {
      id: 'order-dav-morning',
      quantityPlanLineId: 'line-dav-morning',
      quantityPlanId: 'plan-dav-morning',
      customerId: 'customer-dav',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      mealType: 'Thực đơn DAV Ca sáng',
      forecastQuantity: 270,
      actualQuantity: 270,
      unitPrice: 25000,
      appliedRate: 100,
      specialNotes: 'Imported from weekly menu',
      serviceDate: '2026-07-11',
      dayOfWeek: 't7',
      shiftName: 'MORNING',
      shift: 'Ca Sáng',
      menuId: 'menu-dav-morning',
      menuCode: 'MENU-DAV-20260711-MORNING',
      menuName: 'Thực đơn DAV Ca sáng 11/07/2026',
      dishId: 'dish-egg',
      dishes: [
        { dishId: 'dish-egg', dishCode: 'DISH-EGG', dishName: 'TRỨNG LUỘC 40g' },
        { dishId: 'dish-rau', dishCode: 'DISH-RAU', dishName: 'RAU MUỐNG XÀO + MUỐI ĐẬU' },
        { dishId: 'dish-fruit', dishCode: 'DISH-FRUIT', dishName: 'Trái cây' },
      ],
    },
  ];

  await page.route('**/api/coordination/orders**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/orders/lock')) {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Backend từ chối chốt ca do thiếu số suất thực tế.',
          data: null,
        }),
      });
      return;
    }

    await fulfillJson(route, orders);
  });
  await page.route('**/api/coordination/menu-schedules**', async (route) =>
    fulfillJson(route, [
      {
        menuScheduleId: 'schedule-dav-morning',
        menuId: 'menu-dav-morning',
        menuCode: 'MENU-DAV-20260711-MORNING',
        menuName: 'Thực đơn DAV Ca sáng 11/07/2026',
        serviceDate: '2026-07-11',
        weekStartDate: '2026-07-06',
        shiftName: 'MORNING',
        shift: 'Ca Sáng',
        dayOfWeek: 't7',
        menuPrice: 25000,
        bomRatePercent: 100,
        status: 'DRAFT',
        dishes: [],
      },
    ]),
  );
  await page.route('**/api/coordination/meal-quantity-plans**', async (route) =>
    fulfillJson(route, [
      {
        quantityPlanId: 'plan-dav-morning',
        serviceDate: '2026-07-11',
        dayOfWeek: 't7',
        shiftName: 'MORNING',
        status: 'DRAFT',
      },
    ]),
  );
}

async function stubApprovalQueue(page: Page) {
  await page.route('**/api/approvals/inbox**', async (route) =>
    fulfillJson(route, [
      {
        inboxItemId: 'approval-pr-control',
        targetType: 'purchase-request',
        targetId: 'pr-control',
        targetCode: 'PR-CONTROL-01',
        itemType: 'purchase',
        title: 'Duyệt đơn mua nguyên liệu',
        source: 'PR-CONTROL-01',
        ownerRole: 'Quản lý',
        submittedBy: 'Điều phối ca sáng',
        dueDate: '2026-07-11',
        status: 'PENDING',
        reason: 'Đơn mua cần phê duyệt trước khi gửi nhà cung cấp.',
        nextAction: 'Duyệt',
        tone: 'warning',
        route: ROUTES.APPROVALS,
        materials: [{ name: 'Sườn heo', quantity: 15, unit: 'kg' }],
      },
    ]),
  );
  await page.route('**/api/workflow-reports/workflow-documents**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-requests**', async (route) => fulfillJson(route, []));
  await page.route('**/api/approval-history/**', async (route) => fulfillJson(route, []));
}

async function login(page: Page) {
  await page.goto(ROUTES.LOGIN);
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(ROUTES.DASHBOARD);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
}

async function expectVisibleControlsAreNamed(page: Page) {
  const unnamedControls = await page.evaluate(() => {
    const selectors = 'button, [role="button"], a.ipc-button';
    return Array.from(document.querySelectorAll<HTMLElement>(selectors))
      .map((element, index) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
        const label = [
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.textContent,
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          index,
          tag: element.tagName.toLowerCase(),
          className: element.className.toString(),
          isVisible,
          label,
        };
      })
      .filter((control) => control.isVisible && control.label.length === 0);
  });

  expect(unnamedControls).toEqual([]);
}

test.describe('operational control surface', () => {
  test.beforeEach(async ({ page }) => {
    await stubOperationalApis(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
  });

  test('all protected routes expose named visible controls', async ({ page }) => {
    for (const route of protectedRoutes) {
      await page.goto(route.path);
      await expect(page.locator('.ipc-page-title')).toHaveText(route.heading);
      await expectVisibleControlsAreNamed(page);
    }
  });

  test('approval rules keeps its page anatomy and controls reachable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(ROUTES.APPROVAL_RULES);

    await expect(page.getByRole('heading', { name: 'Quy tắc phê duyệt', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm quy tắc' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Thêm quy tắc' }).click();
    await expect(page.getByRole('dialog', { name: 'Tạo quy tắc duyệt mới' })).toBeVisible();
  });

  test('reports filters keep a consistent two-column mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.REPORTS);

    await expect(page.getByRole('heading', { name: 'Phân tích biến động giá', exact: true })).toBeVisible();
    await expect(page.getByLabel('Từ ngày')).toBeVisible();
    await expect(page.getByLabel('Đến ngày')).toBeVisible();
    await expect(page.getByLabel('Ca')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xuất báo cáo' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('chef empty state does not reserve a desktop-sized gap before the shift journal', async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto(ROUTES.CHEF_DASHBOARD);

    const emptyState = page.locator('.ipc-chef-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveCSS('min-height', '0px');
    await expect(page.getByText('Nhật ký ca', { exact: true })).toBeVisible();
  });

  test('meal coordination empty state does not reserve desktop height on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.MEAL_ORDERS);

    await expect(page.getByText('Chưa có dữ liệu để hiển thị', { exact: true })).toBeVisible();
    await expect(page.locator('.ipc-coordination-workbench')).toHaveCSS('min-height', '0px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('warehouse actions use equal-width mobile controls without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.WAREHOUSE);

    const actionGroup = page.locator('.ipc-warehouse-actions');
    await expect(actionGroup).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo phiếu xuất kho' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bàn giao cho bếp' })).toBeVisible();
    const widths = await actionGroup.locator(':scope > div:last-child > *').evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().width)),
    );
    expect(widths.length).toBe(3);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('weekly menu import and edit dialogs open, identify themselves, and close cleanly', async ({ page }) => {
    await page.goto(ROUTES.WEEKLY_MENU);

    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    const importDialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' });
    await expect(importDialog).toBeVisible();
    await expect(importDialog.getByLabel('Khách hàng')).toBeVisible();
    await expect(importDialog.getByLabel('Định mức BOM')).toBeVisible();
    await expect(importDialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' })).toBeVisible();
    await importDialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' }).click();
    await expect(importDialog).toBeHidden();

    await page.getByRole('button', { name: 'Chỉnh sửa thực đơn' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa thực đơn tuần' });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' })).toBeVisible();
    await editDialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' }).click();
    await expect(editDialog).toBeHidden();
  });

  test('meal order confirmation dialog stays top-level and keeps API errors visible', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-07-11T07:15:00+07:00') });
    await stubMealOrderDraftShift(page);
    await page.goto(ROUTES.MEAL_ORDERS);

    const lockButton = page.getByRole('button', { name: 'Chốt đơn ca này' });
    await expect(lockButton).toBeEnabled();
    await lockButton.click();

    const confirmDialog = page.getByRole('dialog', { name: 'Chốt đơn ca này?' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Hủy' })).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Chốt đơn ca' })).toBeVisible();

    const isInsideToolbar = await confirmDialog.evaluate((element) =>
      Boolean(element.closest('.ipc-order-action-toolbar')),
    );
    expect(isInsideToolbar).toBe(false);

    const box = await confirmDialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(24);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height - 24);

    await confirmDialog.getByRole('button', { name: 'Chốt đơn ca' }).click();
    await expect(confirmDialog.getByRole('alert')).toContainText('Backend từ chối chốt ca do thiếu số suất thực tế.');
    await expect(confirmDialog).toBeVisible();
  });

  test('approval decision modal is addressable by role and name', async ({ page }) => {
    await stubApprovalQueue(page);
    await page.goto(ROUTES.APPROVALS);

    await page.getByRole('button', { name: 'Duyệt' }).first().click();
    const approvalDialog = page.getByRole('dialog', { name: 'Xác nhận duyệt chứng từ' });
    await expect(approvalDialog).toBeVisible();
    await expect(approvalDialog.getByLabel('Ghi chú duyệt (tùy chọn)')).toBeVisible();
    await approvalDialog.getByRole('button', { name: 'Hủy' }).click();
    await expect(approvalDialog).toBeHidden();
  });
});
