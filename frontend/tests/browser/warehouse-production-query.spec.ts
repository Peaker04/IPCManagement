/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seriousViolationsWithBrowserPlaceholderEvidence } from '../uiAuditAxe';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from '../uiAuditContract';
import { UI_AUDIT_RULE_IDS } from '../uiAuditOracleRegistry';
import { identityKey, REGION_INVENTORY, UI_AUDIT_VIEWPORTS } from '../uiAuditInventory';
import { expandProductionQueryIdentities, registerWarehouseQueryIdentity, WAREHOUSE_QUERY_DISPOSITION_REASONS } from '../uiAuditProductionQueryAdapter';
import { isLedgerRequest } from '../uiAuditEvidence';
import { profile, owners, pageData, stock, movement, receipt, candidate, json, dataFor, apiPatterns, installApi, login, seam, dispositionFindings, type CreatedState, type Region } from '../support/warehouse-production-queryFixture';

(process.env.PHASE31_HELPER_ONLY ? test.describe.skip : test.describe)('Phase 28 Warehouse production-route query-state adapters', () => {
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
      const metrics = await page.evaluate(() => { const visible = [...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && element.getAttribute('aria-hidden') !== 'true' && element.tabIndex !== -1; }); const tables = [...document.querySelectorAll<HTMLTableElement>('table')].filter((element) => element.offsetParent !== null); return { h1Count: [...document.querySelectorAll('h1')].filter((element) => (element as HTMLElement).offsetParent !== null).length, mainCount: [...document.querySelectorAll('main')].filter((element) => (element as HTMLElement).offsetParent !== null).length, unnamed: visible.filter((element) => !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim() || element.getAttribute('title') || [...(element.labels ?? [])].some((label) => label.textContent?.trim()))).length, overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth), tableCount: tables.length, theadCount: tables.reduce((count, table) => count + table.querySelectorAll('thead').length, 0) }; });
      const serious = await seriousViolationsWithBrowserPlaceholderEvidence(page, axe.violations);
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
    const output = resolve(process.env.UI_AUDIT_OUTPUT_ROOT ?? resolve(process.cwd(), 'test-results'), 'ui-audit-phase28-warehouse-query-states.json'); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, identityCount: 196, measuredIdentityCount: 112, notApplicableIdentityCount: 28, needsEvidenceIdentityCount: 56, reasons: WAREHOUSE_QUERY_DISPOSITION_REASONS, verdictTotals, perRule, records }, null, 2)}\n`);
  });
});
