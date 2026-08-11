import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/lib/routeConfig';
import { PHASE09_DATE, PHASE09_WEEK, stubPhase09Api } from './phase9-test-fixture';
import { stubWorkflowReports } from './support/route-smoke/reports';

const protectedRoutes = [
  { path: ROUTES.DASHBOARD, heading: 'Bàn điều hành hôm nay' },
  { path: ROUTES.WEEKLY_MENU, heading: 'KHSX và định lượng' },
  { path: ROUTES.MEAL_ORDERS, heading: 'Điều phối suất ăn' },
  { path: ROUTES.CHEF_DASHBOARD, heading: 'Bếp sản xuất' },
  { path: ROUTES.REPORTS, heading: 'Báo cáo vận hành' },
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
      roleCode: 'ADMIN',
      roleName: 'Admin',
      isAdminFullAccess: true,
      permissions: ['*'],
    });
  });
  await page.route('**/api/approvals/inbox**', async (route) => fulfillJson(route, {
    items: [], limit: 20, hasNext: false, nextCursor: null,
  }));
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
  await page.route('**/api/admin/employees/roles', async (route) => fulfillJson(route, []));
  await page.route('**/api/ingredients**', async (route) => fulfillJson(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 500,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));
  await page.route('**/api/workflow-reports/**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-requests**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-orders**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-orders/page**', async (route) => fulfillJson(route, {
    page: {
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 8,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    },
    orderCountByRequest: {},
  }));
  await page.route('**/api/inventory-receipts**', async (route) => fulfillJson(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 20,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));
  await page.route('**/api/service-runs/page**', async (route) => fulfillJson(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 20,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));
  await page.route('**/api/workflow-reports/current-stock/page**', async (route) => fulfillJson(route, {
    items: [{
      warehouseId: 'warehouse-main',
      warehouseName: 'Kho chính',
      ingredientId: 'ingredient-rice',
      ingredientName: 'Gạo tẻ',
      unitId: 'unit-kg',
      unitName: 'kg',
      currentQty: 240,
      lastUpdated: '2026-07-22T07:00:00Z',
    }],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 8,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  }));
  await page.route('**/api/warehouses/selector**', async (route) => fulfillJson(route, [{
    warehouseId: 'warehouse-main',
    warehouseCode: 'MAIN',
    warehouseName: 'Kho chính',
  }]));
  await page.route('**/api/dishes/catalog**', async (route) => fulfillJson(route, []));
  await page.route('**/api/suppliers**', async (route) => fulfillJson(route, []));
  await page.route('**/api/supplier-quotations/**', async (route) => fulfillJson(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 8,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));
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

async function stubWeeklyMenuGroupedPlan(page: Page) {
  const committedRows = [
    { serviceDate: '2026-07-06', dayKey: 't2', sourceRowNumber: 1, sourceColumn: 'B', sourceSection: 'Mặn', sourceShift: 'Ca sáng', dbShiftName: 'MORNING', variant: 'savory', slot: 'main', slotLabel: 'Món chính', dishName: 'Cơm sườn', rowSpan: 1, isMergedContinuation: false, existingDish: true },
    { serviceDate: '2026-07-07', dayKey: 't3', sourceRowNumber: 2, sourceColumn: 'C', sourceSection: 'Mặn', sourceShift: 'Ca sáng', dbShiftName: 'MORNING', variant: 'savory', slot: 'main', slotLabel: 'Món chính', dishName: 'Bún bò', rowSpan: 1, isMergedContinuation: false, existingDish: true },
  ];

  await page.route('**/api/coordination/weekly-menu**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/import-history')) {
      await fulfillJson(route, []);
      return;
    }

    await fulfillJson(route, {
      committed: true,
      fileName: 'weekly-menu.xlsx',
      customerId: 'customer-dav',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      weekStartDate: '2026-07-06',
      weekEndDate: '2026-07-11',
      detectedLayout: { sheetName: 'Menu', labelColumn: 'A', dayColumns: [], sections: [], rowsScanned: 2, rowsImported: 2, rowsSkipped: 0 },
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
      rows: committedRows,
      previewDiff: { addedSlots: 0, changedSlots: 0, removedSlots: 0, unchangedSlots: 2, rows: [] },
      importedWeeklyMenu: {},
    });
  });

  await page.route('**/api/production-plans/filter**', async (route) => {
    const serviceDate = new URL(route.request().url()).searchParams.get('serviceDate');
    const lineCount = serviceDate === '2026-07-06' ? 1 : serviceDate === '2026-07-07' ? 6 : 0;
    if (lineCount === 0) {
      await fulfillJson(route, []);
      return;
    }

    await fulfillJson(route, [{
      planId: `plan-${serviceDate}`,
      planCode: serviceDate === '2026-07-06' ? 'KHSX-NHOM-01' : 'KHSX-NHOM-02',
      planDate: serviceDate,
      customerId: 'customer-dav',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      status: 'DRAFT',
      lines: Array.from({ length: lineCount }, (_, index) => ({
        planLineId: `line-${serviceDate}-${index + 1}`,
        dishName: `Món kiểm thử ${index + 1}`,
        shiftName: index % 2 === 0 ? 'MORNING' : 'AFTERNOON',
        totalServings: 100 + index,
      })),
    }]);
  });

  await page.route('**/api/material-demand/staleness**', async (route) => {
    await fulfillJson(route, {
      hasExistingPlan: false,
      isStale: false,
      lastGeneratedAt: null,
      reasons: [],
    });
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
    fulfillJson(route, {
      items: [{
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
      }],
      limit: 20,
      hasNext: false,
      nextCursor: null,
    }),
  );
  await page.route('**/api/workflow-reports/workflow-documents**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-requests**', async (route) => fulfillJson(route, []));
  await page.route('**/api/approval-history/**', async (route) => fulfillJson(route, []));
}

