import { expect, type Locator, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

type NavigationSample = {
  label: string;
  clickToUrlMs: number;
  clickToStableMs: number;
  longTaskCount: number;
  longTaskDurationMs: number;
  loadedResources: Array<{ name: string; duration: number; initiatorType: string }>;
};

async function fulfillJson(route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data }),
  });
}

async function stubNavigationApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (pathname === '/api/auth/profile') {
      await fulfillJson(route, {
        userId: 'navigation-admin',
        username: 'admin',
        fullName: 'Admin User',
        roleCode: 'ADMIN',
        roleName: 'Admin',
        isAdminFullAccess: true,
        permissions: ['*'],
      });
      return;
    }
    if (pathname === '/api/coordination/customers') {
      await fulfillJson(route, [{ customerId: 'customer-dav', customerCode: 'DAV', customerName: 'Draxlmaier' }]);
      return;
    }
    if (pathname === '/api/coordination/customer-contracts') {
      await fulfillJson(route, [{
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
      }]);
      return;
    }
    if (pathname.startsWith('/api/coordination/weekly-menu')) {
      await fulfillJson(route, pathname.endsWith('/import-history') ? [] : null);
      return;
    }
    if (pathname.startsWith('/api/workflow-reports/operational-kpis')) {
      await fulfillJson(route, {
        shortageCount: 0,
        lowStockCount: 0,
        overduePurchaseRequestCount: 0,
        lateReceiptCount: 0,
        pendingKitchenConfirmationCount: 0,
        failedWorkflowCount: 0,
        criticalDataQualityCount: 0,
        overdueApprovalCount: 0,
        generatedAt: '2026-07-23T00:00:00Z',
      });
      return;
    }
    await fulfillJson(route, []);
  });
}

async function installPerformanceProbe(page: Page) {
  await page.evaluate(() => {
    const state = {
      clickStart: 0,
      urlChangedAt: 0,
      longTasks: [] as Array<{ startTime: number; duration: number }>,
    };
    (window as unknown as { __ipcNavigationProbe: typeof state }).__ipcNavigationProbe = state;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // Older engines may not expose Long Tasks; timing assertions still run.
    }

    document.addEventListener('click', (event) => {
      if (!(event.target as Element | null)?.closest('.ipc-nav-link')) return;
      state.clickStart = performance.now();
      state.urlChangedAt = 0;
    }, true);

    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = (...args) => {
      const result = originalPushState(...args);
      if (state.clickStart > 0) state.urlChangedAt = performance.now();
      return result;
    };
  });
}

async function measureNavigation(
  page: Page,
  label: string,
  link: Locator,
  path: string,
  stableElement: Locator,
): Promise<NavigationSample> {
  await page.evaluate(() => performance.clearResourceTimings());
  await link.click();
  await expect(page).toHaveURL(path);
  await expect(stableElement).toBeVisible();
  await expect(page.getByText('Đang tải màn hình...', { exact: true })).toHaveCount(0);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

  return page.evaluate((sampleLabel) => {
    const probe = (window as unknown as {
      __ipcNavigationProbe: {
        clickStart: number;
        urlChangedAt: number;
        longTasks: Array<{ startTime: number; duration: number }>;
      };
    }).__ipcNavigationProbe;
    const stableAt = performance.now();
    const relevantLongTasks = probe.longTasks.filter((task) => task.startTime >= probe.clickStart && task.startTime <= stableAt);
    return {
      label: sampleLabel,
      clickToUrlMs: Math.max(0, probe.urlChangedAt - probe.clickStart),
      clickToStableMs: stableAt - probe.clickStart,
      longTaskCount: relevantLongTasks.length,
      longTaskDurationMs: relevantLongTasks.reduce((total, task) => total + task.duration, 0),
      loadedResources: performance.getEntriesByType('resource')
        .filter((entry) => entry.startTime >= probe.clickStart)
        .map((entry) => ({
          name: entry.name.split('/').at(-1) ?? entry.name,
          duration: entry.duration,
          initiatorType: entry.initiatorType,
        })),
    };
  }, label);
}

async function openAuthenticatedDashboard(page: Page) {
  page.on('pageerror', (error) => console.error(`NAVIGATION_PAGE_ERROR ${error.message}`));
  await stubNavigationApi(page);
  await page.addInitScript(() => {
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'navigation-admin',
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
  await expect(page.locator('.ipc-dashboard-frame')).toBeVisible();
  await installPerformanceProbe(page);
}

function expectNavigationWithinBudget(sample: NavigationSample, budgetMs: number) {
  expect(sample.clickToUrlMs).toBeLessThan(50);
  expect(sample.clickToStableMs).toBeLessThan(budgetMs);
  expect(sample.longTaskCount).toBe(0);
  expect(sample.loadedResources.filter((resource) => resource.initiatorType === 'script')).toEqual([]);
}

test('desktop sidebar navigation stays responsive after idle route preloading', async ({ page }) => {
  await openAuthenticatedDashboard(page);
  await page.waitForTimeout(750);

  const coldWeeklyMenu = await measureNavigation(
    page,
    'dashboard-to-weekly-menu-cold',
    page.getByRole('link', { name: 'Thực đơn tuần' }),
    ROUTES.WEEKLY_MENU,
    page.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' }),
  );
  const dashboard = await measureNavigation(
    page,
    'weekly-menu-to-dashboard-warm',
    page.getByRole('link', { name: 'Tổng quan' }).first(),
    ROUTES.DASHBOARD,
    page.locator('.ipc-dashboard-frame'),
  );
  const warmWeeklyMenu = await measureNavigation(
    page,
    'dashboard-to-weekly-menu-warm',
    page.getByRole('link', { name: 'Thực đơn tuần' }),
    ROUTES.WEEKLY_MENU,
    page.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' }),
  );

  const samples = [coldWeeklyMenu, dashboard, warmWeeklyMenu];
  console.info(`NAVIGATION_PERFORMANCE ${JSON.stringify(samples)}`);
  await test.info().attach('navigation-performance', {
    body: JSON.stringify(samples, null, 2),
    contentType: 'application/json',
  });

  expectNavigationWithinBudget(coldWeeklyMenu, 500);
  expectNavigationWithinBudget(dashboard, 300);
  expectNavigationWithinBudget(warmWeeklyMenu, 300);
});

test('mobile sidebar closes and renders the selected route within budget', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedDashboard(page);
  await page.waitForTimeout(750);

  const menuToggle = page.locator('.ipc-mobile-nav-toggle');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  const sample = await measureNavigation(
    page,
    'mobile-dashboard-to-weekly-menu',
    page.getByRole('link', { name: 'Thực đơn tuần' }),
    ROUTES.WEEKLY_MENU,
    page.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' }),
  );

  console.info(`MOBILE_NAVIGATION_PERFORMANCE ${JSON.stringify(sample)}`);
  await test.info().attach('mobile-navigation-performance', {
    body: JSON.stringify(sample, null, 2),
    contentType: 'application/json',
  });
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  expectNavigationWithinBudget(sample, 500);
});
