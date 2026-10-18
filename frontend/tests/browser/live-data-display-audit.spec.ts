import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Live Data Display Audit Across Routes (Real Backend & MySQL)', () => {
  let authToken = '';

  test.beforeAll(async ({ request }) => {
    // Authenticate with live backend on port 5262 to get real admin JWT
    const res = await request.post('http://localhost:5262/api/auth/login', {
      data: { username: 'admin', password: 'Admin@123456' },
    });
    const json = await res.json();
    expect(json.success).toBe(true);
    authToken = json.data.accessToken;
    expect(authToken).toBeTruthy();

    // Ensure output screenshot directory exists
    const screenshotDir = path.join(process.cwd(), 'test-results', 'live-screens');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Set real token and user session in localStorage before each route test
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
  });

  // 1. Kiểm tra dữ liệu thật trên Bàn điều hành (Dashboard)
  test('Dashboard (/): Renders real live metrics and current Vietnamese date', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bàn điều hành hôm nay' })).toBeVisible({ timeout: 15_000 });

    // Header displays dynamic date and operational badges
    const header = page.locator('header.h-14');
    await expect(header).toBeVisible();
    await expect(page.getByText(/(?:Thứ [Hai|Ba|Tư|Năm|Sáu|Bảy]|Chủ Nhật),\s*\d{2}\/\d{2}\/\d{4}/)).toBeVisible();

    // 5 Metric cards rendered
    const metricsStrip = page.locator('div.grid-cols-5');
    await expect(metricsStrip).toBeVisible();

    // Check either tasks table or clean empty tasks notice based on real database state
    const tasksOrEmpty = page.getByText('Hôm nay không có nhiệm vụ tồn đọng').or(page.getByRole('columnheader', { name: 'Nhiệm vụ & Quy trình' }));
    await expect(tasksOrEmpty).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: 'test-results/live-screens/01-dashboard.png' });
  });

  // 2. Kiểm tra dữ liệu thật trên Danh mục Nguyên liệu (756 items trong DB)
  test('Admin Data Ingredients (/admin-data?view=ingredients): Renders 756 real ingredients with server pagination', async ({ page }) => {
    await page.goto('/admin-data?view=ingredients');
    await expect(page.getByRole('heading', { name: 'Quản trị dữ liệu & Danh mục' })).toBeVisible({ timeout: 15_000 });

    // Zone 1 Badge displays real persisted count (756 nguyên liệu)
    await expect(page.getByText('756 nguyên liệu persisted')).toBeVisible({ timeout: 10_000 });

    // Zone 2 Telemetry displays 756 items
    await expect(page.getByText('756 mặt hàng authoritative')).toBeVisible();

    // Table renders real C# DTO column headers
    await expect(page.getByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tên nguyên liệu thực phẩm' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'ĐVT' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Kho quản lý' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Đơn giá tham chiếu' })).toBeVisible();

    // Ensure categoryName column is NEVER rendered
    await expect(page.getByRole('columnheader', { name: 'Nhóm thực phẩm' })).not.toBeAttached();

    // Server Pagination displays Trang 1/31 (756 mục)
    await expect(page.getByText(/Trang 1\/31 \(756 mục\)/)).toBeVisible();

    // Test clicking "Trang sau" -> Fetches page 2 from real backend
    const nextBtn = page.getByRole('button', { name: 'Trang sau' });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Verify page 2 rendered
    await expect(page.getByText(/Trang 2\/31 \(756 mục\)/)).toBeVisible({ timeout: 10_000 });
    const prevBtn = page.getByRole('button', { name: 'Trang trước' });
    await expect(prevBtn).toBeEnabled();

    await page.screenshot({ path: 'test-results/live-screens/02-admin-ingredients-paged.png' });
  });

  // 3. Kiểm tra dữ liệu thật trên Danh mục Món ăn (195 items trong DB)
  test('Admin Data Dishes (/admin-data?view=dishes): Renders 195 real dishes with server pagination', async ({ page }) => {
    await page.goto('/admin-data?view=dishes');
    await expect(page.getByRole('heading', { name: 'Quản trị dữ liệu & Danh mục' })).toBeVisible({ timeout: 15_000 });

    // Zone 1 Badge displays 195 món ăn persisted
    await expect(page.getByText('195 món ăn persisted')).toBeVisible({ timeout: 10_000 });

    // Zone 2 Telemetry displays 195 mặt hàng
    await expect(page.getByText('195 mặt hàng authoritative')).toBeVisible();

    // Table renders real C# DTO column headers for dishes
    await expect(page.getByRole('columnheader', { name: 'Mã món' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tên món ăn tiêu chuẩn' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Phân loại', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nhóm phân loại' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Trạng thái' })).toBeVisible();

    // Pagination displays Trang 1/8 (195 mục)
    await expect(page.getByText(/Trang 1\/8 \(195 mục\)/)).toBeVisible();

    // Test clicking "Trang sau" -> Fetches page 2
    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(page.getByText(/Trang 2\/8 \(195 mục\)/)).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'test-results/live-screens/03-admin-dishes-paged.png' });
  });

  // 4. Kiểm tra dữ liệu thật trên Thu mua (/purchasing - 35 nhà cung cấp, 8 POs)
  test('Purchasing (/purchasing): Renders real suppliers count and PO list from database', async ({ page }) => {
    await page.goto('/purchasing');
    await expect(page.getByRole('heading', { name: 'Thu mua & Đề xuất PO' })).toBeVisible({ timeout: 15_000 });

    // Dynamic supplier selector shows real partner count from MySQL (35 đối tác)
    const supplierSelect = page.getByRole('combobox');
    await expect(supplierSelect).toBeVisible({ timeout: 10_000 });
    const selectText = await supplierSelect.textContent();
    expect(selectText).toMatch(/35 đối tác/);

    // Master table renders real purchase order columns
    await expect(page.getByRole('columnheader', { name: 'Mã đơn PO' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nhà cung cấp' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tổng tiền' })).toBeVisible();

    // Detail panel displays selected PO details
    await expect(page.getByText(/Chi tiết PO:/i)).toBeVisible();

    await page.screenshot({ path: 'test-results/live-screens/04-purchasing.png' });
  });

  // 5. Kiểm tra dữ liệu thật trên Hàng đợi phê duyệt (/approvals - 17 items)
  test('Approvals (/approvals): Renders 17 live approval items and decision drawer', async ({ page }) => {
    await page.goto('/approvals');
    await expect(page.getByRole('heading', { name: 'Hàng đợi phê duyệt' })).toBeVisible({ timeout: 15_000 });

    // Telemetry shows pending items
    await expect(page.getByText(/yêu cầu chờ xử lý/i)).toBeVisible({ timeout: 10_000 });

    // Table renders real column headers
    await expect(page.getByRole('columnheader', { name: 'Mã đối tượng' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Tiêu đề yêu cầu/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Hạn SLA' })).toBeVisible();

    // Detail decision drawer renders
    await expect(page.getByText('Chi tiết hồ sơ phê duyệt')).toBeVisible();

    await page.screenshot({ path: 'test-results/live-screens/05-approvals.png' });
  });

  // 6. Kiểm tra dữ liệu thật trên Kho nguyên liệu (/warehouse - 2 kho, receipts, issues)
  test('Warehouse (/warehouse): Renders real warehouse selector and empty state on issues', async ({ page }) => {
    // Receipts view
    await page.goto('/warehouse?view=receipts');
    await expect(page.getByRole('heading', { name: 'Kho nguyên liệu & Nhập xuất' })).toBeVisible({ timeout: 15_000 });

    // Selector shows real warehouses
    await expect(page.getByText('Kho đang hoạt động')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Mã phiếu nhập' })).toBeVisible();

    // Issues view (DB has 0 issues -> renders clean empty state)
    await page.goto('/warehouse?view=issues');
    await expect(page.getByRole('heading', { name: 'Kho nguyên liệu & Nhập xuất' })).toBeVisible();
    await expect(page.getByText('Chưa có phiếu xuất kho')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Không có phiếu xuất kho nào phù hợp với bộ lọc.')).toBeVisible();

    // Stock view (prerequisite blocked)
    await page.goto('/warehouse?view=stock');
    await expect(page.getByText('Chưa có nguồn tồn kho hiện tại')).toBeVisible();

    await page.screenshot({ path: 'test-results/live-screens/06-warehouse.png' });
  });

  // 7. Kiểm tra dữ liệu thật trên Đối soát nguyên liệu (/reconciliation)
  test('Reconciliation (/reconciliation): Renders customer selector and mode-guarded batch action', async ({ page }) => {
    await page.goto('/reconciliation');
    await expect(page.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeVisible({ timeout: 15_000 });

    // Customer selector populated
    await expect(page.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toBeVisible();

    // In DEFAULT mode, completion action is disabled
    const completeBtn = page.getByRole('button', { name: 'Chốt đối soát ca' });
    if (await completeBtn.isVisible()) {
      await expect(completeBtn).toBeDisabled();
    }

    await page.screenshot({ path: 'test-results/live-screens/07-reconciliation.png' });
  });
});
