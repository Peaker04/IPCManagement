import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

type PerformanceProbe = {
  commits: number;
  mainLayoutRenders: number;
  layoutShifts: number[];
};

async function fulfillJson(route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data }),
  });
}

async function installPerformanceProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: PerformanceProbe = { commits: 0, mainLayoutRenders: 0, layoutShifts: [] };
    (window as unknown as { __ipcCacheProbe: PerformanceProbe }).__ipcCacheProbe = probe;

    let rendererId = 0;
    const renderers = new Map<number, unknown>();
    (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers,
      supportsFiber: true,
      inject(renderer: unknown) {
        const id = ++rendererId;
        renderers.set(id, renderer);
        return id;
      },
      onScheduleFiberRoot() {},
      onCommitFiberRoot(_id: number, root: { current?: unknown }) {
        probe.commits += 1;
        const stack = [root.current] as Array<{
          elementType?: { name?: string };
          type?: { name?: string };
          flags?: number;
          child?: unknown;
          sibling?: unknown;
        } | undefined>;
        while (stack.length > 0) {
          const fiber = stack.pop();
          if (!fiber) continue;
          const name = fiber.elementType?.name ?? fiber.type?.name;
          if (name === 'MainLayout' && ((fiber.flags ?? 0) & 1) === 1) {
            probe.mainLayoutRenders += 1;
          }
          if (fiber.child) stack.push(fiber.child as typeof fiber);
          if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
        }
      },
      onCommitFiberUnmount() {},
      checkDCE() {},
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput && typeof shift.value === 'number') {
            probe.layoutShifts.push(shift.value);
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Layout Shift API is optional; the geometry checks below remain deterministic.
    }

    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'cache-admin',
      username: 'admin',
      fullName: 'Admin User',
      role: 'admin',
      roleCode: 'ADMIN',
      roleName: 'Admin',
      isAdminFullAccess: true,
      permissions: ['*'],
    }));
  });
}

async function stubNavigationApi(page: Page, calls: Map<string, number>) {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    calls.set(pathname, (calls.get(pathname) ?? 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (pathname === '/api/auth/profile') {
      await fulfillJson(route, {
        userId: 'cache-admin',
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
    if (pathname === '/api/workflow-reports/operational-kpis') {
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

const weeklyMenuRequests = [
  '/api/dishes/catalog',
  '/api/coordination/customers',
  '/api/coordination/customer-contracts',
  '/api/coordination/weekly-menu/import-history',
];

test('intent prefetch warms data and returning keeps the same cached shell', async ({ page }) => {
  const calls = new Map<string, number>();
  await installPerformanceProbe(page);
  await stubNavigationApi(page, calls);

  await page.goto(ROUTES.DASHBOARD);
  await expect(page.locator('.ipc-dashboard-frame')).toBeVisible();

  const sidebar = await page.locator('.ipc-sidebar').elementHandle();
  const initialGeometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    mainLeft: document.querySelector('#ipc-main-content')?.getBoundingClientRect().left,
    rootOverflowY: getComputedStyle(document.documentElement).overflowY,
  }));
  const initialProbe = await page.evaluate(() =>
    (window as unknown as { __ipcCacheProbe: PerformanceProbe }).__ipcCacheProbe,
  );

  const weeklyMenuLink = page.getByRole('link', { name: 'Thực đơn tuần' });
  await weeklyMenuLink.hover();
  await expect.poll(() => weeklyMenuRequests.every((path) => calls.get(path) === 1)).toBe(true);
  const callsAfterPrefetch = Object.fromEntries(calls);

  await weeklyMenuLink.click();
  await expect(page).toHaveURL(ROUTES.WEEKLY_MENU);
  await expect(page.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' })).toBeVisible();
  await page.waitForTimeout(180);
  expect(Object.fromEntries(calls)).toEqual(callsAfterPrefetch);

  await page.getByRole('link', { name: 'Tổng quan' }).first().click();
  await expect(page.locator('.ipc-dashboard-frame')).toBeVisible();
  await weeklyMenuLink.hover();
  await weeklyMenuLink.click();
  await expect(page.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' })).toBeVisible();
  await page.waitForTimeout(180);

  expect(Object.fromEntries(calls)).toEqual(callsAfterPrefetch);
  const result = await page.evaluate((sidebarNode) => {
    const probe = (window as unknown as { __ipcCacheProbe: PerformanceProbe }).__ipcCacheProbe;
    return {
      sidebarIsSameNode: document.querySelector('.ipc-sidebar') === sidebarNode,
      clientWidth: document.documentElement.clientWidth,
      mainLeft: document.querySelector('#ipc-main-content')?.getBoundingClientRect().left,
      animatedEntrances: [...document.querySelectorAll(
        '.ipc-main, .ipc-empty-state, .ipc-inline-alert-enter, .ipc-main .animate-pulse',
      )].filter((element) => getComputedStyle(element).animationName !== 'none').length,
      probe,
    };
  }, sidebar);

  const cumulativeLayoutShift = result.probe.layoutShifts.reduce((total, value) => total + value, 0);
  const navigationLayoutRenders = result.probe.mainLayoutRenders - initialProbe.mainLayoutRenders;
  expect(result.sidebarIsSameNode).toBe(true);
  expect(initialGeometry.rootOverflowY).toBe('scroll');
  expect(result.clientWidth).toBe(initialGeometry.clientWidth);
  expect(result.mainLeft).toBe(initialGeometry.mainLeft);
  expect(result.animatedEntrances).toBe(0);
  expect(cumulativeLayoutShift).toBeLessThan(0.1);
  expect(navigationLayoutRenders).toBeLessThanOrEqual(4);

  console.info(`CACHE_NAVIGATION_PERFORMANCE ${JSON.stringify({
    calls: callsAfterPrefetch,
    cumulativeLayoutShift,
    navigationLayoutRenders,
    reactCommits: result.probe.commits - initialProbe.commits,
  })}`);
});
