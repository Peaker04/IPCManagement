import { expect, type Locator, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROUTES } from '../src/lib/routeConfig';
import { PHASE09_DATE, PHASE09_STAGE_LABELS, PHASE09_WEEK, phase09Workbench, stubPhase09Api } from './phase9-test-fixture';

type AuditIssue = {
  rule: string;
  route: string;
  viewport: string;
  selector: string;
  text: string;
  reason: string;
  width: number;
  height: number;
};

type InteractionOutcome = 'PASS' | 'GAP' | 'NOT_APPLICABLE' | 'NEEDS_EVIDENCE';

type InteractionRecord = {
  route: string;
  owner: string;
  state: string;
  viewport: string;
  outcome: InteractionOutcome;
  geometry: { width: number; height: number; scrollWidth: number; scrollHeight: number };
  focus: string;
  consoleErrors: string[];
  pageErrors: string[];
  nonReadRequests: string[];
};

type AuditUser = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  roleCode: string;
  roleName: string;
  isAdminFullAccess: boolean;
  permissions: string[];
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

const measurementViewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1365x900', width: 1365, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
] as const;

function writeAuditReport(name: string, issues: AuditIssue[], interactionRecords: InteractionRecord[] = []) {
  const reportPath = resolve(process.cwd(), 'test-results', `${name}.json`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    schemaVersion: 1,
    verdict: issues.length === 0 ? 'PASS' : 'FAIL',
    issueCount: issues.length,
    issues,
    interactionRecords,
  }, null, 2));
}

function observePage(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const nonReadRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') {
      nonReadRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return { consoleErrors, pageErrors, nonReadRequests };
}

async function collectInteractionRecord(
  page: Page,
  input: Pick<InteractionRecord, 'route' | 'owner' | 'state' | 'viewport'>,
  issues: AuditIssue[],
  signals: ReturnType<typeof observePage>,
): Promise<InteractionRecord> {
  const geometry = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  const focus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? 'none');
  const outcome: InteractionOutcome = issues.length > 0 || signals.consoleErrors.length > 0 || signals.pageErrors.length > 0 || signals.nonReadRequests.length > 0
    ? 'GAP'
    : 'PASS';
  return { ...input, outcome, geometry, focus, ...signals };
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
      entityLabel: `Tồn kho hiện tại / ${['Cá chua', 'Cá nục', 'Chanh', 'Đu đủ xanh'][index % 4]}`,
      message: `Tồn kho hiện tại ${quantity.toFixed(6)} kg không khớp sổ kho ${(quantity + (index % 2 === 0 ? 0.000001 : 80)).toFixed(6)} kg. Lệch ${(index % 2 === 0 ? 0.000001 : -80).toFixed(6)} kg.`,
      suggestedAction: 'Đối chiếu bút toán kho và tạo điều chỉnh tồn qua sổ kho, không sửa trực tiếp tồn kho hiện tại.',
      route: ROUTES.WAREHOUSE,
      remediationStatus: 'open',
    };
  });
}

async function stubAuditApi(page: Page, options?: {
  dataQualityIssues?: ReturnType<typeof buildDataQualityIssues>;
  profile?: AuditUser;
}) {
  const dataQualityIssues = options?.dataQualityIssues ?? [];
  const profile = options?.profile ?? {
    userId: '1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'admin',
    roleCode: 'ADMIN',
    roleName: 'Admin',
    isAdminFullAccess: true,
    permissions: ['*'],
  };

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

      if (endpoint === 'receipt-price-variance/page') {
        await fulfillJson(route, {
          items: [{
            receiptId: 'receipt-audit-1',
            receiptCode: 'PN-20260729-01',
            receiptDate: '2026-07-29',
            supplierId: 'supplier-a',
            supplierName: 'Nhà cung cấp A',
            ingredientId: 'ing-pork-rib',
            ingredientName: 'Sườn heo',
            unitId: 'unit-kg',
            unitName: 'kg',
            quantity: 12,
            unitPrice: 134000,
            referencePrice: 115000,
            variancePercent: 16.5,
            isWarning: true,
          }],
          totalCount: 1,
          pageNumber: 1,
          pageSize: 6,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        });
        return;
      }

      if (endpoint === 'current-stock/page') {
        await fulfillJson(route, {
          items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
        });
        return;
      }

      if (['price-variance/by-supplier/page', 'price-variance/by-period/page', 'price-variance/by-dish-group/page'].includes(endpoint)) {
        await fulfillJson(route, {
          items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
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
      await fulfillJson(route, profile);
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

    if (pathname === '/api/purchase-workflow/workbench') {
      await fulfillJson(route, phase09Workbench);
      return;
    }

    if (pathname === '/api/purchase-orders/page') {
      await fulfillJson(route, {
        page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false },
        orderCountByRequest: {},
      });
      return;
    }

    if (pathname === '/api/purchase-requests/page') {
      await fulfillJson(route, {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      });
      return;
    }

    if (pathname === '/api/supplemental-material-requests' || pathname === '/api/inventory-returns') {
      await fulfillJson(route, {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 100,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      });
      return;
    }

    await fulfillJson(route, []);
  });
}

