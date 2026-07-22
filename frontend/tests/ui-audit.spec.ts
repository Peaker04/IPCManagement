import { expect, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROUTES } from '../src/routes/routeConfig';

type AuditIssue = {
  route: string;
  viewport: string;
  selector: string;
  text: string;
  reason: string;
  width: number;
  height: number;
};

const protectedRoutes = [
  { path: ROUTES.DASHBOARD, name: 'dashboard' },
  { path: ROUTES.WEEKLY_MENU, name: 'weekly-menu' },
  { path: ROUTES.MEAL_ORDERS, name: 'meal-orders' },
  { path: ROUTES.CHEF_DASHBOARD, name: 'chef-dashboard' },
  { path: ROUTES.REPORTS, name: 'reports' },
  { path: ROUTES.APPROVALS, name: 'approvals' },
  { path: ROUTES.PURCHASING, name: 'purchasing' },
  { path: ROUTES.WAREHOUSE, name: 'warehouse' },
  { path: ROUTES.ADMIN_DATA, name: 'admin-data' },
] as const;

const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;

function writeAuditReport(name: string, issues: AuditIssue[]) {
  const reportPath = resolve(process.cwd(), 'test-results', `${name}.json`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ issueCount: issues.length, issues }, null, 2));
}

async function fulfillJson(route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data }),
  });
}

function buildDataQualityIssues(count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const quantity = 745.871769 + index * 19.777777;
    return {
      issueId: `audit-inventory-ledger-${index}`,
      category: 'inventory_ledger_mismatch',
      severity: 'error',
      owner: 'Thủ kho',
      priorityRank: 1,
      slaHours: 2,
      slaLabel: 'P1 / 2h',
      entityName: ['Cá chua', 'Cá nục', 'Chanh', 'Đu đủ xanh'][index % 4],
      entityId: `ingredient-${index}`,
      entityCode: 'Kho mẫu IPC',
      entityLabel: `Currentstock / ${['Cá chua', 'Cá nục', 'Chanh', 'Đu đủ xanh'][index % 4]}`,
      message: `Current stock ${quantity.toFixed(6)} Kilogram không khớp ledger ${(quantity + (index % 2 === 0 ? 0.000001 : 80)).toFixed(6)} Kilogram. Lệch ${(index % 2 === 0 ? 0.000001 : -80).toFixed(6)} Kilogram.`,
      suggestedAction: 'Đối chiếu stock movements và tạo điều chỉnh tồn qua ledger, không sửa trực tiếp current stock.',
      route: ROUTES.WAREHOUSE,
      remediationStatus: 'open',
    };
  });
}

async function stubAuditApi(page: Page, options?: { dataQualityIssues?: ReturnType<typeof buildDataQualityIssues> }) {
  const dataQualityIssues = options?.dataQualityIssues ?? [];

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    if (pathname.startsWith('/api/workflow-reports/')) {
      const endpoint = pathname.split('/workflow-reports/')[1] ?? '';

      if (endpoint.startsWith('operational-kpis')) {
        await fulfillJson(route, {
          shortageCount: 0,
          lowStockCount: 0,
          overduePurchaseRequestCount: 0,
          lateReceiptCount: 0,
          pendingKitchenConfirmationCount: 0,
          failedWorkflowCount: 0,
          criticalDataQualityCount: dataQualityIssues.length,
          overdueApprovalCount: 0,
          generatedAt: '2026-07-11T05:30:00Z',
        });
        return;
      }

      if (endpoint.startsWith('data-quality')) {
        await fulfillJson(route, {
          generatedAt: '2026-07-11T05:30:00Z',
          totalIssues: dataQualityIssues.length,
          errorCount: dataQualityIssues.length,
          warningCount: 0,
          resolvedIssueCount: 0,
          reopenedIssueCount: 0,
          urgentIssueCount: dataQualityIssues.length,
          missingBomCount: 0,
          invalidUnitCount: 0,
          missingConversionCount: 0,
          negativeStockCount: 0,
          orphanDocumentCount: 0,
          page: {
            items: dataQualityIssues,
            totalCount: dataQualityIssues.length,
            pageNumber: 1,
            pageSize: 8,
            totalPages: dataQualityIssues.length ? 1 : 0,
            hasPrev: false,
            hasNext: false,
          },
          issues: dataQualityIssues,
        });
        return;
      }

      await fulfillJson(route, []);
      return;
    }

    if (pathname === '/api/auth/login') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Playwright mock login fallback' }),
      });
      return;
    }

    if (pathname === '/api/auth/profile') {
      await fulfillJson(route, {
        userId: '1',
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
      await fulfillJson(route, [
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
      ]);
      return;
    }

    if (pathname.startsWith('/api/coordination/weekly-menu')) {
      await fulfillJson(route, pathname.endsWith('/import-history') ? [] : null);
      return;
    }

    await fulfillJson(route, []);
  });
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'dev-admin',
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

