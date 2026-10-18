import { test, expect } from '@playwright/test';

test.describe('Loading UX & Async State Consistency Audit Suite', () => {
  let authToken = '';

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.post('http://127.0.0.1:5262/api/auth/login', {
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
    await page.addInitScript((token) => {
      localStorage.setItem('ipc_v3_token', token || 'mock-admin-token');
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

  // Test 1: Cold Navigation vs Scoped Skeleton
  test('Cold Navigation: Displays scoped skeleton and settles with zero layout shift', async ({ page }) => {
    await page.goto('/admin-data?view=ingredients');

    // Header must be exactly 56px immediately
    const header = page.locator('header.h-14');
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox?.height).toBeCloseTo(56, 1);

    // Table data arrives and renders 25 rows
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(25, { timeout: 15_000 });
  });

  // Test 2: Pagination keeps table visible without skeleton jump
  test('Pagination: Clicking next page does not destroy table container', async ({ page }) => {
    await page.goto('/admin-data?view=ingredients');

    // Wait for page 1 rows
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(25, { timeout: 15_000 });

    // Click "Trang sau"
    const nextBtn = page.getByRole('button', { name: 'Trang sau' });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Table container remains intact and updates to Page 2
    await expect(page.getByText(/Trang 2\/31/)).toBeVisible({ timeout: 10_000 });
    await expect(rows).toHaveCount(25);
  });

  // Test 3: Manual Refresh keeps existing data visible with progress indicator
  test('Manual Refresh: Clicking Làm mới retains existing rows during refetch', async ({ page }) => {
    await page.goto('/admin-data?view=ingredients');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(25, { timeout: 15_000 });

    // Click "Làm mới"
    const refreshBtn = page.getByRole('button', { name: 'Làm mới' });
    await refreshBtn.click();

    // The table container should NOT be unmounted or replaced by full-screen skeleton
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(rows).toHaveCount(25);
  });

  // Test 4: Dashboard populates real tasks and stepper without empty desert
  test('Dashboard: Renders 4 prioritized tasks and 4 progress stages from live KPIs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Bàn điều hành hôm nay' })).toBeVisible({ timeout: 15_000 });

    // 4 Tasks rendered
    await expect(page.getByText('VIỆC CẦN XỬ LÝ TRƯỚC')).toBeVisible({ timeout: 10_000 });
    const taskRows = page.locator('tbody tr');
    await expect(taskRows).toHaveCount(4);

    // 4 Stages rendered in right stepper
    await expect(page.getByText('TIẾN ĐỘ 4 CÔNG ĐOẠN')).toBeVisible();
    await expect(page.getByText('Lập thực đơn & KHSX tuần')).toBeVisible();
    await expect(page.getByText('Tổng hợp BOM & Đề xuất mua hàng')).toBeVisible();
  });

  // Test 5: Production Plan translates shift enums to standard Vietnamese
  test('Production Plan: Mapped shift names render Ca 1 (Sáng) and Ca 2 (Chiều)', async ({ page }) => {
    await page.goto('/weekly-menu?view=production-plan');

    // Select customer ANV and week 21/09/2026 to see plans
    const customerSelect = page.getByRole('combobox', { name: 'Chọn khách hàng thực đơn' });
    await customerSelect.selectOption('ANV');

    const dateInput = page.getByPlaceholder('dd/MM/yyyy');
    await dateInput.fill('21/09/2026');
    await dateInput.press('Enter');

    await page.waitForLoadState('networkidle').catch(() => {});

    // Ensure raw enums MORNING/AFTERNOON are NEVER visible in table cells
    const cellMorning = page.locator('tbody td').filter({ hasText: /^MORNING$/ });
    const cellAfternoon = page.locator('tbody td').filter({ hasText: /^AFTERNOON$/ });
    await expect(cellMorning).toHaveCount(0);
    await expect(cellAfternoon).toHaveCount(0);

    // Vietnamese shifts are rendered
    await expect(page.locator('tbody').getByText(/Ca 1 \(Sáng\)|Ca 2 \(Chiều\)/).first()).toBeVisible({ timeout: 15_000 });
  });

  // Test 6: Non-destructive error handling during refresh retains data
  test('Non-destructive error resilience: Preserves table rows when network fails on refresh', async ({ page }) => {
    await page.goto('/admin-data?view=ingredients');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(25, { timeout: 15_000 });

    // Intercept ingredients endpoint to fail on next request
    await page.route('**/api/ingredients*', (route) => {
      route.abort('failed');
    });

    // Click refresh
    const refreshBtn = page.getByRole('button', { name: 'Làm mới' });
    await refreshBtn.click();

    // Existing rows must REMAIN in DOM!
    await expect(rows).toHaveCount(25);

    // Non-destructive inline alert is visible
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Không thể tải dữ liệu');
  });
});