async function stubApprovalAuditQueue(page: Page) {
  await page.route('**/api/approvals/inbox**', async (route) => fulfillJson(route, {
    items: [{
      inboxItemId: 'approval-ui-audit',
      targetType: 'purchase-request',
      targetId: 'pr-ui-audit',
      targetCode: 'PR-UI-AUDIT-01',
      itemType: 'purchase',
      title: 'Duyệt đơn mua nguyên liệu',
      source: 'PR-UI-AUDIT-01',
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
  }));
  await page.route('**/api/workflow-reports/workflow-documents**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-requests**', async (route) => fulfillJson(route, []));
  await page.route('**/api/approval-history/**', async (route) => fulfillJson(route, []));
}

async function login(page: Page, user?: AuditUser) {
  const authenticatedUser = user ?? {
    userId: 'dev-admin',
    username: 'admin',
    fullName: 'Admin User',
    role: 'admin',
    roleCode: 'ADMIN',
    roleName: 'Admin',
    isAdminFullAccess: true,
    permissions: ['*'],
  };
  await page.context().clearCookies();
  await page.addInitScript((storedUser) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({ ...storedUser, id: storedUser.userId }));
  }, authenticatedUser);
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
    if (!(await navLink.isVisible())) {
      const mobileNavigationToggle = page.locator('.ipc-mobile-nav-toggle');
      if (await mobileNavigationToggle.isVisible()) {
        await mobileNavigationToggle.click();
        await expect(mobileNavigationToggle).toHaveAttribute('aria-expanded', 'true');
      }
    }
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
      const addIssue = (element: HTMLElement, rule: string, reason: string) => {
        const rect = element.getBoundingClientRect();
        issues.push({
          rule,
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
          rule: 'C1',
          route: evaluatedRouteName,
          viewport: evaluatedViewportName,
          selector: 'document',
          text: '',
          reason: 'PAGE_H_SCROLL',
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
        const style = window.getComputedStyle(element);
        const clippedHorizontally = element.scrollWidth > element.clientWidth + 2;
        const clippedVertically = element.scrollHeight > element.clientHeight + 2;
        const isTableAction = Boolean(element.closest('td'));

        if (style.overflowWrap === 'anywhere' || style.wordBreak === 'break-all') {
          addIssue(element, 'C4', 'UNSAFE_WORD_BREAK');
        } else if (isTableAction && (verticalLetters || clippedHorizontally || clippedVertically || rect.width < 64)) {
          addIssue(element, 'C4', 'TABLE_ACTION_UNREADABLE');
        } else if (clippedHorizontally || clippedVertically) {
          addIssue(element, 'C4', 'CONTROL_CLIPPED');
        } else if (verticalLetters && rect.width < 80) {
          addIssue(element, 'C4', 'CONTROL_VERTICAL_WRAP');
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
          addIssue(dialog, 'A1', 'DIALOG_MISSING_NAME');
        }
      });

      return issues;
    },
    { routeName, viewportName },
  );
}

