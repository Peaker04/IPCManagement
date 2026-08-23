import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from './uiAuditContract';
import { UI_AUDIT_RULE_IDS } from './uiAuditOracleRegistry';
import { identityKey, REGION_INVENTORY, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { expandProductionQueryIdentities, registerWarehouseQueryIdentity, WAREHOUSE_QUERY_DISPOSITION_REASONS } from './uiAuditProductionQueryAdapter';
import { isLedgerRequest } from './uiAuditEvidence';

type CreatedState = 'initial-loading' | 'populated' | 'truly-empty' | 'error-no-data';
type Region = (typeof REGION_INVENTORY)['/warehouse'][number];

const profile = { userId: 'phase28-keeper', username: 'phase28-keeper', fullName: 'Thủ kho Phase 28', role: 'thukho', roleCode: 'WAREHOUSE_KEEPER', roleName: 'Thủ kho', isAdminFullAccess: false, permissions: ['warehouse.read'] };
const owners: Record<Region, { endpoint: string; ownership: string }> = {
  'warehouse-current-stock': { endpoint: '/api/workflow-reports/current-stock/page', ownership: 'movement-active-first' },
  'warehouse-purchase-receipts': { endpoint: '/api/inventory-receipts', ownership: 'always-mounted-receipt-lifecycle' },
  'warehouse-issues': { endpoint: '/api/workflow-reports/material-request-candidates/page', ownership: 'movement-active-first-command-query' },
  'warehouse-movements': { endpoint: '/api/workflow-reports/stock-movements/page', ownership: 'movement-active-first' },
};
const pageData = (items: unknown[], pageSize = 8) => ({ items, totalCount: items.length, pageNumber: 1, pageSize, totalPages: items.length ? 1 : 0, hasPrev: false, hasNext: false });
const stock = { warehouseId: 'warehouse-p28', warehouseName: 'Kho Phase 28', ingredientId: 'ingredient-p28', ingredientName: 'Gạo Phase 28', unitId: 'unit-kg', unitName: 'kg', currentQty: 12, lastUpdated: '2026-08-23T01:00:00Z' };
const movement = { movementId: 'movement-phase28', movementType: 'RECEIPT', ingredientId: 'ingredient-p28', ingredientName: 'Gạo Phase 28', unitId: 'unit-kg', unitName: 'kg', warehouseId: 'warehouse-p28', warehouseName: 'Kho Phase 28', quantityIn: 12, quantityOut: 0, beforeQty: 0, afterQty: 12, movementDate: '2026-08-23T01:00:00Z', refTable: 'InventoryReceipt', refId: 'receipt-phase28', reason: 'Nhập kho Phase 28' };
const receipt = { receiptId: 'receipt-phase28', receiptCode: 'REC-P28', purchaseOrderId: 'po-phase28', purchaseOrderCode: 'PO-P28', supplierName: 'Nhà cung cấp Phase 28', warehouseId: 'warehouse-p28', warehouseName: 'Kho Phase 28', receiptDate: '2026-08-23', status: 'DRAFT', qualityStatus: 'PENDING_INSPECTION', version: 0, lines: [] };
const candidate = { materialRequestId: 'request-phase28', materialRequestCode: 'MR-P28', customerId: 'customer-p28', customerName: 'Khách hàng Phase 28', requestDate: '2026-08-23', shiftName: 'MORNING', remainingLineCount: 1 };

async function json(route: Route, data: unknown) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) }); }
function dataFor(path: string, populated: boolean) {
  if (path === '/api/workflow-reports/current-stock/page') return pageData(populated ? [stock] : []);
  if (path === '/api/workflow-reports/stock-movements/page') return { items: populated ? [movement] : [], limit: 8, hasNext: false, nextCursorOffset: 0 };
  if (path === '/api/inventory-receipts') return pageData(populated ? [receipt] : [], 6);
  if (path === '/api/inventory-receipts/receipt-phase28') return receipt;
  if (path === '/api/workflow-reports/material-request-candidates/page') return pageData(populated ? [candidate] : []);
  if (path === '/api/workflow-reports/workflow-documents') return [];
  if (path === '/api/purchase-orders/page') return { page: pageData([]), orderCountByRequest: {} };
  if (path === '/api/warehouses/selector') return [];
  if (path === '/api/workflow-reports/kitchen-issues') return [];
  if (path === '/api/workflow-reports/ingredient-demand/aggregate/page') return { ...pageData([]), shortageCount: 0 };
  throw new Error(`unstubbed Warehouse production GET dependency: ${path}`);
}
const apiPatterns = [
  '**/api/auth/profile', '**/api/workflow-reports/current-stock/page**', '**/api/workflow-reports/stock-movements/page**',
  '**/api/inventory-receipts?**', '**/api/inventory-receipts/receipt-phase28', '**/api/workflow-reports/material-request-candidates/page**', '**/api/workflow-reports/workflow-documents**',
  '**/api/purchase-orders/page**', '**/api/warehouses/selector', '**/api/workflow-reports/kitchen-issues**',
  '**/api/workflow-reports/ingredient-demand/aggregate/page**',
];
async function installApi(page: Page, region: Region, state: CreatedState) {
  let release!: () => void;
  const deferred = new Promise<void>((resolveRelease) => { release = resolveRelease; });
  const owned = owners[region].endpoint;
  const handler = async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/profile') return json(route, profile);
    if (path === owned && state === 'initial-loading') await deferred;
    if (path === owned && state === 'error-no-data') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: `${region} Phase 28 failure` }) });
    return json(route, dataFor(path, path === owned && state === 'populated'));
  };
  for (const pattern of apiPatterns) await page.route(pattern, handler);
  return release;
}
async function login(page: Page) {
  await page.addInitScript((user) => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('token', 'dev-login-fallback-token-phase28-warehouse'); localStorage.setItem('user', JSON.stringify({ ...user, id: user.userId })); }, profile);
  await page.goto('/warehouse', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/warehouse/);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
}
function seam(page: Page, region: Region, state: CreatedState): Locator {
  if (region === 'warehouse-current-stock') {
    if (state === 'error-no-data') return page.getByRole('heading', { name: 'Không tải được tồn kho hiện tại' });
    return state === 'initial-loading' ? page.locator('.ipc-warehouse-table-shell .ipc-table-skeleton-cell').first() : page.getByText(state === 'populated' ? 'Gạo Phase 28' : 'Chưa có dữ liệu tồn kho');
  }
  if (region === 'warehouse-movements') {
    if (state === 'initial-loading') return page.getByRole('status', { name: 'Đang tải sổ luân chuyển kho' });
    if (state === 'error-no-data') return page.getByRole('heading', { name: 'Không tải được sổ luân chuyển kho' });
    return state === 'populated' ? page.getByText('Gạo Phase 28') : page.getByText('Chưa có dữ liệu để hiển thị').first();
  }
  if (region === 'warehouse-purchase-receipts') {
    if (state === 'error-no-data') return page.getByRole('heading', { name: 'Không tải được phiếu nhập cần xử lý' });
    if (state === 'populated') return page.getByRole('cell', { name: 'REC-P28', exact: true });
    return page.getByText(state === 'initial-loading' ? 'Đang tải phiếu nhập…' : 'Chưa có phiếu nhập cần xử lý trong trang này.');
  }
  if (state === 'initial-loading') return page.getByRole('button', { name: 'Đang kiểm tra nhu cầu' });
  if (state === 'error-no-data') return page.getByText(/Không tải được danh sách nhu cầu đủ điều kiện xuất kho/);
  return page.getByRole('button', { name: 'Tạo phiếu xuất kho' });
}
function dispositionFindings(row: ReturnType<typeof registerWarehouseQueryIdentity>): UiAuditFinding[] {
  if (row.disposition.kind === 'measure') throw new Error(`measured identity passed to disposition writer: ${identityKey(row)}`);
  const identity = identityKey(row);
  return UI_AUDIT_RULE_IDS.map((ruleId) => ({ ruleId, identity, verdict: row.disposition.kind === 'not-applicable' ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE', measured: { productionRouteMeasured: false, reason: row.disposition.reason } }));
}

test.describe('Phase 28 Warehouse production-route query-state adapters', () => {
  test('records all 196 identities with active-first ownership and a GET/HEAD-only ledger', async ({ browser }) => {
    test.setTimeout(1_800_000);
    const identities = expandProductionQueryIdentities().filter((row) => row.route === '/warehouse').map(registerWarehouseQueryIdentity);
    const records: UiAuditRecord[] = [];
    for (const viewport of UI_AUDIT_VIEWPORTS) for (const state of ['initial-loading', 'populated', 'truly-empty', 'error-no-data'] as const) for (const region of REGION_INVENTORY['/warehouse']) {
      const observed: UiAuditRecord['network'] = [];
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: 'http://127.0.0.1:5173' });
      const page = await context.newPage();
      page.on('request', (request) => { if (isLedgerRequest(request.url(), request.method(), request.resourceType(), 'http://127.0.0.1:5173')) observed.push({ method: request.method(), url: request.url(), resourceType: request.resourceType(), classification: request.url().includes('/api/') ? 'api' : 'non-static' }); });
      await page.route('**/*', (route) => !['GET', 'HEAD'].includes(route.request().method()) ? route.abort() : route.continue());
      const release = await installApi(page, region, state);
      await login(page);
      const zoom = 'textZoomPercent' in viewport ? viewport.textZoomPercent : 100;
      const style = zoom === 100 ? undefined : await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      const target = seam(page, region, state);
      await expect(target).toBeVisible({ timeout: 8_000 });
      const row = identities.find((item) => item.viewport === viewport.id && item.state === state && item.regionId === region)!;
      const identity = identityKey(row);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const metrics = await page.evaluate(() => { const visible = [...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }); const tables = [...document.querySelectorAll<HTMLTableElement>('table')].filter((element) => element.offsetParent !== null); return { h1Count: [...document.querySelectorAll('h1')].filter((element) => (element as HTMLElement).offsetParent !== null).length, mainCount: [...document.querySelectorAll('main')].filter((element) => (element as HTMLElement).offsetParent !== null).length, unnamed: visible.filter((element) => !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim() || element.getAttribute('title'))).length, overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth), tableCount: tables.length, theadCount: tables.reduce((count, table) => count + table.querySelectorAll('thead').length, 0) }; });
      const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
      const finding = (ruleId: string, passed: boolean, value: Record<string, unknown>, expected: string) => routeMeasuredFinding({ ruleId, identity, productionRouteMeasured: true, passed, measured: { ...value, state, endpoint: owners[region].endpoint, visitOrder: owners[region].ownership }, expected, actual: JSON.stringify(value), lowestOwner: 'WarehousePage' });
      const findings: UiAuditFinding[] = [finding('HIER-01', metrics.h1Count === 1 && metrics.mainCount >= 1, { h1Count: metrics.h1Count, mainCount: metrics.mainCount }, 'one visible h1 and production main'), finding('HIER-02', metrics.unnamed === 0, { unnamed: metrics.unnamed }, 'zero unnamed controls'), finding('A11Y-01', serious.length === 0 && metrics.unnamed === 0, { seriousCount: serious.length, ids: serious.map((violation) => violation.id), unnamed: metrics.unnamed }, 'zero serious/critical violations and unnamed controls'), finding('RESP-01', metrics.overflowPx <= 2, { overflowPx: metrics.overflowPx }, 'at most 2px document overflow'), finding('RESP-02', metrics.overflowPx <= 2, { overflowPx: metrics.overflowPx, textZoomPercent: zoom }, 'no audited-zoom clipping'), finding('QUERY-01', await target.count() >= 1, { state, seamCount: await target.count(), endpoint: owners[region].endpoint }, 'owned endpoint renders a state-specific production DOM seam'), finding('TABLE-01', metrics.theadCount === metrics.tableCount, { tableCount: metrics.tableCount, theadCount: metrics.theadCount }, 'visible production tables have one header each')];
      const used = new Set(findings.map((item) => item.ruleId));
      findings.push(...UI_AUDIT_RULE_IDS.filter((ruleId) => !used.has(ruleId)).map((ruleId) => ({ ruleId, identity, verdict: 'NEEDS_EVIDENCE' as const, measured: { productionRouteMeasured: false, reason: 'rule is outside Warehouse query-state adapter scope' } })));
      const record = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings, network: observed };
      validateUiAuditRecord(record); records.push(record);
      if (style) await style.evaluate((node) => node.remove());
      release(); await context.close();
    }
    for (const row of identities.filter(({ disposition }) => disposition.kind !== 'measure')) { const identity = identityKey(row); const record = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, fixtureVersion: UI_AUDIT_FIXTURE_VERSION, identity, fixtureKey: identity, findings: dispositionFindings(row), network: [] }; validateUiAuditRecord(record); records.push(record); }
    expect(records).toHaveLength(196); expect(new Set(records.map((record) => record.identity)).size).toBe(196); expect(records.flatMap((record) => record.network).filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]); expect(records.filter((record) => record.findings[0].verdict === 'NOT_APPLICABLE')).toHaveLength(28); expect(records.filter((record) => record.findings[0].verdict === 'NEEDS_EVIDENCE')).toHaveLength(56);
    const verdictTotals = records.flatMap((record) => record.findings).reduce<Record<string, number>>((totals, findingItem) => (totals[findingItem.verdict] = (totals[findingItem.verdict] ?? 0) + 1, totals), {});
    const perRule = UI_AUDIT_RULE_IDS.reduce<Record<string, Record<string, number>>>((totals, ruleId) => (totals[ruleId] = records.flatMap((record) => record.findings).filter((findingItem) => findingItem.ruleId === ruleId).reduce<Record<string, number>>((counts, findingItem) => (counts[findingItem.verdict] = (counts[findingItem.verdict] ?? 0) + 1, counts), {}), totals), {});
    const output = resolve(process.cwd(), 'test-results', 'ui-audit-phase28-warehouse-query-states.json'); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, identityCount: 196, measuredIdentityCount: 112, notApplicableIdentityCount: 28, needsEvidenceIdentityCount: 56, reasons: WAREHOUSE_QUERY_DISPOSITION_REASONS, verdictTotals, perRule, records }, null, 2)}\n`);
  });
});