async function stubApprovalRules(page: Page) {
  await page.route('**/api/approval-rules**', async (route) =>
    fulfillJson(route, [{
      ruleId: 'rule-copy-control',
      ruleName: 'Duyệt đơn mua thêm',
      documentType: 'purchase-request',
      minAmount: null,
      maxAmount: null,
      slaHours: 24,
      isActive: true,
      approvalassignments: [{
        assignmentId: 'assignment-copy-control',
        sequence: 1,
        approverRole: 'quanly',
        approverUserId: null,
        isRequired: true,
      }],
    }]),
  );
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'control-surface-admin',
      username: 'admin',
      fullName: 'Admin User',
      role: 'admin',
      roleCode: 'ADMIN',
      roleName: 'Admin',
      isAdminFullAccess: true,
      permissions: ['*'],
    }));
  });
  await page.goto(ROUTES.DASHBOARD);
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

  test('approval rules translates technical keys into user-facing labels', async ({ page }) => {
    await stubApprovalRules(page);
    await page.goto(ROUTES.APPROVAL_RULES);

    await expect(page.getByText('Loại chứng từ:').locator('..')).toContainText('Đơn mua thêm');
    await expect(page.getByText('Thời hạn xử lý (SLA):').locator('..')).toContainText('24 giờ');
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
    await expect(page.getByText('purchase-request', { exact: true })).toHaveCount(0);
    await expect(page.getByText('quanly', { exact: true })).toHaveCount(0);
  });

  test('approval rule form stacks primary fields on narrow mobile screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(ROUTES.APPROVAL_RULES);
    await page.getByRole('button', { name: 'Thêm quy tắc' }).click();

    const dialog = page.getByRole('dialog', { name: 'Tạo quy tắc duyệt mới' });
    const formGrid = dialog.locator('.ipc-approval-rule-form-grid');
    const positions = await formGrid.locator(':scope > div').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: Math.round(rect.left), width: Math.round(rect.width) };
      }),
    );
    expect(positions).toHaveLength(2);
    expect(Math.abs(positions[0].left - positions[1].left)).toBeLessThanOrEqual(1);
    expect(positions.every((position) => position.width > 240)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('reports filters keep a consistent two-column mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubWorkflowReports(page);
    await page.goto(ROUTES.REPORTS);

    await expect(page.locator('.ipc-page-title')).toHaveText('Báo cáo vận hành');
    await expect(page.getByLabel('Từ ngày')).toBeVisible();
    await expect(page.getByLabel('Đến ngày')).toBeVisible();
    await expect(page.getByLabel('Ca')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xuất báo cáo' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole('tab', { name: 'Chất lượng dữ liệu', exact: true }).click();
    await expect(page.getByText('Tổng vấn đề', { exact: true })).toBeVisible();
    await expect(page.getByText('Vấn đề ưu tiên SLA', { exact: true })).toBeVisible();
    await expect(page.getByText('Tổng issue', { exact: true })).toHaveCount(0);
  });

  test('reports wide tables scroll inside their viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubWorkflowReports(page);
    await page.goto(ROUTES.REPORTS);

    const tableViewport = page.locator('.ipc-report-table-shell');
    const table = tableViewport.locator('table').first();
    await expect(tableViewport).toBeVisible();
    await expect(table.locator('tbody tr')).not.toHaveCount(0);
    await expect(table).toHaveCSS('min-width', '720px');
    const geometry = await tableViewport.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('reports price variance supports query-first discovery and a readable warning action', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const priceRequests: URL[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/workflow-reports/receipt-price-variance/page')) {
        priceRequests.push(url);
      }
    });
    await stubWorkflowReports(page);
    await page.goto(ROUTES.REPORTS);

    const search = page.getByLabel('Tìm theo nguyên liệu, nhà cung cấp hoặc mã phiếu nhập');
    const action = page.getByRole('button', { name: 'Xem đề xuất xử lý cho Sườn heo' });
    await expect(search).toBeVisible();
    await expect(action).toBeVisible();
    await action.focus();
    await expect(action).toBeFocused();
    await expect(action).toHaveAttribute('aria-controls', 'reports-price-warning-detail');
    await expect(action).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#reports-price-warning-detail')).toHaveCount(0);
    const actionGeometry = await action.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }));
    expect(actionGeometry.whiteSpace).toBe('nowrap');
    expect(actionGeometry.scrollWidth).toBeLessThanOrEqual(actionGeometry.clientWidth + 1);

    await action.click();
    const warningDetail = page.locator('#reports-price-warning-detail');
    await expect(action).toHaveAttribute('aria-expanded', 'true');
    await expect(warningDetail).toContainText('Sườn heo');
    await expect(warningDetail).toBeFocused();
    await action.click();
    await expect(action).toHaveAttribute('aria-expanded', 'false');
    await expect(warningDetail).toHaveCount(0);
    await expect(action).toBeFocused();
    await search.fill('Sườn heo');
    await expect.poll(() => priceRequests.some((url) => url.searchParams.get('searchKeyword') === 'Sườn heo')).toBe(true);
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
    await expect(page.locator('.ipc-coordination-empty-state')).toHaveCSS('min-height', '0px');
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

  test('purchasing actions remain reachable on mobile without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubPhase09Api(page);
    await login(page);
    await page.goto(`${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`);

    const actionGroup = page.locator('.ipc-purchasing-actions');
    await expect(actionGroup).toBeVisible();
    for (const name of ['Tuần trước', 'Tuần hiện tại', 'Tuần sau', 'Mở màn hình nhập kho']) {
      await expect(actionGroup.getByRole('button', { name })).toBeVisible();
    }
    const controlHeights = await actionGroup.getByRole('button').evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(controlHeights.every((height) => height >= 44)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('purchasing six-stage guide keeps labels readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubPhase09Api(page);
    await login(page);
    await page.goto(`${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`);

    const guide = page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('button')).toHaveCount(6);
    const labels = await guide.locator('[data-stage-label]').evaluateAll((elements) =>
      elements.map((element) => {
        const style = window.getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(style.lineHeight),
          clipped: element.scrollWidth > element.clientWidth + 1,
        };
      }),
    );
    expect(labels.every(({ height, lineHeight, clipped }) => height <= lineHeight * 2 + 1 && !clipped)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('purchasing wide tables scroll inside their viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubPhase09Api(page);
    await login(page);
    await page.goto(`${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`);

    const tableViewport = page.getByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' });
    const table = tableViewport.locator('table').first();
    await expect(tableViewport).toBeVisible();
    await expect(table.locator('tbody tr')).not.toHaveCount(0);
    await expect(table).toHaveCSS('min-width', '900px');
    const geometry = await tableViewport.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('warehouse stock table scrolls inside its viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto(ROUTES.WAREHOUSE);

    const tableViewport = page.getByRole('region', { name: 'Bảng tồn kho hiện tại trong kho' });
    const table = tableViewport.locator('table');
    await expect(tableViewport).toBeVisible();
    await expect(table.locator('tbody tr')).not.toHaveCount(0);
    await expect(table).toHaveCSS('min-width', '720px');
    const geometry = await tableViewport.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('weekly menu matrix keeps day columns readable inside its viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.WEEKLY_MENU);

    const tableViewport = page.locator('.ipc-weekly-menu-shell');
    const table = tableViewport.locator('.ipc-schedule-table');
    await expect(tableViewport).toBeVisible();
    await expect(table).toHaveCSS('min-width', '980px');
    const geometry = await tableViewport.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  for (const viewport of [
    { name: 'L-1280', width: 1280, height: 900, expectedTableHeight: 520 },
    { name: 'S-390', width: 390, height: 844, expectedTableHeight: 440 },
  ]) {
    test(`weekly menu grouped stepper keeps focus and table height at ${viewport.name}`, async ({ page }) => {
      await stubWeeklyMenuGroupedPlan(page);
      await page.evaluate(() => {
        window.localStorage.setItem('ipc.weeklyMenu.lastCustomerId', 'customer-dav');
        window.localStorage.setItem('ipc.weeklyMenu.lastWeekStartDate', '2026-07-06');
      });
      await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Thực đơn tuần' }).click();
      await page.setViewportSize(viewport);
      await page.getByRole('tab', { name: 'Kế hoạch sản xuất' }).click();

      const panel = page.locator('#production-plan-panel');
      const groupedStepper = panel.getByRole('navigation', { name: 'Điều hướng kế hoạch sản xuất' });
      const tableViewport = panel.locator('.ipc-production-plan-table');
      await expect(groupedStepper.getByText('Nhóm 1/2')).toBeVisible();
      await expect(panel.getByText('KHSX-NHOM-01')).toBeVisible();
      await expect(tableViewport).toHaveCSS('height', `${viewport.expectedTableHeight}px`);
      const firstHeight = await tableViewport.evaluate((element) => element.getBoundingClientRect().height);

      await groupedStepper.getByRole('button', { name: /Trang sau/ }).press('Enter');
      await expect(groupedStepper.getByText('Nhóm 2/2')).toBeVisible();
      await expect(panel.getByText('KHSX-NHOM-02')).toBeVisible();
      await expect(groupedStepper.getByRole('button', { name: /Trang trước/ })).toBeFocused();
      const secondHeight = await tableViewport.evaluate((element) => element.getBoundingClientRect().height);

      expect(Math.abs(secondHeight - firstHeight)).toBeLessThanOrEqual(1);
      await panel.screenshot({
        path: `../.planning/ui-reviews/pagination/after-improvements/weekly-menu-grouped-${viewport.name.toLowerCase()}.png`,
        animations: 'disabled',
      });
    });
  }

  test('admin data keeps import actions semantic and removes inactive command chrome', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.ADMIN_DATA);

    await expect(page.getByRole('button', { name: 'Kiểm tra file', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nhập dữ liệu', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gửi thông báo vận hành', exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('approval actions keep two compact rows on mobile without overflow', async ({ page }) => {
    await stubApprovalQueue(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.APPROVALS);

    const actionGroup = page.locator('.ipc-approval-actions');
    await expect(actionGroup).toBeVisible();
    await expect(page.getByRole('button', { name: 'Duyệt' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sang thu mua' })).toBeVisible();
    await expect(actionGroup.locator(':scope > div')).toHaveCount(2);
    const rowHeights = await actionGroup.locator(':scope > div').evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(rowHeights.every((height) => height > 0)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('approval document strip reserves its traced height while workflow documents settle', async ({ page }) => {
    let releaseWorkflowDocuments!: () => void;
    const workflowDocumentsPending = new Promise<void>((resolve) => {
      releaseWorkflowDocuments = resolve;
    });

    await stubApprovalQueue(page);
    await page.route('**/api/workflow-reports/workflow-documents**', async (route) => {
      await workflowDocumentsPending;
      await fulfillJson(route, []);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ROUTES.APPROVALS);

    const documentStrip = page.getByRole('complementary', { name: 'Chứng từ' });
    await expect(documentStrip).toBeVisible();
    await expect(documentStrip.getByText('Đang tải chứng từ workflow')).toBeVisible();
    const loadingHeight = await documentStrip.evaluate((element) => element.getBoundingClientRect().height);

    releaseWorkflowDocuments();
    await expect(documentStrip.getByText('Đang tải chứng từ workflow')).toBeHidden();
    const settledHeight = await documentStrip.evaluate((element) => element.getBoundingClientRect().height);

    expect(Math.min(loadingHeight, settledHeight)).toBeGreaterThanOrEqual(148);
  });

  test('weekly menu import and edit dialogs open, identify themselves, and close cleanly', async ({ page }) => {
    await page.goto(ROUTES.WEEKLY_MENU);

    const importTrigger = page.getByRole('button', { name: 'Nhập Excel' });
    const importViewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    await importTrigger.focus();
    await importTrigger.click();
    const importDialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' });
    await expect(importDialog).toBeVisible();
    await expect(importDialog).toHaveAttribute('aria-modal', 'true');
    await expect(importDialog.getByLabel('Khách hàng')).toBeVisible();
    await expect(importDialog.getByLabel('Định mức BOM')).toBeVisible();
    await expect(importDialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(importViewportWidth);
    await importDialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' }).click();
    await expect(importDialog).toBeHidden();
    await expect(importTrigger).toBeFocused();

    const editTrigger = page.getByRole('button', { name: 'Chỉnh sửa thực đơn' });
    await editTrigger.focus();
    await editTrigger.click();
    const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa thực đơn tuần' });
    await expect(editDialog).toBeVisible();
    await expect(editDialog).toHaveAttribute('aria-modal', 'true');
    await expect(editDialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' })).toBeVisible();
    await editDialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' }).click();
    await expect(editDialog).toBeHidden();
    await expect(editTrigger).toBeFocused();
  });

  test('meal order confirmation dialog stays top-level and keeps API errors visible', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-07-11T07:15:00+07:00') });
    await stubMealOrderDraftShift(page);
    await page.goto(ROUTES.MEAL_ORDERS);

    const lockButton = page.getByRole('button', { name: 'Chốt đơn cả ngày' });
    await expect(lockButton).toBeEnabled();
    await lockButton.click();

    const confirmDialog = page.getByRole('dialog', { name: 'Chốt đơn cả ngày?' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Hủy' })).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Chốt cả ngày' })).toBeVisible();

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

    const lockRequestPromise = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().includes('/api/coordination/orders/lock'),
    );
    await confirmDialog.getByRole('button', { name: 'Chốt cả ngày' }).click();
    const lockRequest = await lockRequestPromise;
    expect(lockRequest.postDataJSON()).toMatchObject({ scope: 'FULLDAY' });
    await expect(confirmDialog.getByRole('alert')).toContainText('Backend từ chối chốt ca do thiếu số suất thực tế.');
    await expect(confirmDialog).toBeVisible();
  });

  test('draft plans stay unlocked after cutoff until the user confirms FULLDAY lock', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-07-11T10:15:00+07:00') });
    await stubMealOrderDraftShift(page);
    await page.goto(ROUTES.MEAL_ORDERS);

    await expect(page.getByText('Cần chốt thủ công', { exact: true })).toBeVisible();
    await expect(page.getByText('Dữ liệu đang ở trạng thái nháp', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chốt đơn cả ngày' })).toBeEnabled();
    await expect(page.getByText('Ca này đã khóa', { exact: true })).toBeHidden();
  });

  test('empty shifts never expose lock, signoff, export, or adjustment actions after cutoff', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-07-11T10:15:00+07:00') });
    await page.goto(ROUTES.MEAL_ORDERS);

    await expect(page.getByText('Chưa có kế hoạch suất ăn', { exact: true })).toBeVisible();
    for (const name of ['Chốt đơn cả ngày', 'Hoàn tất ca', 'Xuất báo cáo']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Yêu cầu điều chỉnh' })).toHaveCount(0);
  });

  test('approval decision modal is addressable by role and name', async ({ page }) => {
    await stubApprovalQueue(page);
    await page.goto(ROUTES.APPROVALS);

    const approvalTrigger = page.getByRole('button', { name: 'Duyệt' }).first();
    await approvalTrigger.focus();
    await approvalTrigger.click();
    const approvalDialog = page.getByRole('dialog', { name: 'Duyệt chứng từ?' });
    await expect(approvalDialog).toBeVisible();
    await expect(approvalDialog).toHaveAttribute('aria-modal', 'true');
    await expect(approvalDialog.getByLabel('Ghi chú duyệt (tùy chọn)')).toBeVisible();
    await approvalDialog.getByRole('button', { name: 'Giữ chứng từ' }).click();
    await expect(approvalDialog).toBeHidden();
    await expect(approvalTrigger).toBeFocused();
  });
});