async function collectVisibleTabRecords(
  page: Page,
  routeName: string,
  viewportName: string,
  issues: AuditIssue[],
  signals: ReturnType<typeof observePage>,
) {
  const records: InteractionRecord[] = [];

  const geometry = () => page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  const recordNeedsEvidence = async (owner: string, state: string, focus: string) => {
    records.push({
      route: routeName,
      owner,
      state,
      viewport: viewportName,
      outcome: 'NEEDS_EVIDENCE',
      geometry: await geometry(),
      focus,
      consoleErrors: [...signals.consoleErrors],
      pageErrors: [...signals.pageErrors],
      nonReadRequests: [...signals.nonReadRequests],
    });
  };
  const visitTablist = async (tablist: Locator): Promise<void> => {
    const tabIds = await tablist.getByRole('tab').evaluateAll((tabs) => tabs
      .filter((tab): tab is HTMLElement => tab instanceof HTMLElement && tab.offsetParent !== null && !tab.hasAttribute('disabled'))
      .map((tab) => tab.id)
      .filter(Boolean));

    for (const tabId of tabIds) {
      const tab = page.locator(`[role="tab"]#${tabId}`);
      if (!await tab.isVisible().catch(() => false)) {
        await recordNeedsEvidence(tabId, 'tab-unavailable-in-owning-panel', 'tab-unmounted');
        continue;
      }
      const panelId = await tab.getAttribute('aria-controls', { timeout: 1_000 }).catch(() => null);
      try {
        await tab.click({ timeout: 1_000 });
        await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
      } catch {
        await recordNeedsEvidence(tabId, 'tab-activation-not-settled', 'tab-owner-remounted');
        continue;
      }

      await stabilize(page);
      const tabIssues = await collectLayoutIssues(page, routeName, viewportName);
      issues.push(...tabIssues);
      records.push(await collectInteractionRecord(page, {
        route: routeName,
        owner: tabId,
        state: 'tab-active',
        viewport: viewportName,
      }, tabIssues, signals));

      if (!panelId) continue;
      const panel = page.locator(`#${panelId}`);
      try {
        await expect(panel).toBeVisible({ timeout: 2_000 });
      } catch {
        const diagnostic = await page.evaluate(({ tabId: activeTabId, panelId: activePanelId }) => JSON.stringify({
          href: window.location.href,
          selected: document.getElementById(activeTabId)?.getAttribute('aria-selected'),
          panel: document.getElementById(activePanelId)?.getAttribute('style') ?? 'missing',
        }), { tabId, panelId });
        await recordNeedsEvidence(tabId, 'tab-panel-unavailable-after-activation', diagnostic);
        continue;
      }
      const nestedTablists = panel.locator('[role="tablist"]');
      for (let index = 0; index < await nestedTablists.count(); index += 1) {
        await visitTablist(nestedTablists.nth(index));
      }
    }
  };

  const rootTablistLabels = await page.locator('[role="tablist"]').evaluateAll((tablists) => tablists
    .filter((tablist) => !tablist.closest('[role="tabpanel"]'))
    .map((tablist) => tablist.getAttribute('aria-label'))
    .filter((label): label is string => Boolean(label)));
  for (const label of rootTablistLabels) {
    const tablist = page.getByRole('tablist', { name: label });
    if (await tablist.isVisible().catch(() => false)) await visitTablist(tablist);
  }

  return records;
}

async function expectNoAuditIssues(testName: string, issues: AuditIssue[], interactionRecords: InteractionRecord[] = []) {
  const incompleteRecords = interactionRecords.filter(({ outcome }) => outcome !== 'PASS');
  writeAuditReport(`ui-audit-${testName}`, issues, interactionRecords);
  await test.info().attach('ui-audit-report', {
    body: JSON.stringify({
      schemaVersion: 1,
      verdict: issues.length === 0 && incompleteRecords.length === 0 ? 'PASS' : incompleteRecords.length > 0 ? 'NEEDS_EVIDENCE' : 'FAIL',
      issueCount: issues.length,
      issues,
      interactionRecords,
    }, null, 2),
    contentType: 'application/json',
  });
  expect(issues).toEqual([]);
  expect(incompleteRecords).toEqual([]);
}

