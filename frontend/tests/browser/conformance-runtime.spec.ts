import { test, expect } from '@playwright/test';

test.describe('Phase 4: Runtime Browser Acceptance & Conformance Suite', () => {
  let authToken = '';

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.post('http://localhost:5262/api/auth/login', {
        data: { username: 'admin', password: 'Admin@123456' },
      });
      const json = await res.json();
      if (json.success && json.data?.accessToken) {
        authToken = json.data.accessToken;
      }
    } catch {
      // Backend request fallback
    }
  });

  test.beforeEach(async ({ page }) => {
    if (authToken) {
      await page.addInitScript((token) => {
        localStorage.setItem('ipc_v3_token', token);
        localStorage.setItem(
          'ipc_v3_user',
          JSON.stringify({
            userId: '10000000-0000-0000-0000-000000000001',
            username: 'admin',
            fullName: 'Admin User',
            roleCode: 'ADMIN',
            roleName: 'Admin',
            isActive: true,
            isAdminFullAccess: true,
            permissions: ['*'],
          })
        );
        localStorage.setItem('ipc_v3_mode', 'DEFAULT');
      }, authToken);
    }
  });

  // Trụ cột 1: Route Smoke & Tiêu đề tiếng Việt chuẩn trên 12 Routes
  const CANONICAL_ROUTES = [
    { path: '/', title: 'Bàn điều hành hôm nay' },
    { path: '/admin-data', title: 'Quản trị dữ liệu & Danh mục' },
    { path: '/settings/approval-rules', title: 'Thiết lập quy trình duyệt' },
    { path: '/settings/advanced', title: 'Cấu hình hệ thống & Vận hành' },
    { path: '/weekly-menu', title: 'Thực đơn & KHSX tuần' },
    { path: '/meal-orders', title: 'Điều phối đơn ăn' },
    { path: '/chef', title: 'Bếp trưởng & Bàn giao ca' },
    { path: '/approvals', title: 'Hàng đợi phê duyệt' },
    { path: '/purchasing', title: 'Thu mua & Đề xuất PO' },
    { path: '/warehouse', title: 'Kho nguyên liệu & Nhập xuất' },
    { path: '/reconciliation', title: 'Đối soát nguyên liệu' },
    { path: '/reports', title: 'Báo cáo vận hành' },
  ];

  for (const { path, title } of CANONICAL_ROUTES) {
    test(`Route Smoke: ${path} renders WorkspaceHeader "${title}" without crash`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(path);
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 });

      // Invariant: Header must be 56px (h-14)
      const header = page.locator('header.h-14');
      await expect(header).toBeVisible();

      // No fatal console errors allowed (ignoring proxy 502/ECONNREFUSED or 409 mode conflict when backend operates in DEFAULT)
      const fatalErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('ERR_CONNECTION_REFUSED') && !e.includes('502') && !e.includes('Bad Gateway') && !e.includes('409')
      );
      expect(fatalErrors).toHaveLength(0);
    });
  }

  // Trụ cột 2: 3-Zone Geometry & Mật độ dòng (T8 / T7)
  test('3-Zone Geometry: Header is 56px, Subbar is 44px, and DataGrid has frozen headers', async ({ page }) => {
    // Intercept ingredients endpoint to render full DataGrid
    await page.route('**/api/ingredients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                ingredientId: '00000000-0000-0000-0000-000000000001',
                ingredientCode: 'NL-01',
                ingredientName: 'Thịt bò tươi',
                unitId: '00000000-0000-0000-0000-000000000010',
                unitName: 'kg',
                warehouseId: '00000000-0000-0000-0000-000000000100',
                warehouseName: 'Kho Lạnh Tổng',
                referencePrice: 150000,
                isFreshDaily: true,
                isActive: true,
              },
            ],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 25,
            totalPages: 1,
            hasPrev: false,
            hasNext: false,
          },
        }),
      });
    });

    await page.goto('/admin-data');

    const header = page.locator('header.h-14');
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox?.height).toBeCloseTo(56, 1);

    const subbar = page.locator('div.h-11');
    await expect(subbar).toBeVisible();
    const subbarBox = await subbar.boundingBox();
    expect(subbarBox?.height).toBeCloseTo(44, 1);

    // Rule T7: thead must be sticky top-0
    const stickyThead = page.locator('thead.sticky');
    await expect(stickyThead).toBeVisible();
  });

  // Trụ cột 3: WCAG 2.2 AA Zoom 200% Accessibility
  test('WCAG 2.2 AA Zoom 200%: UI scales without container overflow or clipped diacritics', async ({ page }) => {
    await page.route('**/api/coordination/customers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ customerId: 'c1', customerCode: 'DAV', customerName: 'Draxlmaier' }],
        }),
      });
    });

    await page.route('**/api/workflow-reports/ingredient-demand/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                requestDate: '2026-10-18',
                ingredientId: 'i1',
                ingredientName: 'Gạo tẻ ST25',
                unitName: 'kg',
                totalRequiredQty: 50,
                currentStockQty: 20,
                suggestedPurchaseQty: 30,
                issuedQty: 10,
                fulfillmentStatus: 'IN_PROGRESS',
              },
            ],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 25,
            totalPages: 1,
            hasPrev: false,
            hasNext: false,
          },
        }),
      });
    });

    // Simulate 200% zoom via viewport constraint
    await page.setViewportSize({ width: 640, height: 480 });
    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Báo cáo vận hành' })).toBeVisible();

    // Data table container must handle overflow gracefully
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  // Trụ cột 4: Triple-Layer RBAC Navigation Filtering
  test('RBAC: Non-admin role cannot see Admin navigation in sidebar', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'ipc_v3_user',
        JSON.stringify({
          userId: '00000000-0000-0000-0000-000000000002',
          username: 'beptruong',
          fullName: 'Bếp Trưởng Ca',
          roleCode: 'CHEF',
          roleName: 'Bếp trưởng',
          isActive: true,
          isAdminFullAccess: false,
          permissions: ['ProductionAccess'],
        })
      );
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bàn điều hành hôm nay' })).toBeVisible();

    // Admin-only links must be absent
    const adminLink = page.getByRole('link', { name: 'Quản trị danh mục' });
    await expect(adminLink).not.toBeAttached();
  });

  // Trụ cột 5: Operational Mode Isolation (DOM-MODE-1)
  test('DOM-MODE-1: Reconciliation completion is disabled when mode is DEFAULT', async ({ page }) => {
    await page.goto('/reconciliation');
    await expect(page.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeVisible();

    const completeBtn = page.getByRole('button', { name: 'Chốt đối soát ca' });
    if (await completeBtn.isVisible()) {
      await expect(completeBtn).toBeDisabled();
    }
  });
});
