import { expect, type Locator, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/lib/routeConfig';

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

test('desktop sidebar navigation stays responsive after intent preloading', async ({ page }) => {
  await openAuthenticatedDashboard(page);
  await page.waitForTimeout(750);

  const weeklyMenuLink = page.getByRole('link', { name: 'Thực đơn tuần' });
  await weeklyMenuLink.hover();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.initiatorType === 'script')
    .map((entry) => entry.name.split('/').at(-1) ?? entry.name)))
    .toEqual(expect.arrayContaining([expect.stringContaining('WeeklyMenuPage.tsx')]));

  const coldWeeklyMenu = await measureNavigation(
    page,
    'dashboard-to-weekly-menu-cold',
    weeklyMenuLink,
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

test('idle time does not download route modules the user has not requested', async ({ page }) => {
  await openAuthenticatedDashboard(page);
  await page.waitForTimeout(1_500);
  const unexpectedModules = [
    'WeeklyMenuPage.tsx',
    'CoordinationPage.tsx',
    'ApprovalPage.tsx',
    'PurchasingPage.tsx',
    'WarehousePage.tsx',
    'ChefDashboardPage.tsx',
    'ReportsPage.tsx',
    'AdminDataPage.tsx',
    'ApprovalRulesPage.tsx',
  ];

  const loadedModules = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.initiatorType === 'script')
    .map((entry) => entry.name.split('/').at(-1) ?? entry.name));
  for (const moduleName of unexpectedModules) {
    expect(loadedModules.some((loadedModule) => loadedModule.includes(moduleName))).toBe(false);
  }

  const weeklyMenuLink = page.getByRole('link', { name: 'Thực đơn tuần' });
  await weeklyMenuLink.hover();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.initiatorType === 'script')
    .map((entry) => entry.name.split('/').at(-1) ?? entry.name)))
    .toEqual(expect.arrayContaining([expect.stringContaining('WeeklyMenuPage.tsx')]));
  await page.evaluate(() => {
    const state = { fallbackMounts: 0 };
    (window as unknown as { __ipcPreloadedRouteProbe: typeof state }).__ipcPreloadedRouteProbe = state;
    new MutationObserver(() => {
      if (document.querySelector('#ipc-main-content section[aria-busy="true"]')) state.fallbackMounts += 1;
    }).observe(document.querySelector('#ipc-main-content')!, { childList: true, subtree: true });
  });
  await weeklyMenuLink.click();
  await expect(page).toHaveURL(ROUTES.WEEKLY_MENU);
  await expect(page.locator('#ipc-main-content > .ipc-operational-frame')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __ipcPreloadedRouteProbe: { fallbackMounts: number } })
      .__ipcPreloadedRouteProbe.fallbackMounts)).toBe(0);

  console.info(`IDLE_LOADED_ROUTES ${JSON.stringify(loadedModules)}`);
  await test.info().attach('idle-loaded-routes', {
    body: JSON.stringify(loadedModules, null, 2),
    contentType: 'application/json',
  });
});

test('explicit navigation intent still preloads only the selected route with data saver enabled', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', saveData: true },
    });
  });
  await openAuthenticatedDashboard(page);
  await page.waitForTimeout(1_500);

  await page.getByRole('link', { name: 'Thực đơn tuần' }).focus();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.initiatorType === 'script')
    .map((entry) => entry.name.split('/').at(-1) ?? entry.name)))
    .toEqual(expect.arrayContaining([expect.stringContaining('WeeklyMenuPage.tsx')]));

  const loadedModules = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.initiatorType === 'script')
    .map((entry) => entry.name.split('/').at(-1) ?? entry.name));
  expect(loadedModules.some((moduleName) => moduleName.includes('DashboardPage.tsx'))).toBe(true);
  expect(loadedModules.some((moduleName) => moduleName.includes('WeeklyMenuPage.tsx'))).toBe(true);
  expect(loadedModules.some((moduleName) => moduleName.includes('ChefDashboardPage.tsx'))).toBe(false);
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

test('approvals keeps the document strip geometry stable while its queue loads', async ({ page }) => {
  await openAuthenticatedDashboard(page);

  let releaseInbox!: () => void;
  let inboxResponse: 'records' | 'empty' = 'records';
  const inboxReady = new Promise<void>((resolve) => { releaseInbox = resolve; });
  await page.route('**/api/approvals/inbox**', async (route) => {
    await inboxReady;
    await fulfillJson(route, {
      items: inboxResponse === 'empty' ? [] : Array.from({ length: 20 }, (_, index) => ({
        id: `approval-performance-${index + 1}`,
        targetType: 'purchase-request',
        targetId: `purchase-performance-${index + 1}`,
        targetCode: `PR-PERF-${String(index + 1).padStart(3, '0')}`,
        type: 'purchase',
        title: `Duyệt đề xuất mua PR-PERF-${String(index + 1).padStart(3, '0')}`,
        source: `PR-PERF-${String(index + 1).padStart(3, '0')}`,
        owner: 'Quản lý',
        submittedBy: 'Nhân viên thu mua',
        deadline: '27/07/2026',
        status: 'PENDING',
        reason: 'Chờ quản lý duyệt.',
        nextAction: 'Duyệt đề xuất mua',
        tone: 'warning',
        materials: [],
      })),
      limit: 20,
      hasNext: false,
      nextCursor: null,
    });
  });

  await page.goto(ROUTES.APPROVALS);
  const queueLoading = page.locator('[data-testid="approval-queue-loading"]');
  await expect(queueLoading).toBeVisible();

  const readGeometry = () => page.evaluate(() => {
    const primary = document.querySelector('#approval-queue-panel .ipc-split-primary');
    const strip = document.querySelector('#approval-queue-panel .ipc-split-detail-strip');
    const viewport = document.querySelector('[data-testid="approval-queue-viewport"]');
    if (!primary || !strip || !viewport) throw new Error('Approval workbench geometry is missing.');
    const primaryRect = primary.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return {
      primaryHeight: primaryRect.height,
      stripTop: stripRect.top,
      stripHeight: stripRect.height,
      viewportHeight: viewportRect.height,
    };
  });

  const loadingGeometry = await readGeometry();
  releaseInbox();
  await expect(queueLoading).toHaveCount(0);
  await expect(page.locator('#approval-queue-panel .ipc-approval-record')).toHaveCount(20);
  const recordsGeometry = await readGeometry();

  inboxResponse = 'empty';
  await page.reload();
  await expect(page.locator('#approval-queue-panel .ipc-approval-record')).toHaveCount(0);
  await expect(page.getByTestId('approval-queue-viewport').getByText('Chưa có dữ liệu để hiển thị')).toBeVisible();
  const emptyGeometry = await readGeometry();

  for (const geometry of [recordsGeometry, emptyGeometry]) {
    expect(Math.abs(loadingGeometry.primaryHeight - geometry.primaryHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(loadingGeometry.stripTop - geometry.stripTop)).toBeLessThanOrEqual(1);
    expect(loadingGeometry.stripHeight).toBe(geometry.stripHeight);
    expect(loadingGeometry.viewportHeight).toBe(geometry.viewportHeight);
  }
});