test.describe('UI measurement audit', () => {
  for (const viewport of measurementViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('protected routes do not expose global overflow or broken action controls', async ({ page }) => {
        await stubAuditApi(page);
        await login(page);

        const issues: AuditIssue[] = [];
        const interactionRecords: InteractionRecord[] = [];
        for (const route of protectedRoutes) {
          const signals = observePage(page);
          await page.goto(route.path);
          await expect(page.locator('.ipc-app-shell'), `route ${route.path}`).toBeVisible();
          await stabilize(page);
          const routeIssues = await collectLayoutIssues(page, route.name, viewport.name);
          issues.push(...routeIssues);
          interactionRecords.push(await collectInteractionRecord(page, {
            route: route.name,
            owner: 'route-default',
            state: 'ready',
            viewport: viewport.name,
          }, routeIssues, signals));
          if (route.name === 'reports') {
            const action = page.getByRole('button', { name: 'Xem đề xuất xử lý cho Sườn heo' });
            await expect(action).toBeVisible();
            await action.focus();
            await expect(action).toBeFocused();
            const actionGeometry = await action.evaluate((element) => ({
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              whiteSpace: getComputedStyle(element).whiteSpace,
            }));
            expect(actionGeometry.whiteSpace).toBe('nowrap');
            expect(actionGeometry.scrollWidth).toBeLessThanOrEqual(actionGeometry.clientWidth + 1);
            await action.click();
            await expect(page.locator('#reports-price-warning-detail')).toBeVisible();
            interactionRecords.push(await collectInteractionRecord(page, {
              route: 'reports',
              owner: 'ReportsPricePanel',
              state: 'price-variance-warning-detail',
              viewport: viewport.name,
            }, await collectLayoutIssues(page, route.name, viewport.name), signals));
          }
          interactionRecords.push(...await collectVisibleTabRecords(page, route.name, viewport.name, issues, signals));
        }

        await expectNoAuditIssues(`${viewport.name}-protected-routes`, issues, interactionRecords);
      });

      test('warehouse route renders the named forbidden state for a user without warehouse access', async ({ page }) => {
        const noWarehouseAccess: AuditUser = {
          userId: 'audit-procurement',
          username: 'audit-procurement',
          fullName: 'Audit Procurement User',
          role: 'procurement',
          roleCode: 'PROCUREMENT',
          roleName: 'Thu mua',
          isAdminFullAccess: false,
          permissions: ['purchase.read'],
        };
        await stubAuditApi(page, { profile: noWarehouseAccess });
        const signals = observePage(page);
        await login(page, noWarehouseAccess);
        await page.goto(ROUTES.WAREHOUSE);

        await expect(page).toHaveURL(ROUTES.FORBIDDEN);
        await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Kho nguyên liệu' })).toHaveCount(0);

        const issues = await collectLayoutIssues(page, 'warehouse-forbidden', viewport.name);
        await expectNoAuditIssues(
          `${viewport.name}-warehouse-forbidden`,
          issues,
          [await collectInteractionRecord(page, {
            route: 'warehouse',
            owner: 'RoleGuard',
            state: 'forbidden-no-warehouse-read',
            viewport: viewport.name,
          }, issues, signals)],
        );
      });

      test('safe dialogs remain named, modal, focus-contained, and non-mutating', async ({ page }) => {
        await stubAuditApi(page);
        await stubApprovalAuditQueue(page);
        const signals = observePage(page);
        await login(page);
        const issues: AuditIssue[] = [];
        const records: InteractionRecord[] = [];

        await page.goto(ROUTES.WEEKLY_MENU);
        for (const dialogCase of [
          {
            owner: 'WeeklyMenuImportDialog',
            trigger: page.getByRole('button', { name: 'Nhập Excel' }),
            dialog: page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' }),
            close: (dialog: ReturnType<Page['getByRole']>) => dialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' }),
          },
          {
            owner: 'WeeklyScheduleEditorDialog',
            trigger: page.getByRole('button', { name: 'Chỉnh sửa thực đơn' }),
            dialog: page.getByRole('dialog', { name: 'Chỉnh sửa thực đơn tuần' }),
            close: (dialog: ReturnType<Page['getByRole']>) => dialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' }),
          },
        ]) {
          await dialogCase.trigger.focus();
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          await dialogCase.trigger.click();
          await expect(dialogCase.dialog).toBeVisible();
          await expect(dialogCase.dialog).toHaveAttribute('aria-modal', 'true');
          expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(clientWidth);
          await page.keyboard.press('Tab');
          await expect.poll(() => dialogCase.dialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
          const dialogIssues = await collectLayoutIssues(page, 'weekly-menu', viewport.name);
          issues.push(...dialogIssues);
          records.push(await collectInteractionRecord(page, {
            route: 'weekly-menu', owner: dialogCase.owner, state: 'safe-dialog-open', viewport: viewport.name,
          }, dialogIssues, signals));
          await dialogCase.close(dialogCase.dialog).click();
          await expect(dialogCase.dialog).toBeHidden();
          await expect(dialogCase.trigger).toBeFocused();
        }

        await page.goto(ROUTES.APPROVALS);
        const approvalTrigger = page.getByRole('button', { name: 'Duyệt chứng từ', exact: true }).first();
        await approvalTrigger.focus();
        const approvalClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        await approvalTrigger.click();
        const approvalDialog = page.getByRole('dialog', { name: 'Duyệt đề xuất mua?' });
        await expect(approvalDialog).toBeVisible();
        await expect(approvalDialog).toHaveAttribute('aria-modal', 'true');
        expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(approvalClientWidth);
        await page.keyboard.press('Tab');
        await expect.poll(() => approvalDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
        const approvalIssues = await collectLayoutIssues(page, 'approvals', viewport.name);
        issues.push(...approvalIssues);
        records.push(await collectInteractionRecord(page, {
          route: 'approvals', owner: 'ApprovalPage', state: 'safe-dialog-open', viewport: viewport.name,
        }, approvalIssues, signals));
        await approvalDialog.getByRole('button', { name: 'Giữ đề xuất mua' }).click();
        await expect(approvalDialog).toBeHidden();
        await expect(approvalTrigger).toBeFocused();

        await expectNoAuditIssues(`${viewport.name}-safe-dialogs`, issues, records);
      });

      test('admin data-quality stress table keeps actions readable', async ({ page }) => {
        await stubAuditApi(page, { dataQualityIssues: buildDataQualityIssues(12) });
        await login(page);
        await navigateInApp(page, `${ROUTES.ADMIN_DATA}?view=cleanup`);
        await expect(page.getByRole('tab', { name: 'Dữ liệu lỗi' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#admin-cleanup-panel')).toBeVisible();
        await expect(page.getByText('Tồn kho lệch sổ').first()).toBeVisible();
        await expect(page.getByText(/Current stock|Currentstock|stock movements|ledger/i)).toHaveCount(0);
        await stabilize(page);

        await expectNoAuditIssues(
          `${viewport.name}-admin-data-quality-stress`,
          await collectLayoutIssues(page, 'admin-data-quality-stress', viewport.name),
        );
      });

      test('warehouse receipt lifecycle renders its read-error boundary without a mutation', async ({ page }) => {
        await stubAuditApi(page);
        await page.route('**/api/inventory-receipts?**', async (route) => {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Read-only fixture failure' }),
          });
        });
        await login(page);
        const expectedFailure = page.waitForResponse((response) => response.url().includes('/api/inventory-receipts?') && response.status() === 503);
        await page.goto(ROUTES.WAREHOUSE);

        const lifecyclePanel = page.getByTestId('receipt-lifecycle-panel');
        await expect(lifecyclePanel).toBeVisible();
        await expect(lifecyclePanel).toHaveAttribute('aria-busy', 'false');
        await expect(page.getByText('Không tải được phiếu nhập cần xử lý', { exact: true })).toBeVisible();
        expect((await expectedFailure).status()).toBe(503);
        const signals = observePage(page);
        await expectNoAuditIssues(
          `${viewport.name}-warehouse-receipt-error`,
          await collectLayoutIssues(page, 'warehouse-receipt-error', viewport.name),
          [await collectInteractionRecord(page, {
            route: 'warehouse',
            owner: 'WarehouseReceiptLifecyclePanel',
            state: 'error',
            viewport: viewport.name,
          }, [], signals)],
        );
      });

      test('warehouse receipt lifecycle renders an explicit empty read state without a mutation', async ({ page }) => {
        await stubAuditApi(page);
        await page.route('**/api/inventory-receipts?**', async (route) => {
          await fulfillJson(route, {
            items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false,
          });
        });
        await login(page);
        await page.goto(ROUTES.WAREHOUSE);

        const signals = observePage(page);
        const lifecyclePanel = page.getByTestId('receipt-lifecycle-panel');
        await expect(lifecyclePanel).toBeVisible();
        await expect(lifecyclePanel).toHaveAttribute('aria-busy', 'false');
        await expect(page.getByText('Chưa có phiếu nhập cần xử lý trong trang này.', { exact: true })).toBeVisible();
        await expectNoAuditIssues(
          `${viewport.name}-warehouse-receipt-empty`,
          await collectLayoutIssues(page, 'warehouse-receipt-empty', viewport.name),
          [await collectInteractionRecord(page, {
            route: 'warehouse',
            owner: 'WarehouseReceiptLifecyclePanel',
            state: 'empty',
            viewport: viewport.name,
          }, [], signals)],
        );
      });

      test('warehouse receipt lifecycle reserves its measured space only while the read is loading', async ({ page }) => {
        await stubAuditApi(page);
        let releaseReceiptRead: (() => void) | undefined;
        await page.route('**/api/inventory-receipts?**', async (route) => {
          await new Promise<void>((resolve) => { releaseReceiptRead = resolve; });
          await fulfillJson(route, {
            items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false,
          });
        });
        await login(page);
        const navigation = page.goto(ROUTES.WAREHOUSE, { waitUntil: 'domcontentloaded' });

        const lifecyclePanel = page.getByTestId('receipt-lifecycle-panel');
        await expect(lifecyclePanel).toHaveAttribute('aria-busy', 'true');
        const loadingHeight = await lifecyclePanel.evaluate((element) => element.getBoundingClientRect().height);
        releaseReceiptRead?.();
        await navigation;
        await expect(lifecyclePanel).toHaveAttribute('aria-busy', 'false');
        const emptyHeight = await lifecyclePanel.evaluate((element) => element.getBoundingClientRect().height);
        expect(emptyHeight).toBeLessThan(loadingHeight);
      });
    });
  }
});

test.describe('shared tabs Material and Fiori contract', () => {
  for (const viewport of [
    { name: 's-390', width: 390, height: 844, minimumHeight: 44 },
    { name: 'm-768', width: 768, height: 1024, minimumHeight: 36 },
    { name: 'l-1280', width: 1280, height: 900, minimumHeight: 36 },
    { name: 'xl-1440', width: 1440, height: 900, minimumHeight: 36 },
  ] as const) {
    test(`keeps labels stable and single-line at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await stubAuditApi(page);
      await login(page);

      const issues: AuditIssue[] = [];
      for (const route of protectedRoutes) {
        await navigateInApp(page, route.path);
        await stabilize(page);
        issues.push(...await page.locator('[role="tablist"]').evaluateAll(
          (tabLists, context) => tabLists.flatMap((tabList, listIndex) => {
            const list = tabList as HTMLElement;
            const listStyle = window.getComputedStyle(list);
            const listRect = list.getBoundingClientRect();
            if (listRect.width === 0 || listRect.height === 0) return [];

            const findings: AuditIssue[] = [];
            const addFinding = (element: HTMLElement, reason: string) => {
              const rect = element.getBoundingClientRect();
              findings.push({
                rule: 'C2',
                route: context.route,
                viewport: context.viewport,
                selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`,
                text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
                reason,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              });
            };

            if (listStyle.flexWrap !== 'nowrap') {
              addFinding(list, `tablist ${listIndex + 1} allows wrapped rows`);
            }
            if (!['auto', 'scroll'].includes(listStyle.overflowX)) {
              addFinding(list, `tablist ${listIndex + 1} has no intentional horizontal overflow`);
            }
            if (Number.parseFloat(listStyle.paddingLeft) > 0 || Number.parseFloat(listStyle.paddingRight) > 0) {
              addFinding(list, `tablist ${listIndex + 1} leaves an inset around the active indicator`);
            }
            if (listStyle.scrollbarWidth !== 'none') {
              addFinding(list, `tablist ${listIndex + 1} exposes a horizontal scrollbar`);
            }

            const borderHeight = Number.parseFloat(listStyle.borderTopWidth) + Number.parseFloat(listStyle.borderBottomWidth);
            if (list.offsetHeight - list.clientHeight - borderHeight > 1) {
              addFinding(list, `tablist ${listIndex + 1} reserves visible scrollbar height`);
            }

            list.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab) => {
              const style = window.getComputedStyle(tab);
              const rect = tab.getBoundingClientRect();
              if (style.whiteSpace !== 'nowrap') addFinding(tab, 'tab label can wrap');
              if (rect.height + 1 < context.minimumHeight) addFinding(tab, `tab target is below ${context.minimumHeight}px`);
              if (tab.scrollWidth > tab.clientWidth + 1 || tab.scrollHeight > tab.clientHeight + 1) {
                addFinding(tab, 'tab label is clipped');
              }
              if (tab.getAttribute('aria-selected') === 'true' && style.animationName !== 'none') {
                addFinding(tab, `active tab flashes through animation ${style.animationName}`);
              }
              if (style.transitionProperty !== 'none') addFinding(tab, 'tab active state is animated and can flash');
            });

            return findings;
          }),
          { route: route.name, viewport: viewport.name, minimumHeight: viewport.minimumHeight },
        ));
      }

      await expectNoAuditIssues(`tabs-${viewport.name}`, issues);

      await navigateInApp(page, ROUTES.APPROVALS);
      await stabilize(page);
      const approvalTabs = page.getByRole('tablist', { name: 'Chọn góc nhìn duyệt vận hành' });
      await approvalTabs.scrollIntoViewIfNeeded();
      const initialMetrics = await approvalTabs.evaluate((list) => {
        const listRect = list.getBoundingClientRect();
        const style = window.getComputedStyle(list);
        const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
        const firstRect = tabs[0].getBoundingClientRect();
        const lastRect = tabs.at(-1)!.getBoundingClientRect();
        return {
          widths: tabs.map((tab) => tab.getBoundingClientRect().width),
          leftInset: firstRect.left - listRect.left - Number.parseFloat(style.borderLeftWidth),
          rightInset: listRect.right - Number.parseFloat(style.borderRightWidth) - lastRect.right,
        };
      });
      expect(Math.abs(initialMetrics.leftInset)).toBeLessThanOrEqual(1);
      expect(Math.abs(initialMetrics.rightInset)).toBeLessThanOrEqual(1);

      for (const tab of await approvalTabs.getByRole('tab').all()) {
        const scrollY = await page.evaluate(() => window.scrollY);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        const currentMetrics = await approvalTabs.evaluate((list) => ({
          scrollY: window.scrollY,
          widths: [...list.querySelectorAll<HTMLElement>('[role="tab"]')].map((item) => item.getBoundingClientRect().width),
        }));
        expect(Math.abs(currentMetrics.scrollY - scrollY)).toBeLessThanOrEqual(1);
        currentMetrics.widths.forEach((width, index) => {
          expect(Math.abs(width - initialMetrics.widths[index])).toBeLessThanOrEqual(0.5);
        });
      }

      await navigateInApp(page, `${ROUTES.ADMIN_DATA}?view=bom-import`);
      await stabilize(page);
      await expect(page.getByRole('tablist', { name: 'Chọn dữ liệu BOM hiển thị' })).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText('BOM đang áp dụng');
    });
  }
});