async function navigateInApp(page: Page, path: string) {
  const targetUrl = new URL(path, 'http://127.0.0.1');
  const targetPath = `${targetUrl.pathname}${targetUrl.search}`;
  const pathname = `${new URL(page.url()).pathname}${new URL(page.url()).search}`;
  if (pathname === targetPath) {
    await expect(page.locator('.ipc-app-shell'), `route ${path}`).toBeVisible();
    return;
  }

  const navLink = page.locator(`a[href="${targetUrl.pathname}"]`).first();
  if (await navLink.count()) {
    await navLink.click();
    if (targetUrl.search) {
      await page.evaluate((nextPath) => {
        window.history.pushState({}, '', nextPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, targetPath);
    }
  } else {
    await page.evaluate((nextPath) => {
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, targetPath);
  }

  await expect(page).toHaveURL(new RegExp(`${targetUrl.pathname.replace('/', '\\/')}(\\?.*)?$`));
  await expect(page.locator('.ipc-app-shell'), `route ${path}`).toBeVisible();
}

async function stabilize(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001s !important;
        transition-duration: 0.001s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function collectLayoutIssues(page: Page, routeName: string, viewportName: string) {
  return page.evaluate(
    ({ routeName: evaluatedRouteName, viewportName: evaluatedViewportName }) => {
      const issues: AuditIssue[] = [];
      const isVisible = (element: HTMLElement) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const selectorFor = (element: HTMLElement) => {
        const id = element.id ? `#${element.id}` : '';
        const className = Array.from(element.classList).slice(0, 3).join('.');
        return `${element.tagName.toLowerCase()}${id}${className ? `.${className}` : ''}`;
      };
      const addIssue = (element: HTMLElement, reason: string) => {
        const rect = element.getBoundingClientRect();
        issues.push({
          route: evaluatedRouteName,
          viewport: evaluatedViewportName,
          selector: selectorFor(element),
          text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
          reason,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      };

      const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      if (scrollWidth > window.innerWidth + 2) {
        issues.push({
          route: evaluatedRouteName,
          viewport: evaluatedViewportName,
          selector: 'document',
          text: '',
          reason: `body horizontal overflow: ${scrollWidth}px > ${window.innerWidth}px`,
          width: scrollWidth,
          height: window.innerHeight,
        });
      }

      document.querySelectorAll<HTMLElement>('button, a.ipc-button, [role="button"]').forEach((element) => {
        if (!isVisible(element)) {
          return;
        }

        const text = (element.innerText || element.textContent || '').trim();
        if (text.length === 0) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const lines = (element.innerText || '').split('\n').map((line) => line.trim()).filter(Boolean);
        const characterCount = text.replace(/\s+/g, '').length;
        const verticalLetters = lines.length >= Math.min(2, characterCount) && lines.every((line) => line.length <= 2);
        const clipped = element.scrollWidth > element.clientWidth + 2;
        const isTableAction = Boolean(element.closest('td'));

        if (isTableAction && (verticalLetters || clipped || rect.width < 64)) {
          addIssue(element, 'table action control wraps or is too narrow');
        } else if (verticalLetters && rect.width < 80) {
          addIssue(element, 'control label wraps into vertical fragments');
        }
      });

      document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((dialog) => {
        if (!isVisible(dialog)) {
          return;
        }

        const label = [dialog.getAttribute('aria-label'), dialog.getAttribute('aria-labelledby')]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (!label) {
          addIssue(dialog, 'visible dialog has no accessible name');
        }
      });

      return issues;
    },
    { routeName, viewportName },
  );
}

async function expectNoAuditIssues(testName: string, issues: AuditIssue[]) {
  writeAuditReport(`ui-audit-${testName}`, issues);
  await test.info().attach('ui-audit-report', {
    body: JSON.stringify({ issueCount: issues.length, issues }, null, 2),
    contentType: 'application/json',
  });
  expect(issues).toEqual([]);
}

test.describe('ui audit', () => {
  for (const viewport of viewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('protected routes do not expose global overflow or broken action controls', async ({ page }) => {
        await stubAuditApi(page);
        await login(page);

        const issues: AuditIssue[] = [];
        for (const route of protectedRoutes) {
          await navigateInApp(page, route.path);
          await stabilize(page);
          issues.push(...await collectLayoutIssues(page, route.name, viewport.name));
        }

        await expectNoAuditIssues(`${viewport.name}-protected-routes`, issues);
      });

      test('admin data-quality stress table keeps actions readable', async ({ page }) => {
        await stubAuditApi(page, { dataQualityIssues: buildDataQualityIssues(12) });
        await login(page);
        await navigateInApp(page, `${ROUTES.ADMIN_DATA}?view=cleanup`);
        await expect(page.getByRole('tab', { name: 'Dữ liệu lỗi' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#admin-cleanup-panel')).toBeVisible();
        await expect(page.getByText('inventory_ledger_mismatch').first()).toBeVisible();
        await stabilize(page);

        await expectNoAuditIssues(
          `${viewport.name}-admin-data-quality-stress`,
          await collectLayoutIssues(page, 'admin-data-quality-stress', viewport.name),
        );
      });
    });
  }
});

test.describe('Phase 09 accessibility and responsive seam', () => {
  test('discovers focus, overflow, and role-feedback coverage', async () => {
    test.skip(true, 'Plan 09-14 owns Phase 09 accessibility, focus, and overflow assertions.');
  });
});
