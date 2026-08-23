import { expect, type Browser, type Locator, type Page, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROUTES } from '../src/lib/routeConfig';
import { PHASE09_DATE, PHASE09_STAGE_LABELS, PHASE09_WEEK, phase09Workbench, stubPhase09Api } from './phase9-test-fixture';
import { collectWarehouseEvidence, writeWarehouseCaptureManifest } from './warehouseEvidenceCollector';
import { currentStockRows, mixedEmptyFixture, noWarehouseReadActor, stockMovementRows, warehouseDocuments, warehouseKeeperActor } from './warehouseDataWorkspaceFixture';
import { validateWarehouseAiFinding, validateWarehouseAiReviewInput, validateWarehouseCaptureManifest, WAREHOUSE_SCENARIOS, WAREHOUSE_VIEWPORTS, type WarehouseCapture, type WarehouseCaptureManifest, type WarehouseScenario } from './warehouseDataWorkspaceContract';
import { buildWarehouseSelectionManifest, evaluateWarehouseManifest } from './warehouseDeterministicRules';
import { routeMeasuredFinding, UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, validateUiAuditRecord, type UiAuditRecord } from './uiAuditContract';
import { ruleFixtureRegistry } from './uiAuditFixtureRegistry';
import { uiAuditOracleRegistry, UI_AUDIT_RULE_IDS, type UiAuditRuleId } from './uiAuditOracleRegistry';
import { isLedgerRequest } from './uiAuditEvidence';
import { identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';

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
  warehouseScenario?: Exclude<WarehouseScenario, 'route-forbidden'>;
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
        const items = options?.warehouseScenario === 'ready' ? currentStockRows : options?.warehouseScenario === 'mixed-empty' ? mixedEmptyFixture.currentStockRows : [];
        await fulfillJson(route, {
          items, totalCount: items.length, pageNumber: 1, pageSize: 8, totalPages: items.length ? 1 : 0, hasPrev: false, hasNext: false,
        });
        return;
      }

      if (endpoint === 'stock-movements/page' && options?.warehouseScenario) {
        await fulfillJson(route, { items: stockMovementRows, limit: 8, hasNext: false, nextCursorDate: null, nextCursorId: null, nextCursorOffset: null });
        return;
      }

      if (endpoint === 'workflow-documents' && options?.warehouseScenario) {
        await fulfillJson(route, warehouseDocuments);
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

const WAREHOUSE_AFTER_RUN_ID = 'phase27-h1-after-20260822T205000Z';

async function captureWarehouseBaseline(
  browser: Browser,
  run: { directory: 'baseline' | 'after'; runId?: string } = { directory: 'baseline' },
) {
  const captures = [];
  for (const scenario of WAREHOUSE_SCENARIOS) for (const viewport of WAREHOUSE_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const actor = scenario === 'route-forbidden' ? noWarehouseReadActor : warehouseKeeperActor;
    await stubAuditApi(page, { profile: actor, warehouseScenario: scenario === 'route-forbidden' ? undefined : scenario });
    const signals = observePage(page); await login(page, actor); await page.goto(ROUTES.WAREHOUSE);
    if (scenario === 'route-forbidden') {
      await expect(page).toHaveURL(ROUTES.FORBIDDEN); await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập' })).toBeVisible();
    } else {
      await expect(page.getByRole('tab', { name: 'Luân chuyển' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('region', { name: 'Bảng tồn kho hiện tại trong kho' })).toBeVisible(); await expect(page.getByText('PN-P27-001')).toBeVisible();
      if (scenario === 'mixed-empty') { await expect(page.getByText('Chưa có dữ liệu tồn kho')).toBeVisible(); await expect(page.getByText('PX-P27-001').first()).toBeVisible(); }
    }
    await stabilize(page);
    const { record, path } = await collectWarehouseEvidence(page, signals, scenario, viewport, run); captures.push(record);
    await test.info().attach(`warehouse-${scenario}-${viewport.id}`, { path, contentType: 'application/json' }); await context.close();
  }
  const output = await writeWarehouseCaptureManifest(captures, run);
  await test.info().attach('warehouse-data-workspace-manifest', { path: output.path, contentType: 'application/json' });
  return output;
}

test.describe('Warehouse Data Workspace contract baseline', () => {
  test('captures the immutable three-state by five-viewport matrix', async ({ browser }) => {
    const { manifest } = await captureWarehouseBaseline(browser);
    expect(manifest.captures).toHaveLength(15); expect(new Set(manifest.captures.map(({ identity }) => identity)).size).toBe(15);
  });
});

test.describe('Warehouse Data Workspace contract fresh post-refactor evidence', () => {
  test('captures fresh identities and runs deterministic rules before selection', async ({ browser }) => {
    const run = { directory: 'after', runId: WAREHOUSE_AFTER_RUN_ID } as const;
    const { manifest } = await captureWarehouseBaseline(browser, run);
    expect(manifest.captures).toHaveLength(15);
    expect(manifest.captures.every(({ identity }) => identity.startsWith(`${WAREHOUSE_AFTER_RUN_ID}/`))).toBe(true);

    const report = evaluateWarehouseManifest(manifest);
    const after = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'after');
    writeFileSync(resolve(after, 'deterministic-findings.json'), JSON.stringify(report, null, 2));
    expect(report.stage).toBe('deterministic-before-ai');
    expect(report.verdict).toBe('PASS');
    expect(report.findings.every(({ verdict }) => verdict === 'PASS')).toBe(true);
    const selection = buildWarehouseSelectionManifest(manifest, report);
    writeFileSync(resolve(after, 'selection-manifest.json'), JSON.stringify(selection, null, 2));
    expect(selection.deterministicVerdict).toBe('PASS');
    expect(selection.selected).toHaveLength(6);
    expect(selection.selected.some(({ state }) => state === 'route-forbidden')).toBe(true);
    expect(selection.selected.every(({ captureIdentity }) => captureIdentity.startsWith(`${WAREHOUSE_AFTER_RUN_ID}/`))).toBe(true);
    const forbiddenRecord = manifest.captures.find(({ state, viewport }) => state === 'route-forbidden' && viewport.id === '1440x900');
    expect(forbiddenRecord?.document.h1Count).toBe(1);
    expect(forbiddenRecord?.document.headingLevels).toContain(2);
    const selectedReady = selection.selected.find(({ state }) => state === 'ready');
    expect(selectedReady).toBeDefined();
    const selectedReadyRecord = JSON.parse(readFileSync(resolve(after, selectedReady!.recordPath), 'utf8')) as WarehouseCapture;
    expect(selectedReadyRecord.ariaSnapshot).toContain('Kho chính');
    expect(selectedReadyRecord.ariaSnapshot).toContain('Gạo tẻ');
    expect(selectedReadyRecord.ariaSnapshot).toContain('kg');
    expect(selectedReadyRecord.ariaSnapshot).not.toContain('warehouse-phase27-main');
    expect(selectedReadyRecord.ariaSnapshot).not.toMatch(/ingredient-phase27-\d+/);
  });
});

test.describe('Warehouse Data Workspace responsive contract', () => {
  test('keeps one primary-to-rail DOM order and transforms at the measured adjacent viewports', async ({ browser }) => {
    for (const expected of [
      { width: 1366, height: 768, relation: 'side-by-side' },
      { width: 1365, height: 900, relation: 'stacked' },
    ] as const) {
      const context = await browser.newContext({ viewport: { width: expected.width, height: expected.height } });
      const page = await context.newPage();
      await stubAuditApi(page, { profile: warehouseKeeperActor, warehouseScenario: 'ready' });
      await login(page, warehouseKeeperActor);
      await page.goto(ROUTES.WAREHOUSE);
      await expect(page.getByRole('tab', { name: 'Luân chuyển' })).toHaveAttribute('aria-selected', 'true');
      const workbench = page.locator('.ipc-split-workbench--wide-detail-rail');
      await expect(workbench).toHaveCount(1);
      const relation = await workbench.evaluate((node) => {
        const [primary, rail] = Array.from(node.children) as HTMLElement[];
        const primaryBox = primary.getBoundingClientRect();
        const railBox = rail.getBoundingClientRect();
        return {
          order: [primary.className, rail.className],
          relation: railBox.x >= primaryBox.right - 0.5 ? 'side-by-side' : railBox.y >= primaryBox.bottom - 0.5 ? 'stacked' : 'overlap',
        };
      });
      expect(relation.order).toEqual(['ipc-split-primary', 'ipc-split-detail-strip']);
      expect(relation.relation).toBe(expected.relation);
      await expect(page.getByRole('complementary', { name: 'Phiếu kho' })).toHaveCount(1);
      await context.close();
    }
  });
});

test.describe('Warehouse Data Workspace deterministic baseline', () => {
  test('evaluates the complete machine evidence before writing the bounded selection', async ({ browser }) => {
    const baseline = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'baseline');
    if (!existsSync(resolve(baseline, 'manifest.json'))) await captureWarehouseBaseline(browser);
    const manifest = JSON.parse(readFileSync(resolve(baseline, 'manifest.json'), 'utf8')) as WarehouseCaptureManifest;
    validateWarehouseCaptureManifest(manifest);
    const report = evaluateWarehouseManifest(manifest);
    const selection = buildWarehouseSelectionManifest(manifest, report);
    writeFileSync(resolve(baseline, 'deterministic-findings.json'), JSON.stringify(report, null, 2));
    writeFileSync(resolve(baseline, 'selection-manifest.json'), JSON.stringify(selection, null, 2));
    expect(report.stage).toBe('deterministic-before-ai');
    expect(report.verdict).toBe('FAIL');
    expect(report.findings.filter(({ ruleId, verdict }) => ruleId === 'D05-RESPONSIVE-RELATION' && verdict === 'FAIL').length).toBeGreaterThan(0);
    expect(report.findings.filter(({ verdict }) => verdict !== 'PASS').every(({ selector, metric, owner }) => selector && metric && owner.source)).toBe(true);
    expect(selection.selected).toHaveLength(6);
    expect(selection.selected.every(({ reasons, recordPath }) => reasons.length > 0 && readFileSync(resolve(baseline, recordPath)).length > 0)).toBe(true);
  });
});

test.describe('Warehouse Data Workspace AI selection contract', () => {
  test('validates the attested bounded reviewer packet and authorization queue', () => {
    const baseline = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'baseline');
    const input = JSON.parse(readFileSync(resolve(baseline, 'ai-review-input.json'), 'utf8'));
    const output = JSON.parse(readFileSync(resolve(baseline, 'ai-findings.json'), 'utf8'));
    expect(() => validateWarehouseAiReviewInput(input)).not.toThrow();
    expect(output.findings).toHaveLength(3);
    output.findings.forEach(validateWarehouseAiFinding);
    expect(output.findings.every(({ verdict }: { verdict: string }) => verdict === 'FAIL')).toBe(true);
  });
});

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

