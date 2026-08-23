import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from './uiAuditContract';
import { isLedgerRequest } from './uiAuditEvidence';
import { identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { UI_AUDIT_RULE_IDS, type UiAuditRuleId } from './uiAuditOracleRegistry';
import { expandProductionStaticFormIdentities, PRODUCTION_STATIC_FORM_REASONS, type ProductionStaticFormIdentity } from './uiAuditProductionStaticFormAdapter';

const admin = { userId: 'phase28-static-form-admin', username: 'phase28-static-form-admin', fullName: 'Quản trị Phase 28', role: 'admin', roleCode: 'ADMIN', roleName: 'Quản trị viên', isAdminFullAccess: true, permissions: ['*'] };
const forbiddenActor = { userId: 'phase28-forbidden', username: 'phase28-forbidden', fullName: 'Người dùng Phase 28', role: 'authenticated', roleCode: 'AUTHENTICATED', roleName: 'Người dùng', isAdminFullAccess: false, permissions: [] };
const identities = expandProductionStaticFormIdentities();
const preferenceKeys = ['ipc.navigation-preferences.v1', 'ipc.page-tab-preferences.v1'] as const;

async function json(route: Route, data: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) });
}

async function installGetStubs(page: Page, routePath: ProductionStaticFormIdentity['route']) {
  const actor = routePath === '/403' ? forbiddenActor : admin;
  await page.route('**/api/**', async (route) => {
    const requestPath = new URL(route.request().url()).pathname;
    if (!requestPath.startsWith('/api/')) return route.continue();
    if (requestPath === '/api/auth/profile') return json(route, actor);
    if (requestPath === '/api/purchase-orders/page') return json(route, { page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, orderCountByRequest: {} });
    throw new Error(`unstubbed static/form production GET dependency: ${requestPath}`);
  });
  await page.addInitScript(({ user, token }) => {
    localStorage.clear(); sessionStorage.clear();
    sessionStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ ...user, id: user.userId }));
    localStorage.setItem('ipc.navigation-preferences.v1', JSON.stringify({ dashboard: true, reports: false }));
    localStorage.setItem('ipc.page-tab-preferences.v1', JSON.stringify({ reports: { price: false } }));
  }, { user: actor, token: `dev-login-fallback-token-${routePath === '/403' ? 'forbidden' : 'advanced-settings'}` });
}

function dispositionFindings(row: ProductionStaticFormIdentity): UiAuditFinding[] {
  if (row.disposition.kind === 'measure') throw new Error(`measured identity passed to disposition writer: ${identityKey(row)}`);
  const identity = identityKey(row);
  return UI_AUDIT_RULE_IDS.map((ruleId) => ({
    ruleId,
    identity,
    verdict: row.disposition.kind === 'not-applicable' ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE',
    measured: { productionRouteMeasured: false, reason: row.disposition.reason },
  }));
}

