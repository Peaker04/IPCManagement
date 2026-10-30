import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// 25 Screens / Workbenches mapping the complete 14 Canonical Routes
const FULL_MATRIX_SCREENS = [
  { id: '01', route: '/', title: 'Bàn điều hành', slug: 'dashboard-root', mode: 'SHARED' },
  { id: '02', route: '/weekly-menu', title: 'Thực đơn & KHSX tuần', slug: 'weekly-schedule', mode: 'DEFAULT' },
  { id: '03', route: '/weekly-menu?view=demand', title: 'Thực đơn & KHSX tuần', slug: 'weekly-demand', mode: 'DEFAULT' },
  { id: '04', route: '/weekly-menu?view=production-plan', title: 'Thực đơn & KHSX tuần', slug: 'weekly-production', mode: 'DEFAULT' },
  { id: '05', route: '/weekly-menu?view=cost', title: 'Thực đơn & KHSX tuần', slug: 'weekly-cost', mode: 'DEFAULT' },
  { id: '06', route: '/meal-orders', title: 'Điều phối đơn ăn', slug: 'meal-orders', mode: 'DEFAULT' },
  { id: '07', route: '/chef?view=plans', title: 'Bếp trưởng & Bàn giao ca', slug: 'chef-plans', mode: 'DEFAULT' },
  { id: '08', route: '/chef?view=issues', title: 'Bếp trưởng & Bàn giao ca', slug: 'chef-issues', mode: 'DEFAULT' },
  { id: '09', route: '/purchasing', title: 'Thu mua & Đề xuất PO', slug: 'purchasing-orders', mode: 'DEFAULT' },
  { id: '10', route: '/approvals', title: 'Hàng đợi phê duyệt', slug: 'approvals-inbox', mode: 'DEFAULT' },
  { id: '11', route: '/warehouse?view=issues', title: 'Kho nguyên liệu & Nhập xuất', slug: 'warehouse-issues', mode: 'DEFAULT' },
  { id: '12', route: '/warehouse?view=receipts', title: 'Kho nguyên liệu & Nhập xuất', slug: 'warehouse-receipts', mode: 'DEFAULT' },
  { id: '13', route: '/warehouse?view=stock', title: 'Kho nguyên liệu & Nhập xuất', slug: 'warehouse-stock', mode: 'DEFAULT' },
  { id: '14', route: '/reconciliation', title: 'Đối soát nguyên liệu', slug: 'reconciliation-batch', exactHeading: true, mode: 'MATERIAL_RECONCILIATION' },
  { id: '15', route: '/reports?view=demand', title: 'Báo cáo vận hành', slug: 'reports-demand', mode: 'DEFAULT' },
  { id: '16', route: '/reports?view=prices', title: 'Báo cáo vận hành', slug: 'reports-prices', mode: 'DEFAULT' },
  { id: '17', route: '/reports?view=stock', title: 'Báo cáo vận hành', slug: 'reports-stock', mode: 'DEFAULT' },
  { id: '18', route: '/admin-data?view=ingredients', title: 'Quản trị dữ liệu & Danh mục', slug: 'admin-ingredients', mode: 'SHARED' },
  { id: '19', route: '/admin-data?view=dishes', title: 'Quản trị dữ liệu & Danh mục', slug: 'admin-dishes', mode: 'SHARED' },
  { id: '20', route: '/settings/approval-rules', title: 'Thiết lập quy trình duyệt', slug: 'admin-approval-rules', mode: 'DEFAULT' },
  { id: '21', route: '/settings/advanced?view=mode', title: 'Cấu hình hệ thống & Vận hành', slug: 'admin-mode', mode: 'SHARED' },
  { id: '22', route: '/settings/advanced', title: 'Cấu hình hệ thống & Vận hành', slug: 'admin-advanced', mode: 'SHARED' },
  { id: '23', route: '/weekly-menu?view=mrx-batch', title: 'Chuẩn bị lô đối soát', slug: 'mrx-batch', mode: 'MATERIAL_RECONCILIATION' },
  { id: '24', route: '/login', title: 'IPC MANAGEMENT', slug: 'auth-login', isPublic: true, mode: 'SHARED' },
  { id: '25', route: '/forbidden', title: 'Truy cập bị từ chối', slug: 'auth-forbidden', mode: 'SHARED' },
];

let cachedAuthToken = '';

async function getValidAuthToken(): Promise<string> {
  if (cachedAuthToken && cachedAuthToken.startsWith('ey')) return cachedAuthToken;
  let attempts = 0;
  while (attempts < 20) {
    try {
      const res = await fetch('http://127.0.0.1:5262/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.accessToken) {
          cachedAuthToken = json.data.accessToken;
          return cachedAuthToken;
        }
      }
    } catch {}
    attempts++;
    await new Promise((r) => setTimeout(r, 600));
  }
  return cachedAuthToken;
}

