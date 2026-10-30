import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '1440p', width: 1440, height: 900 },
  { name: '1280p', width: 1280, height: 800 },
  { name: '1024p', width: 1024, height: 768 },
  { name: '768p', width: 768, height: 1024 },
  { name: '390p', width: 390, height: 844 },
];

const ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/weekly-menu', name: 'WeeklyMenu' },
  { path: '/weekly-menu?view=demand', name: 'WeeklyMenuDemand' },
  { path: '/weekly-menu?view=production-plan', name: 'WeeklyMenuProdPlan' },
  { path: '/weekly-menu?view=cost', name: 'WeeklyMenuCost' },
  { path: '/meal-orders', name: 'MealOrders' },
  { path: '/approvals', name: 'Approvals' },
  { path: '/purchasing', name: 'Purchasing' },
  { path: '/warehouse?view=receipts', name: 'WarehouseReceipts' },
  { path: '/warehouse?view=issues', name: 'WarehouseIssues' },
  { path: '/chef?view=plans', name: 'ChefPlans' },
  { path: '/reconciliation', name: 'Reconciliation' },
  { path: '/reports?view=demand', name: 'ReportsDemand' },
  { path: '/admin-data?view=ingredients', name: 'AdminIngredients' },
  { path: '/admin-data?view=dishes', name: 'AdminDishes' },
  { path: '/settings/approval-rules', name: 'ApprovalRules' },
  { path: '/settings/advanced?view=mode', name: 'SettingsMode' },
];

