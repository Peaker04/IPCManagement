import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from './uiAuditContract';
import { isLedgerRequest } from './uiAuditEvidence';
import { identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { UI_AUDIT_RULE_IDS } from './uiAuditOracleRegistry';
import { APPROVAL_RULES_QUERY_DISPOSITION_REASONS, expandProductionQueryIdentities, registerApprovalRulesQueryIdentity } from './uiAuditProductionQueryAdapter';

type MeasuredState = 'initial-loading' | 'populated' | 'truly-empty' | 'error-no-data';
const endpoint = '/api/approval-rules';
const profile = { userId: 'admin-phase28-rules', username: 'admin-phase28-rules', fullName: 'Quản trị Phase 28', role: 'admin', roleCode: 'ADMIN', roleName: 'Quản trị viên', isAdminFullAccess: true, permissions: ['*'] };
const rule = { ruleId: 'rule-phase28', ruleName: 'Quy tắc Phase 28', documentType: 'purchase-request', minAmount: 10000000, maxAmount: null, slaHours: 24, isActive: true, approvalassignments: [{ assignmentId: 'assignment-phase28', sequence: 1, approverRole: 'quanly', approverUserId: null, approverUser: null, isRequired: true }] };
const identities = expandProductionQueryIdentities().filter(({ route }) => route === '/admin/rules').map(registerApprovalRulesQueryIdentity);

async function json(route: Route, data: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) });
}
async function installApi(page: Page, state: MeasuredState) {
  let release!: () => void;
  const deferred = new Promise<void>((resolveRelease) => { release = resolveRelease; });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/auth/profile') return json(route, profile);
    if (path === '/api/purchase-orders/page') return json(route, { page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, orderCountByRequest: {} });
    if (path !== endpoint) throw new Error(`unstubbed Approval Rules production GET dependency: ${path}`);
    if (state === 'initial-loading') await deferred;
    if (state === 'error-no-data') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Approval Rules Phase 28 failure' }) });
    return json(route, state === 'populated' ? [rule] : []);
  });
  return release;
}
async function login(page: Page) {
  await page.addInitScript((user) => {
    localStorage.clear(); sessionStorage.clear();
    sessionStorage.setItem('token', 'dev-login-fallback-token-phase28-approval-rules');
    localStorage.setItem('user', JSON.stringify({ ...user, id: user.userId }));
  }, profile);
  await page.goto('/admin/rules', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/admin\/rules/);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
  await page.addStyleTag({ content: 'nav[aria-label="Điều hướng chính"]{pointer-events:none!important}' });
}
function seam(page: Page, state: MeasuredState): Locator {
  if (state === 'initial-loading') return page.getByText('Đang tải cấu hình...');
  if (state === 'populated') return page.getByRole('heading', { name: 'Quy tắc Phase 28' });
  if (state === 'truly-empty') return page.getByText('Chưa có quy tắc phê duyệt nào được thiết lập.');
  return page.getByRole('heading', { name: 'Không tải được quy tắc phê duyệt' });
}
function dispositionFindings(row: ReturnType<typeof registerApprovalRulesQueryIdentity>): UiAuditFinding[] {
  if (row.disposition.kind === 'measure') throw new Error(`measured identity passed to disposition writer: ${identityKey(row)}`);
  const identity = identityKey(row);
  return UI_AUDIT_RULE_IDS.map((ruleId) => ({ ruleId, identity, verdict: row.disposition.kind === 'not-applicable' ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE', measured: { productionRouteMeasured: false, reason: row.disposition.reason } }));
}

test.describe('Phase 28 Approval Rules production-route query-state adapter', () => {
  test('records all 49 identities from the actual ApprovalRulesPage with a GET/HEAD-only ledger', async ({ browser }) => {
    test.setTimeout(600_000);
    const records: UiAuditRecord[] = [];
    for (const viewport of UI_AUDIT_VIEWPORTS) for (const state of ['initial-loading', 'populated', 'truly-empty', 'error-no-data'] as const) {
      const observed: UiAuditRecord['network'] = [];
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: 'http://127.0.0.1:5173' });
      const page = await context.newPage();
      page.on('request', (request) => {
        if (isLedgerRequest(request.url(), request.method(), request.resourceType(), 'http://127.0.0.1:5173')) observed.push({ method: request.method(), url: request.url(), resourceType: request.resourceType(), classification: request.url().includes('/api/') ? 'api' : 'non-static' });
      });
      await page.route('**/*', (route) => !['GET', 'HEAD'].includes(route.request().method()) ? route.abort() : route.continue());
      const release = await installApi(page, state);
      await login(page);
      const zoom = 'textZoomPercent' in viewport ? viewport.textZoomPercent : 100;
      const style = zoom === 100 ? undefined : await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      const target = seam(page, state);
      await expect(target).toBeVisible({ timeout: 8_000 });
      const row = identities.find((item) => item.viewport === viewport.id && item.state === state)!;
      const identity = identityKey(row);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const metrics = await page.evaluate(() => {
        const visible = [...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; });
        const tables = [...document.querySelectorAll<HTMLTableElement>('table')].filter((element) => element.offsetParent !== null);
        return { h1Count: [...document.querySelectorAll('h1')].filter((element) => (element as HTMLElement).offsetParent !== null).length, mainCount: [...document.querySelectorAll('main')].filter((element) => (element as HTMLElement).offsetParent !== null).length, unnamed: visible.filter((element) => !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim() || element.getAttribute('title'))).length, overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth), tableCount: tables.length, theadCount: tables.reduce((count, table) => count + table.querySelectorAll('thead').length, 0) };
      });
      const serious = axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
      const finding = (ruleId: string, passed: boolean, value: Record<string, unknown>, expected: string) => routeMeasuredFinding({ ruleId, identity, productionRouteMeasured: true, passed, measured: { ...value, state, endpoint, endpointInterception: true }, expected, actual: JSON.stringify(value), lowestOwner: 'ApprovalRulesPage' });
      const findings: UiAuditFinding[] = [
        finding('HIER-01', metrics.h1Count === 1 && metrics.mainCount >= 1, { h1Count: metrics.h1Count, mainCount: metrics.mainCount }, 'one visible h1 and production main'),
        finding('HIER-02', metrics.unnamed === 0, { unnamed: metrics.unnamed }, 'zero unnamed controls'),
        finding('A11Y-01', serious.length === 0 && metrics.unnamed === 0, { seriousCount: serious.length, ids: serious.map(({ id }) => id), unnamed: metrics.unnamed }, 'zero serious/critical violations and unnamed controls'),
        finding('RESP-01', metrics.overflowPx <= 2, { overflowPx: metrics.overflowPx }, 'at most 2px document overflow'),
        finding('RESP-02', metrics.overflowPx <= 2, { overflowPx: metrics.overflowPx, textZoomPercent: zoom }, 'no audited-zoom clipping'),
        finding('QUERY-01', await target.count() === 1, { state, seamCount: await target.count(), endpoint }, 'owned endpoint renders one state-specific production DOM seam'),
        finding('TABLE-01', metrics.tableCount === 0 && metrics.theadCount === 0, { tableCount: metrics.tableCount, theadCount: metrics.theadCount }, 'ApprovalRulesPage card region owns no production table'),
      ];
      const used = new Set(findings.map(({ ruleId }) => ruleId));
      findings.push(...UI_AUDIT_RULE_IDS.filter((ruleId) => !used.has(ruleId)).map((ruleId) => ({ ruleId, identity, verdict: 'NEEDS_EVIDENCE' as const, measured: { productionRouteMeasured: false, reason: 'rule is outside Approval Rules query-state adapter scope' } })));
      const record = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings, network: observed };
      validateUiAuditRecord(record); records.push(record);
      if (style) await style.evaluate((node) => node.remove());
      release(); await context.close();
    }
    for (const row of identities.filter(({ disposition }) => disposition.kind !== 'measure')) {
      const identity = identityKey(row); const record = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings: dispositionFindings(row), network: [] }; validateUiAuditRecord(record); records.push(record);
    }
    expect(records).toHaveLength(49);
    expect(new Set(records.map(({ identity }) => identity)).size).toBe(49);
    expect(records.map(({ identity }) => identity).sort()).toEqual(identities.map(identityKey).sort());
    expect(records.flatMap(({ network }) => network).filter(({ method }) => !['GET', 'HEAD'].includes(method))).toEqual([]);
    expect(records.filter(({ findings }) => findings[0].verdict === 'NOT_APPLICABLE')).toHaveLength(7);
    expect(records.filter(({ findings }) => findings[0].verdict === 'NEEDS_EVIDENCE')).toHaveLength(14);
    const verdictTotals = records.flatMap(({ findings }) => findings).reduce<Record<string, number>>((totals, finding) => ((totals[finding.verdict] = (totals[finding.verdict] ?? 0) + 1), totals), {});
    const perRule = UI_AUDIT_RULE_IDS.reduce<Record<string, Record<string, number>>>((totals, ruleId) => ((totals[ruleId] = records.flatMap(({ findings }) => findings).filter((finding) => finding.ruleId === ruleId).reduce<Record<string, number>>((counts, finding) => ((counts[finding.verdict] = (counts[finding.verdict] ?? 0) + 1), counts), {})), totals), {});
    expect(Object.values(perRule).every((counts) => Object.values(counts).reduce((sum, count) => sum + count, 0) === 49)).toBe(true);
    const output = resolve(process.cwd(), 'test-results', 'ui-audit-phase28-approval-rules-query-states.json');
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, identityCount: 49, measuredIdentityCount: 28, notApplicableIdentityCount: 7, needsEvidenceIdentityCount: 14, reasons: APPROVAL_RULES_QUERY_DISPOSITION_REASONS, verdictTotals, perRule, records }, null, 2)}\n`);
  });
});