function measuredFindings(row: ProductionStaticFormIdentity, metrics: Record<string, unknown>, seriousIds: string[]): UiAuditFinding[] {
  const identity = identityKey(row);
  const owner = row.lowestOwner;
  const pass = (ruleId: UiAuditRuleId, passed: boolean, measured: Record<string, unknown>, expected: string) => routeMeasuredFinding({ ruleId, identity, productionRouteMeasured: true, passed, measured, expected, actual: JSON.stringify(measured), lowestOwner: owner });
  const findings: UiAuditFinding[] = [
    pass('HIER-01', metrics.h1Count === 1 && Number(metrics.mainCount) >= 1, { h1Count: metrics.h1Count, mainCount: metrics.mainCount }, 'one visible h1 and production main'),
    pass('HIER-02', metrics.unnamed === 0, { unnamed: metrics.unnamed }, 'zero unnamed interactive controls'),
    pass('A11Y-01', seriousIds.length === 0 && metrics.unnamed === 0, { seriousCount: seriousIds.length, ids: seriousIds, unnamed: metrics.unnamed }, 'zero serious/critical axe violations and unnamed controls'),
    pass('RESP-01', Number(metrics.overflowPx) <= 2, { overflowPx: metrics.overflowPx }, 'at most 2px document overflow'),
    pass('RESP-02', Number(metrics.overflowPx) <= 2 && metrics.clippedControls === 0, { overflowPx: metrics.overflowPx, clippedControls: metrics.clippedControls, textZoomPercent: metrics.textZoomPercent }, 'no audited-zoom control clipping'),
  ];
  const used = new Set(findings.map(({ ruleId }) => ruleId));
  for (const ruleId of UI_AUDIT_RULE_IDS.filter((candidate) => !used.has(candidate))) {
    const notApplicable = ['TABLE-01', 'TABLE-02', 'TABLE-03', 'QUERY-01', 'QUERY-02'].includes(ruleId)
      || (row.route === '/403' && ['MUT-01', 'REFRESH-01', 'FILTER-01', 'SORT-01', 'COL-01', 'PAGE-01'].includes(ruleId));
    findings.push({ ruleId, identity, verdict: notApplicable ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE', measured: { productionRouteMeasured: true, reason: notApplicable ? (row.route === '/403' ? 'static denial region owns no query, table, filter, pagination, refresh, or mutation' : 'local settings form owns no collection query or table') : 'rule is outside this focused populated static/form baseline' } });
  }
  return findings;
}

test.describe('Phase 28 production-route static/form baseline', () => {
  test('records all 126 six-part identities across the actual routes with a GET/HEAD-only ledger', async ({ browser }) => {
    test.setTimeout(600_000);
    const records: UiAuditRecord[] = [];
    for (const routePath of ['/admin/advanced-settings', '/403'] as const) for (const viewport of UI_AUDIT_VIEWPORTS) {
      const observed: UiAuditRecord['network'] = [];
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: 'http://127.0.0.1:5173' });
      const page = await context.newPage();
      page.on('request', (request) => {
        if (isLedgerRequest(request.url(), request.method(), request.resourceType(), 'http://127.0.0.1:5173')) observed.push({ method: request.method(), url: request.url(), resourceType: request.resourceType(), classification: request.url().includes('/api/') ? 'api' : 'non-static' });
      });
      await page.route('**/*', (route) => !['GET', 'HEAD'].includes(route.request().method()) ? route.abort() : route.continue());
      await installGetStubs(page, routePath);
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(routePath.replace('/', '\\/')));
      await expect(page.locator('.ipc-app-shell')).toBeVisible();
      const target = routePath === '/403' ? page.getByRole('heading', { name: 'Không đủ quyền truy cập' }) : page.getByRole('heading', { name: 'Menu điều hướng chính (Thanh bên trái)' });
      await expect(target).toBeVisible();
      const preferencesBefore = routePath === '/admin/advanced-settings' ? await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), preferenceKeys) : [];
      const zoom = 'textZoomPercent' in viewport ? viewport.textZoomPercent : 100;
      if (zoom !== 100) await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const metrics = await page.evaluate((textZoomPercent) => {
        const visible = [...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; });
        return {
          h1Count: [...document.querySelectorAll('h1')].filter((element) => (element as HTMLElement).offsetParent !== null).length,
          mainCount: [...document.querySelectorAll('main')].filter((element) => (element as HTMLElement).offsetParent !== null).length,
          unnamed: visible.filter((element) => !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim() || element.getAttribute('title'))).length,
          overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          clippedControls: visible.filter((element) => { const rect = element.getBoundingClientRect(); return rect.right > innerWidth + 2 || rect.left < -2; }).length,
          textZoomPercent,
        };
      }, zoom);
      const preferencesAfter = routePath === '/admin/advanced-settings' ? await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), preferenceKeys) : [];
      expect(preferencesAfter).toEqual(preferencesBefore);
      const row = identities.find(({ route, state, viewport: viewportId }) => route === routePath && state === 'populated' && viewportId === viewport.id)!;
      const identity = identityKey(row);
      const seriousIds = axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical').map(({ id }) => id);
      const record = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings: measuredFindings(row, metrics, seriousIds), network: observed };
      validateUiAuditRecord(record); records.push(record);
      await context.close();
    }
    for (const row of identities.filter(({ disposition }) => disposition.kind !== 'measure')) {
      const identity = identityKey(row);
      const record = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings: dispositionFindings(row), network: [] };
      validateUiAuditRecord(record); records.push(record);
    }
    expect(records).toHaveLength(126);
    expect(new Set(records.map(({ identity }) => identity)).size).toBe(126);
    expect(records.map(({ identity }) => identity).sort()).toEqual(identities.map(identityKey).sort());
    expect(records.flatMap(({ network }) => network).filter(({ method }) => !['GET', 'HEAD'].includes(method))).toEqual([]);
    expect(records.filter(({ findings }) => findings[0].verdict === 'NOT_APPLICABLE')).toHaveLength(98);
    expect(records.filter(({ findings }) => findings[0].verdict === 'NEEDS_EVIDENCE')).toHaveLength(14);
    const verdictTotals = records.flatMap(({ findings }) => findings).reduce<Record<string, number>>((totals, finding) => ((totals[finding.verdict] = (totals[finding.verdict] ?? 0) + 1), totals), {});
    const perRoute = Object.fromEntries((['/admin/advanced-settings', '/403'] as const).map((route) => [route, { identityCount: records.filter(({ identity }) => identity.startsWith(`${route}|`)).length, measuredIdentityCount: records.filter(({ identity, findings }) => identity.startsWith(`${route}|`) && findings[0].verdict !== 'NOT_APPLICABLE' && findings[0].verdict !== 'NEEDS_EVIDENCE').length }]));
    const output = resolve(process.cwd(), 'test-results', 'ui-audit-phase28-static-form-production-routes.json');
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, identityCount: 126, measuredIdentityCount: 14, notApplicableIdentityCount: 98, needsEvidenceIdentityCount: 14, reasons: PRODUCTION_STATIC_FORM_REASONS, verdictTotals, perRoute, records }, null, 2)}\n`);
  });
});