test.describe('Responsive Design System & Visual Audit', () => {
  let authToken = '';

  test.beforeAll(async ({ request }) => {
    let attempts = 0;
    while (attempts < 3 && (!authToken || !authToken.startsWith('ey'))) {
      try {
        const res = await request.post('http://127.0.0.1:5262/api/auth/login', {
          data: { username: 'admin', password: 'Admin@123456' },
        });
        const json = await res.json();
        if (json.success && json.data?.accessToken) {
          authToken = json.data.accessToken;
          break;
        }
      } catch (e) {
        console.warn('Backend login error:', e);
      }
      attempts++;
      if (!authToken) await new Promise((r) => setTimeout(r, 500));
    }
  });

  test.beforeEach(async ({ page, request }) => {
    if (!authToken || !authToken.startsWith('ey')) {
      let attempts = 0;
      while (attempts < 3 && (!authToken || !authToken.startsWith('ey'))) {
        try {
          const res = await request.post('http://127.0.0.1:5262/api/auth/login', {
            data: { username: 'admin', password: 'Admin@123456' },
          });
          const json = await res.json();
          if (json.success && json.data?.accessToken) {
            authToken = json.data.accessToken;
            break;
          }
        } catch {}
        attempts++;
        if (!authToken) await new Promise((r) => setTimeout(r, 300));
      }
    }
    await page.addInitScript((tok) => {
      localStorage.setItem('ipc_v3_token', tok);
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
      localStorage.setItem('ipc_v3_mode_version', '1');
    }, authToken);
  });

  // Test 1: Geometry Audit across viewports
  for (const vp of VIEWPORTS) {
    test(`Geometry & Layout at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin-data?view=ingredients');
      await page.waitForLoadState('networkidle');

      // Check WorkspaceHeader height
      const header = page.locator('header.h-14');
      await expect(header).toBeVisible();
      const headerBox = await header.boundingBox();
      expect(headerBox).toBeTruthy();
      // Should remain exactly 56px (h-14) or within 1px
      expect(Math.round(headerBox!.height)).toBe(56);

      // Check TelemetrySubbar height
      const subbar = page.locator('div.h-11');
      await expect(subbar).toBeVisible();
      const subbarBox = await subbar.boundingBox();
      expect(subbarBox).toBeTruthy();
      // Should remain exactly 44px (h-11) or within 1px
      expect(Math.round(subbarBox!.height)).toBe(44);

      // Check DataGrid viewport height
      const grid = page.locator('div.overflow-auto.bg-white').first();
      if (await grid.isVisible()) {
        const gridBox = await grid.boundingBox();
        expect(gridBox).toBeTruthy();
        // Remaining space after 56px + 44px = 100px top bars
        const expectedMinHeight = vp.height - 120; // accounting for padding/borders
        expect(gridBox!.height).toBeGreaterThan(expectedMinHeight * 0.7);
      }
    });
  }

  // Test 2: Rule D6 - Font size audit (no font < 12px)
  test('Rule D6: Font size audit across rendered pages', async ({ page }) => {
    const findings: { route: string; selector: string; text: string; fontSize: string }[] = [];

    for (const route of ROUTES.slice(0, 8)) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const violations = await page.evaluate((currentRoute) => {
        const results: { route: string; selector: string; text: string; fontSize: string }[] = [];
        const allElements = document.querySelectorAll('body *');
        for (const el of allElements) {
          // ignore svgs, scripts, hidden elements
          if (el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'path' || el.tagName.toLowerCase() === 'script') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const text = (el.textContent || '').trim();
          if (!text) continue;
          // Only check leaf or near-leaf elements with direct text
          let hasDirectText = false;
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim().length > 0) {
              hasDirectText = true;
              break;
            }
          }
          if (!hasDirectText) continue;

          const computed = window.getComputedStyle(el);
          const fontSizePx = parseFloat(computed.fontSize);
          if (fontSizePx < 11.5) {
            results.push({
              route: currentRoute,
              selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''),
              text: text.slice(0, 30),
              fontSize: computed.fontSize,
            });
          }
        }
        return results;
      }, route.path);

      findings.push(...violations);
    }

    console.log('Rule D6 (<12px) findings count:', findings.length);
    if (findings.length > 0) {
      console.log('Rule D6 findings sample:', findings.slice(0, 5));
    }
  });

  // Test 3: Rule D7 - Action Hierarchy (Max 1 primary button per context)
  test('Rule D7: Primary Action Button count audit', async ({ page }) => {
    const multiplePrimaryRoutes: { route: string; primaryCount: number }[] = [];

    for (const route of ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      // Primary buttons have variant="default" which maps to bg-slate-900 (or bg-blue-600)
      const primaryCount = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('header button, div[class*="TelemetrySubbar"] button, main > div > header button'));
        return buttons.filter((btn) => {
          const comp = window.getComputedStyle(btn);
          const bg = comp.backgroundColor;
          // rgb(15, 23, 42) is slate-900
          return bg === 'rgb(15, 23, 42)' || btn.classList.contains('bg-slate-900');
        }).length;
      });

      if (primaryCount > 1) {
        multiplePrimaryRoutes.push({ route: route.path, primaryCount });
      }
    }

    console.log('Routes with multiple primary buttons in header:', multiplePrimaryRoutes);
    expect(multiplePrimaryRoutes.length).toBe(0);
  });

  // Test 4: Tabular Numbers (Rule T1/T3) and Frozen headers (Rule T7)
  test('Rule T1/T3/T7: Tabular nums and sticky headers in DataGrid', async ({ page }) => {
    await page.goto('/admin-data?view=ingredients');
    await page.waitForLoadState('networkidle');

    // Check sticky header
    const stickyThead = page.locator('thead.sticky');
    await expect(stickyThead).toBeVisible();

    // Check sticky first column in thead
    const stickyTh = page.locator('thead th.sticky').first();
    await expect(stickyTh).toBeVisible();

    // Check tabular-nums on price column
    const numElements = page.locator('.tabular-nums');
    const count = await numElements.count();
    expect(count).toBeGreaterThan(0);

    // Verify computed style of Num
    const fontVariant = await numElements.first().evaluate((el) => {
      const comp = window.getComputedStyle(el);
      return comp.fontVariantNumeric;
    });
    expect(fontVariant).toContain('tabular-nums');
  });

  // Test 5: Microcopy (UXR-04 / DOM-LANG-1)
  test('Microcopy Audit: Check for raw English enums and undefined/null tokens', async ({ page }) => {
    const rawPatterns = ['PENDING', 'APPROVED', 'REJECTED', 'POSTED', 'true', 'false', 'null', 'undefined', 'NaN'];
    const leaks: { route: string; pattern: string; snippet: string }[] = [];

    for (const route of ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const text = await page.evaluate(() => document.body.innerText);
      for (const pattern of rawPatterns) {
        // Match whole word pattern
        const regex = new RegExp(`\\b${pattern}\\b`);
        if (regex.test(text)) {
          // Exclude script or hidden technical tokens if any
          const matchIdx = text.search(regex);
          const snippet = text.slice(Math.max(0, matchIdx - 20), Math.min(text.length, matchIdx + 40)).replace(/\n/g, ' ');
          leaks.push({ route: route.path, pattern, snippet });
        }
      }
    }

    console.log('Microcopy raw token leaks:', leaks);
  });
});