test.describe('Phase 28 hierarchy token container cohort', () => {
  test('headed shared-registry fixture records are schema valid', async ({ page }) => {
    await page.setContent('<main><h1>Phase 28 fixture</h1><section aria-label="Audit fixture"><button>Run</button></section></main>');
    const cohort: UiAuditRuleId[] = ['HIER-01','HIER-02','TOK-SP-01','TOK-TY-01','TOK-CO-01','CONT-01','CONT-02','ORDER-01'];
    const records = cohort.flatMap((ruleId): UiAuditRecord[] => ruleFixtureRegistry.filter((fixture) => fixture.ruleId === ruleId).map((fixture) => ({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity: fixture.input.identity, fixtureKey: fixture.key, findings: uiAuditOracleRegistry[ruleId].evaluate(fixture.input), network: [] })));
    records.forEach(validateUiAuditRecord);
    expect(records).toHaveLength(16);
    writeAuditReport('ui-audit-phase28-hierarchy-token-container', records.flatMap(({ findings }) => findings).map((finding) => ({ rule: finding.ruleId, route: 'fixture', viewport: 'controlled', selector: 'fixture', text: finding.actual ?? '', reason: finding.expected ?? '', width: 0, height: 0 })));
  });
});

test.describe('Phase 28 table query interaction cohort', () => {
  test('intercepts mutation-like traffic and emits paired records', async ({ page }) => {
    const escaped: string[] = [];
    await page.route('**/*', async (route) => {
      if (!['GET','HEAD'].includes(route.request().method())) { escaped.push(`${route.request().method()} ${route.request().url()}`); await route.abort(); return; }
      await route.continue();
    });
    await page.setContent('<main><h1>Table fixture</h1><table aria-label="Rows"><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table></main>');
    const cohort: UiAuditRuleId[] = ['TABLE-01','TABLE-02','TABLE-03','QUERY-01','QUERY-02','FILTER-01','SORT-01','COL-01','BADGE-01','PAGE-01','MUT-01','REFRESH-01'];
    const records = cohort.flatMap((ruleId): UiAuditRecord[] => ruleFixtureRegistry.filter((fixture) => fixture.ruleId === ruleId).map((fixture) => ({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity: fixture.input.identity, fixtureKey: fixture.key, findings: uiAuditOracleRegistry[ruleId].evaluate(fixture.input), network: [] })));
    records.forEach(validateUiAuditRecord); expect(records).toHaveLength(24); expect(escaped).toEqual([]);
  });
});

