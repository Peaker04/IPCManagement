import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Page, Response } from '@playwright/test';
import { test, expect } from '../fixtures/mrxTest';
import { respectApiBudget, trackApiBudget } from '../fixtures/authHelpers';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';
import { materialTotals, writeMenuCoverage, type MenuCoverageManifest } from '../fixtures/menuCoverage';
import { summarizeSamples, installInteractionProbe, collectInteractionSamples } from '../core/qualificationMetrics';

test('@G7-Data-Path bounded production route and equivalent fresh-scope observations', async ({ browser, adminPage, dieuphoiPage, dbVerifier }) => {
  test.setTimeout(1_790_000);
  const directory = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  const terminal = JSON.parse(fs.readFileSync(path.join(directory, 'menu-coverage-terminal.json'), 'utf8')) as { batchId: string; week: string; manifestPath: string };
  const manifest = JSON.parse(fs.readFileSync(terminal.manifestPath, 'utf8')) as MenuCoverageManifest;
  const samples: object[] = [];
  const mutations: object[] = [];
  const save = () => fs.writeFileSync(path.join(directory, 'menu-data-path-performance.json'), JSON.stringify({
    timingOrigin: 'Node monotonic clock immediately before navigation/action; server response timing from browser resource entries. Setup/authentication excluded.',
    firstCorrectFrameMs: null,
    firstFrameVerdict: 'NEEDS_EVIDENCE: no product-owned route-correct paint marker; FCP is not substituted.',
    screenDataReadyMs: null,
    screenReadyVerdict: 'NEEDS_EVIDENCE: response + visible scope + network idle is recorded as settled observation, not an authoritative first-ready marker.',
    caveats: ['Single local workstation/clone; no production capacity claim.', 'Fresh-context cold means empty browser HTTP cache with authenticated storage, not a cold backend/database.', 'State timings are fresh-scope complete imports/approvals/transfers; setup is outside recorded request windows.'],
    samples, mutations,
  }, null, 2));
  const state = await adminPage.context().storageState();
  const routes = [
    { name: 'source', url: `/weekly-menu?view=mrx-batch&weekStartDate=${terminal.week}`, endpoint: '/weekly-menu/edit-scope', selector: 'Tuần MRX bắt đầu', value: terminal.week.split('-').reverse().join('/') },
    { name: 'warehouse', url: `/warehouse?view=mrx-daily&batchId=${terminal.batchId}&date=${terminal.week}`, endpoint: `/batches/${terminal.batchId}/warehouse-daily`, selector: 'Chọn lô đối soát xuất kho', value: terminal.batchId },
    { name: 'chef', url: `/chef?view=mrx-cooking&batchId=${terminal.batchId}`, endpoint: `/batches/${terminal.batchId}/kitchen-cooking`, selector: 'Chọn lô đối soát nấu', value: terminal.batchId },
    { name: 'reconciliation', url: `/reconciliation?batchId=${terminal.batchId}`, endpoint: `/batches/${terminal.batchId}`, selector: 'Chọn lô đối soát', value: terminal.batchId },
  ];
  try {
    for (const route of routes) for (const condition of ['warm', 'fresh-context'] as const) {
      const count = condition === 'warm' ? 20 : 5;
      const values: number[] = [];
      const apiValues: number[] = [];
      const warm = condition === 'warm' ? await browser.newContext({ storageState: state, baseURL: process.env.MRX_E2E_BASE_URL }) : null;
      try {
        const warmPage = warm ? await warm.newPage() : null;
        if (warmPage) { trackApiBudget(warmPage, 'admin'); await respectApiBudget(warmPage); await installInteractionProbe(warmPage); await warmPage.goto(route.url); await warmPage.waitForLoadState('networkidle'); }
        for (let index = 0; index < count; index++) {
          const context = warm ?? await browser.newContext({ storageState: state, baseURL: process.env.MRX_E2E_BASE_URL });
          try {
            const page = warmPage ?? await context.newPage();
            trackApiBudget(page, 'admin');
            await respectApiBudget(page);
            if (!warmPage) await installInteractionProbe(page);
            const response = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith(route.endpoint));
            const started = performance.now();
            await page.goto(route.url);
            const authoritativeResponse = await response;
            expect(authoritativeResponse.status()).toBe(200);
            await expect(page.getByLabel(route.selector, { exact: true })).toHaveValue(route.value);
            await page.waitForLoadState('networkidle');
            const settledMs = performance.now() - started;
            const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => {
              const r = e as PerformanceResourceTiming;
              return { url: new URL(r.name).pathname, durationMs: r.duration, transferBytes: r.transferSize, encodedBytes: r.encodedBodySize };
            }));
            const api = resources.filter((r) => r.url.startsWith('/api/'));
            apiValues.push(...api.map((r) => r.durationMs));
            values.push(settledMs);
            samples.push({ route: route.name, condition, index, settledMs, api, apiLatency: summarizeSamples(api.map((r) => r.durationMs)), requestCount: api.length,
              observers: await collectInteractionSamples(page) });
            save();
          } finally { if (!warm) await context.close(); }
        }
        expect(values).toHaveLength(count);
        const apiLatency = summarizeSamples(apiValues);
        samples.push({ route: route.name, condition, settled: summarizeSamples(values), apiLatency, apiBudgetMs: 300,
          apiVerdict: apiLatency.p75 === null ? 'NEEDS_EVIDENCE' : apiLatency.p75 <= 300 ? 'PASS' : 'FAIL' });
      } finally { await warm?.close(); }
    }
    // Each mutation series starts with a different absent customer/week source; no replay or warmed revision is timed as a fresh import.
    for (let index = 0; index < 5; index++) {
      const scope = scenarioScope(dbVerifier, 20 + index);
      const authored = writeMenuCoverage(scope, manifest.dishes);
      scope.workbook = authored.workbook;
      const pending = new Map<string, number>();
      const events: { endpoint: string; durationMs: number; status: number }[] = [];
      const request = (r: import('@playwright/test').Request) => {
        if (r.method() === 'POST' && /\/weekly-menu\/import\/(preview|commit)$|\/mrx-apply$/.test(new URL(r.url()).pathname)) pending.set(r.url(), performance.now());
      };
      const response = (r: Response) => {
        const start = pending.get(r.url());
        if (start !== undefined) { events.push({ endpoint: new URL(r.url()).pathname, durationMs: performance.now() - start, status: r.status() }); pending.delete(r.url()); }
      };
      dieuphoiPage.on('request', request); dieuphoiPage.on('response', response);
      let batchId: string;
      try {
        ({ batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, sourceScenario: async (page: Page) => {
          for (const row of authored.servings) for (const [variant, label] of [['savory', 'Mặn'], ['vegetarian', 'Chay']] as const) {
            await page.getByRole('spinbutton', { name: `Số suất ${label} ${row.date.slice(5).split('-').reverse().join('/')} ${row.shift}`, exact: true }).fill(String(row[variant]));
          }
        } }, scope));
      } finally { dieuphoiPage.off('request', request); dieuphoiPage.off('response', response); }
      await respectApiBudget(adminPage, 32);
      await adminPage.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}`);
      const first = authored.servings[0];
      await adminPage.getByRole('spinbutton', { name: `Số suất Mặn ${first.date.slice(5).split('-').reverse().join('/')} ${first.shift}`, exact: true }).fill(String(first.savory + 17));
      await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
      await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} equivalent performance revision`);
      await adminPage.getByRole('button', { name: 'Xem ảnh hưởng', exact: true }).click();
      await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
      const applying = adminPage.waitForResponse((r) => r.url().endsWith('/mrx-apply') && r.request().method() === 'POST');
      const applyStart = performance.now();
      await adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
      const applied = await applying;
      events.push({ endpoint: new URL(applied.url()).pathname, durationMs: performance.now() - applyStart, status: applied.status() });
      expect(applied.status()).toBe(200);
      first.savory += 17;
      const [a, b, c, d, e] = batchId.split('-');
      const reverse = (part: string) => part.match(/../g)!.reverse().join('');
      const hex = `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
      expect(hex).toMatch(/^[A-F0-9]{32}$/);
      const quantities = dbVerifier.query(`SELECT CAST(d.ServiceDate AS CHAR) AS date,i.ingredientCode AS ingredientCode,u.unitCode AS canonicalUnitCode,CAST(d.RequiredQuantity AS CHAR) AS quantity
        FROM reconciliationbatchdailylines d JOIN ingredients i ON i.ingredientId=d.IngredientId JOIN units u ON u.unitId=d.CanonicalUnitId
        WHERE d.BatchId=UNHEX('${hex}') AND d.RequiredQuantity>0 ORDER BY d.ServiceDate,i.ingredientCode,u.unitCode;`);
      expect(quantities).toEqual(materialTotals(authored.source, authored.dishes, authored.servings));
      expect(events.some((e) => e.endpoint.endsWith('/preview'))).toBe(true);
      expect(events.some((e) => e.endpoint.endsWith('/commit'))).toBe(true);
      expect(events.every((e) => e.status >= 200 && e.status < 300)).toBe(true);
      mutations.push({ index, batchId, workbookSha256: authored.workbookSha256, events, exactProjection: true }); save();
    }
    expect(mutations).toHaveLength(5);
  } finally { save(); }
});