test.describe('Phase 09 accessibility and responsive seam', () => {
  for (const viewport of [
    { name: '1365x900', width: 1365, height: 900 },
    { name: '1280x900', width: 1280, height: 900 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '390x844', width: 390, height: 844 },
  ] as const) {
    test(`keeps Phase 09 operable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await stubAuditApi(page);
      await stubPhase09Api(page);
      await login(page);
      await navigateInApp(page, `${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`);

      const guide = page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
      for (const label of PHASE09_STAGE_LABELS) {
        await expect(guide.getByRole('button', { name: new RegExp(label) })).toBeVisible();
      }
      const stageLabelHeights = await guide.locator('[data-stage-label]').evaluateAll((labels) => labels.map((label) => {
        const style = window.getComputedStyle(label);
        const lineHeight = Number.parseFloat(style.lineHeight);
        return { height: label.getBoundingClientRect().height, lineHeight };
      }));
      stageLabelHeights.forEach(({ height, lineHeight }) => {
        expect(height).toBeLessThanOrEqual(lineHeight * 2 + 1);
      });

      const stageButton = guide.getByRole('button', { name: new RegExp(PHASE09_STAGE_LABELS[0]) });
      await stageButton.focus();
      await expect(stageButton).toBeFocused();
      const tableRegion = page.getByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' });
      await expect(tableRegion).toBeVisible();
      await expect(tableRegion).toHaveAttribute('tabindex', '0');
      await stabilize(page);
      await expectNoAuditIssues(
        `phase09-${viewport.name}`,
        await collectLayoutIssues(page, 'purchasing-phase09', viewport.name),
      );
    });
  }
});