test.describe('Phase 28 accessibility responsive motion performance cohort', () => {
  test('runs official axe and emits final paired cohort records', async ({ page }) => {
    await page.setContent('<!doctype html><html lang="vi"><head><title>Phase 28 accessible fixture</title></head><body><main><h1>Accessible fixture</h1><button aria-label="Run audit">Run audit</button></main></body></html>');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
    const cohort: UiAuditRuleId[] = ['A11Y-01','A11Y-02','A11Y-03','RESP-01','RESP-02','RESP-WH-01','WH-01','WH-02','WH-03','MOTION-01','PERF-01'];
    const records = cohort.flatMap((ruleId): UiAuditRecord[] => ruleFixtureRegistry.filter((fixture) => fixture.ruleId === ruleId).map((fixture) => ({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity: fixture.input.identity, fixtureKey: fixture.key, findings: uiAuditOracleRegistry[ruleId].evaluate(fixture.input), network: [] })));
    records.forEach(validateUiAuditRecord); expect(records).toHaveLength(22);
  });
});

test.describe('Phase 28 login production-route baseline bridge', () => {
  test('measures LoginPage populated state across the exact audit viewport matrix', async ({ page }) => {
    const observed: UiAuditRecord['network'] = [];
    page.on('request', (request) => {
      if (isLedgerRequest(request.url(), request.method(), request.resourceType(), 'http://127.0.0.1:5173')) {
        observed.push({ method: request.method(), url: request.url(), resourceType: request.resourceType(), classification: request.url().includes('/api/') ? 'api' : 'non-static' });
      }
    });
    await page.route('**/*', async (route) => {
      if (!['GET', 'HEAD'].includes(route.request().method())) { await route.abort(); return; }
      await route.continue();
    });

    const records: UiAuditRecord[] = [];
    for (const viewport of UI_AUDIT_VIEWPORTS) {
      const ledgerStart = observed.length;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.context().clearCookies();
      await page.goto(ROUTES.LOGIN);
      await page.evaluate(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
      await page.reload();
      const textZoomPercent = 'textZoomPercent' in viewport ? viewport.textZoomPercent : 100;
      if (textZoomPercent !== 100) await page.addStyleTag({ content: `html { font-size: ${textZoomPercent}% !important; }` });

      await expect(page).toHaveURL(ROUTES.LOGIN);
      const routeOwner = page.locator('[data-ui-owner="uio-l"][data-ui-floorplan="uif-l"][data-ui-region="uir-l"]');
      await expect(routeOwner).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'IPC Management System' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const metrics = await page.evaluate(() => {
        const visibleControls = [...document.querySelectorAll<HTMLElement>('input,button,a[href]')].filter((element) => {
          const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0;
        });
        const owner = document.querySelector<HTMLElement>('[data-ui-owner="uio-l"]')!;
        const ownerRect = owner.getBoundingClientRect();
        return {
          h1Count: document.querySelectorAll('h1').length,
          mainCount: document.querySelectorAll('main').length,
          blankControlNames: visibleControls.filter((element) => !(element.getAttribute('aria-label') || element.textContent?.trim() || (element instanceof HTMLInputElement && document.querySelector(`label[for="${element.id}"]`)))).length,
          primaryActionCount: [...document.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].filter((element) => element.getBoundingClientRect().height > 0).length,
          documentOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          ownerWithinViewport: ownerRect.left >= -1 && ownerRect.right <= window.innerWidth + 1,
          visibleControlCount: visibleControls.length,
        };
      });
      const seriousViolations = axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
      const identity = identityKey({ route: '/login', regionId: 'login-form', state: 'populated', actor: 'anonymous', viewport: viewport.id, lowestOwner: 'login-form' });
      const finding = (ruleId: string, passed: boolean, measured: Record<string, unknown>, expected: string) => routeMeasuredFinding({
        ruleId, identity, productionRouteMeasured: true, passed,
        measured: { ...measured, captureMode: 'production-route', route: new URL(page.url()).pathname },
        expected, actual: JSON.stringify(measured), lowestOwner: 'LoginPage',
      });
      const findings = [
        finding('HIER-01', metrics.h1Count === 1 && metrics.mainCount === 1, { h1Count: metrics.h1Count, mainCount: metrics.mainCount }, 'exactly one h1 inside one main landmark'),
        finding('HIER-02', metrics.blankControlNames === 0 && metrics.primaryActionCount === 1, { blankControlNames: metrics.blankControlNames, primaryActionCount: metrics.primaryActionCount }, 'named controls and exactly one primary action'),
        finding('A11Y-01', seriousViolations.length === 0 && metrics.blankControlNames === 0, { seriousCount: seriousViolations.length, violationIds: seriousViolations.map(({ id }) => id), blankControlNames: metrics.blankControlNames }, 'zero serious/critical axe violations and zero unnamed controls'),
        finding('RESP-01', metrics.documentOverflowPx <= 2 && metrics.ownerWithinViewport, { maximumDocumentOverflowPx: metrics.documentOverflowPx, ownerWithinViewport: metrics.ownerWithinViewport }, 'at most 2px document overflow and route owner within viewport'),
        finding('RESP-02', metrics.documentOverflowPx <= 2 && metrics.visibleControlCount === 3, { textZoomPercent, clippedDocumentPx: metrics.documentOverflowPx, visibleControlCount: metrics.visibleControlCount }, 'all three controls remain available without document clipping'),
      ];
      const record: UiAuditRecord = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings, network: observed.slice(ledgerStart) };
      validateUiAuditRecord(record);
      records.push(record);
    }

    expect(records).toHaveLength(7);
    expect(new Set(records.map(({ identity }) => identity)).size).toBe(7);
    expect(records.flatMap(({ network }) => network).filter(({ method }) => !['GET', 'HEAD'].includes(method))).toEqual([]);
    const reportPath = resolve(process.cwd(), 'test-results', 'ui-audit-phase28-login-production-route.json');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, scope: '/login|login-form|populated|anonymous', recordCount: records.length, records }, null, 2)}\n`);
  });
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

test.describe('Phase 28 protected production-route ready cohort', () => {
  const actor = (name:string, permissions:string[], admin=false):AuditUser => ({ userId:`phase28-${name}`, username:`phase28-${name}`, fullName:`${name} Phase 28`, role:name, roleCode:name.toUpperCase(), roleName:name, isAdminFullAccess:admin, permissions });
  const actors:Record<string,AuditUser> = {
    authenticated:actor('authenticated',[]), coordinator:actor('coordinator',['coordination.read']), reporter:actor('reporter',['report.read']), chef:actor('chef',['production.read']),
    approver:actor('approver',['purchase.request.approve']), purchaser:actor('purchaser',['purchase.read']), keeper:warehouseKeeperActor, administrator:actor('administrator',['*'],true),
    'authenticated-but-forbidden':actor('authenticated-but-forbidden',[]),
  };
  const cases = [
    [ROUTES.DASHBOARD,'dashboard-shift-status','ready','authenticated','DashboardPage','uio-g'],
    [ROUTES.WEEKLY_MENU,'weekly-schedule','plan-ready','coordinator','WeeklyMenuPage','uio-16'],
    [ROUTES.REPORTS,'report-demand','ready','reporter','ReportsPage','uio-s'],
    [ROUTES.MEAL_ORDERS,'coordination-orders','ready','coordinator','CoordinationPage','uio-j'],
    [ROUTES.CHEF_DASHBOARD,'chef-production','production-ready','chef','ChefDashboardPage','uio-d'],
    [ROUTES.APPROVALS,'approval-queue','queue-ready','approver','ApprovalPage','uio-a'],
    [ROUTES.PURCHASING,'purchase-workflow','workflow-ready','purchaser','PurchasingPage','uio-k'],
    [ROUTES.WAREHOUSE,'warehouse-current-stock','ready','keeper','WarehousePage','uio-12'],
    [ROUTES.ADMIN_DATA,'admin-entities','ready','administrator','AdminDataPage','uio-0'],
    [ROUTES.APPROVAL_RULES,'approval-rules','ready','administrator','ApprovalRulesPage','uio-9'],
    [ROUTES.ADVANCED_SETTINGS,'advanced-settings-form','ready','administrator','AdvancedDisplaySettingsPage','uio-8'],
    [ROUTES.FORBIDDEN,'forbidden-panel','ready','authenticated-but-forbidden','ForbiddenPage','uio-h'],
  ] as const;

  test('records route and region identity only from matching production URLs', async ({ page }) => {
    test.setTimeout(180_000);
    const records: UiAuditRecord[] = [];
    const observed:UiAuditRecord['network']=[];
    page.on('request',request=>{if(isLedgerRequest(request.url(),request.method(),request.resourceType(),'http://127.0.0.1:5173')) observed.push({method:request.method(),url:request.url(),resourceType:request.resourceType(),classification:request.url().includes('/api/')?'api':'non-static'});});
    await page.route('**/*', async (route) => { if (!['GET','HEAD'].includes(route.request().method())) await route.abort(); else await route.continue(); });
    for (const viewport of UI_AUDIT_VIEWPORTS) for (const [path,regionId,state,actorName,owner,ownerId] of cases) {
      const ledgerStart=observed.length;
      await page.setViewportSize({ width:viewport.width, height:viewport.height });
      await page.unroute('**/api/**');
      const profile=actors[actorName];
      await stubAuditApi(page, { profile, ...(path===ROUTES.WAREHOUSE?{warehouseScenario:'ready' as const}:{}) });
      await login(page,profile);
      await navigateInApp(page,path);
      await expect(page).toHaveURL(url=>url.pathname===path);
      const routeOwner=page.locator(`main[data-ui-owner="${ownerId}"]`); await expect(routeOwner).toBeVisible();
      const zoom='textZoomPercent' in viewport?viewport.textZoomPercent:100;
      const style=zoom===100?undefined:await page.addStyleTag({content:`html{font-size:${zoom}%!important}`});
      await expect(page.locator('h1:visible')).toHaveCount(1);
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
      const metrics=await page.evaluate(() => {
        const visible=(e:HTMLElement)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
        const controls=[...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]')].filter(visible);
        const main=document.querySelector<HTMLElement>('main[data-ui-owner]')!; const rect=main.getBoundingClientRect();
        return { route:location.pathname, h1Count:[...document.querySelectorAll<HTMLElement>('h1')].filter(visible).length, mainCount:[...document.querySelectorAll<HTMLElement>('main')].filter(visible).length,
          blankControlNames:controls.filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.textContent?.trim()||(e instanceof HTMLInputElement&&(e.labels?.length??0)>0)||e.getAttribute('title'))).length,
          overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth), ownerWithinViewport:rect.left>=-1&&rect.right<=innerWidth+1 };
      });
      const serious=axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical');
      const identity=identityKey({route:path,regionId,state,actor:actorName,viewport:viewport.id,lowestOwner:owner});
      const measured=(ruleId:string,pass:boolean,value:Record<string,unknown>,expected:string)=>routeMeasuredFinding({ruleId,identity,productionRouteMeasured:true,passed:pass,measured:{...value,captureMode:'production-route',route:metrics.route},expected,actual:JSON.stringify(value),lowestOwner:owner});
      const findings=[
        measured('HIER-01',metrics.h1Count===1&&metrics.mainCount===1,{h1Count:metrics.h1Count,mainCount:metrics.mainCount},'one h1 and one main'),
        measured('HIER-02',metrics.blankControlNames===0,{blankControlNames:metrics.blankControlNames},'zero unnamed visible controls'),
        measured('A11Y-01',serious.length===0&&metrics.blankControlNames===0,{seriousCount:serious.length,violationIds:serious.map(v=>v.id),blankControlNames:metrics.blankControlNames},'zero serious/critical axe violations and unnamed controls'),
        measured('RESP-01',metrics.overflowPx<=2&&metrics.ownerWithinViewport,{maximumDocumentOverflowPx:metrics.overflowPx,ownerWithinViewport:metrics.ownerWithinViewport},'at most 2px overflow and owner within viewport'),
        measured('RESP-02',metrics.overflowPx<=2,{textZoomPercent:zoom,clippedDocumentPx:metrics.overflowPx},'no document clipping'),
      ];
      const ids=new Set(findings.map(f=>f.ruleId));
      findings.push(...UI_AUDIT_RULE_IDS.filter(id=>!ids.has(id)).map(ruleId=>({ruleId,identity,verdict:'NEEDS_EVIDENCE' as const,measured:{productionRouteMeasured:false,reason:'not safely measurable in ready-state DOM cohort'}})));
      expect(metrics.route).toBe(path);
      const record:UiAuditRecord={schemaVersion:UI_AUDIT_SCHEMA_VERSION,fixtureVersion:UI_AUDIT_FIXTURE_VERSION,identity,fixtureKey:identity,findings,network:observed.slice(ledgerStart)}; validateUiAuditRecord(record); records.push(record);
      if(style) await style.evaluate(node=>node.remove());
    }
    expect(records).toHaveLength(84); expect(new Set(records.map(r=>r.identity)).size).toBe(84); expect(records.every(r=>r.identity.split('|').length===6)).toBe(true);
    expect(records.flatMap(r=>r.network).filter(request=>!['GET','HEAD'].includes(request.method))).toEqual([]);
    const all=records.flatMap(r=>r.findings); const verdictTotals=all.reduce<Record<string,number>>((a,f)=>({...a,[f.verdict]:(a[f.verdict]??0)+1}),{});
    const reportPath=resolve(process.cwd(),'test-results','ui-audit-phase28-protected-production-routes.json'); mkdirSync(dirname(reportPath),{recursive:true});
    writeFileSync(reportPath,`${JSON.stringify({schemaVersion:UI_AUDIT_SCHEMA_VERSION,routeCount:12,viewportCount:7,recordCount:records.length,measuredFindingCount:records.length*5,remainingNeedsEvidenceCount:records.length*(UI_AUDIT_RULE_IDS.length-5),verdictTotals,records},null,2)}\n`);
  });
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
