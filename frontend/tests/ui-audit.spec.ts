import { expect, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROUTES } from '../src/lib/routeConfig';
import { PHASE09_DATE, PHASE09_STAGE_LABELS, PHASE09_WEEK, phase09Workbench, stubPhase09Api } from './phase9-test-fixture';

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
        const style = window.getComputedStyle(element);
        const clippedHorizontally = element.scrollWidth > element.clientWidth + 2;
        const clippedVertically = element.scrollHeight > element.clientHeight + 2;
        const isTableAction = Boolean(element.closest('td'));

        if (style.overflowWrap === 'anywhere' || style.wordBreak === 'break-all') {
          addIssue(element, 'control uses unsafe arbitrary word breaking');
        } else if (isTableAction && (verticalLetters || clippedHorizontally || clippedVertically || rect.width < 64)) {
          addIssue(element, 'table action control wraps or is too narrow');
        } else if (clippedHorizontally || clippedVertically) {
          addIssue(element, 'control label is clipped');
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
      const bomTabs = page.getByRole('tablist', { name: 'Chọn dữ liệu BOM hiển thị' });
      await expect(bomTabs).toBeVisible();
      const bomMetrics = await bomTabs.evaluate((list) => {
        const listRect = list.getBoundingClientRect();
        const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
        return {
          overflow: list.scrollWidth - list.clientWidth,
          listLeft: listRect.left,
          listRight: listRect.right,
          tabs: tabs.map((tab) => {
            const rect = tab.getBoundingClientRect();
            return { text: tab.textContent?.trim(), left: rect.left, right: rect.right, width: rect.width };
          }),
        };
      });
      expect(bomMetrics.overflow).toBeLessThanOrEqual(1);
      expect(bomMetrics.tabs).toHaveLength(2);
      expect(bomMetrics.tabs[0].text).toBe('BOM hiện tại');
      expect(bomMetrics.tabs[1].text).toBe('Bản xem trước');
      expect(bomMetrics.tabs[0].left).toBeGreaterThanOrEqual(bomMetrics.listLeft);
      expect(bomMetrics.tabs[1].right).toBeLessThanOrEqual(bomMetrics.listRight);
      expect(Math.abs(bomMetrics.tabs[0].right - bomMetrics.tabs[1].left)).toBeLessThanOrEqual(1);
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