test.describe('Requirement-Driven Matrix Full Coverage Audit (Real Backend & DB)', () => {
  let authToken = '';
  let serverMode = 'MATERIAL_RECONCILIATION';

  test.beforeAll(async () => {
    authToken = await getValidAuthToken();

    if (authToken) {
      try {
        const modeRes = await fetch('http://127.0.0.1:5262/api/system-operation-mode', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const modeJson = await modeRes.json();
        if (modeJson.success && modeJson.data?.mode) {
          serverMode = modeJson.data.mode;
        }
      } catch {}
    }

    const screenshotDir = path.join(process.cwd(), 'test-results', 'matrix-screens');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    if (!authToken || !authToken.startsWith('ey')) {
      authToken = await getValidAuthToken();
    }
    expect(authToken).toBeTruthy();
    expect(authToken).toMatch(/^ey/);
    await page.addInitScript(({ token, mode }) => {
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
      localStorage.setItem('ipc_v3_mode', mode || 'MATERIAL_RECONCILIATION');
      localStorage.setItem('ipc_v3_mode_version', '1');
    }, { token: authToken, mode: serverMode });
  });

  for (const screen of FULL_MATRIX_SCREENS) {
    test(`Screen ${screen.id} [${screen.slug}]: ${screen.route} renders correctly with screenshot evidence`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(screen.route);

      if (screen.mode !== 'SHARED' && screen.mode !== serverMode) {
        // Under DOM-MODE-1, route for incompatible mode redirects to /forbidden or landing
        await page.waitForTimeout(500);
        const isForbiddenOrRedirected = page.url().includes('/forbidden') || page.url().includes('/weekly-menu?view=mrx-batch');
        if (!isForbiddenOrRedirected) {
          console.error(`===> Screen ${screen.id} FAIL: URL was "${page.url()}", expected /forbidden or /weekly-menu?view=mrx-batch`);
        }
        expect(isForbiddenOrRedirected).toBe(true);
        return;
      }

      // Verify page heading
      if (screen.exactHeading) {
        await expect(page.getByRole('heading', { name: screen.title, exact: true })).toBeVisible({ timeout: 15_000 });
      } else {
        await expect(page.getByRole('heading', { name: screen.title })).toBeVisible({ timeout: 15_000 });
      }

      // Wait for network idle and skeleton animations to settle so we capture true rendered state
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      const skeleton = page.locator('.animate-pulse');
      if (await skeleton.first().isVisible().catch(() => false)) {
        await skeleton.first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
      }

      // Check 3-Zone Geometry if not public auth route
      if (!screen.isPublic && screen.route !== '/forbidden') {
        const header = page.locator('header.h-14');
        await expect(header).toBeVisible();
        const headerBox = await header.boundingBox();
        expect(headerBox?.height).toBeCloseTo(56, 1);
      }

      // Capture official screenshot evidence
      const screenshotPath = path.join(process.cwd(), 'test-results', 'matrix-screens', `${screen.id}-${screen.slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Ensure no fatal console errors (filter out expected harmless network errors)
      const fatalErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('ERR_CONNECTION_REFUSED') && !e.includes('502') && !e.includes('409')
      );
      expect(fatalErrors).toHaveLength(0);
    });
  }

  test('Screen 02b [weekly-schedule-populated]: Customer DAV on 21/09/2026 renders full schedule matrix', async ({ page }) => {
    if (serverMode === 'MATERIAL_RECONCILIATION') {
      await page.goto('/weekly-menu');
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/weekly-menu?view=mrx-batch');
      return;
    }

    await page.goto('/weekly-menu');
    await expect(page.getByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeVisible({ timeout: 15_000 });

    // Select customer DAV
    const customerSelect = page.getByRole('combobox', { name: 'Chọn khách hàng thực đơn' });
    await expect(customerSelect).toBeVisible({ timeout: 10_000 });
    await customerSelect.selectOption('DAV');

    // Fill date 21/09/2026 and press Enter to commit
    const dateInput = page.getByPlaceholder('dd/MM/yyyy');
    await dateInput.fill('21/09/2026');
    await dateInput.press('Enter');

    // Wait for matrix rows to render
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText('Khô gà lá chanh')).toBeVisible({ timeout: 15_000 });

    const screenshotPath = path.join(process.cwd(), 'test-results', 'matrix-screens', '02b-weekly-schedule-populated.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
