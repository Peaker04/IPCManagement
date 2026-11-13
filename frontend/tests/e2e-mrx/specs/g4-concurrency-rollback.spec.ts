import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { loginRole, respectApiBudget } from '../fixtures/authHelpers';
import type { Response, Route } from '@playwright/test';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';
import type { MrxWarehouseDaily, CreateMrxIssueRequest } from '../../../src/api/mrxApi';

function binaryId(value: string): string {
  const [a, b, c, d, e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}

 test.describe('@G4-Rollback Real Concurrency & Mathematical Stock Invariants', () => {
  test.use({ actionTimeout: 15_000 });
  for (const kind of ['supplemental', 'initial'] as const) {
  test(`@G4-Race Two valid warehouse browser contexts race ${kind} issues from the same version`, async ({ browser, viewport, baseURL, dieuphoiPage, adminPage, thukhoPage, dbVerifier }) => {
    test.setTimeout(240_000);
    const scope = scenarioScope(dbVerifier, kind === 'supplemental' ? 2 : 3);
    const evidence = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, kind);
    fs.mkdirSync(evidence, { recursive: true });
    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
    const url = `/warehouse?view=mrx-daily&batchId=${batchId}&date=${scope.weekStartDate}`;
    await thukhoPage.goto(url);
    const readDaily = () => thukhoPage.evaluate(async (id) => {
      const token = localStorage.getItem('ipc_v3_token');
      const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Warehouse projection failed.');
      return (await response.json()).data;
    }, batchId) as Promise<MrxWarehouseDaily>;
    const first = await readDaily();
    const source = first.dates.find((day) => day.serviceDate === scope.weekStartDate)!.lines.find((line) => line.requiredQuantity > 3)!;
    expect(source).toBeTruthy();
    expect(dbVerifier.query(`SELECT CAST(RequiredQuantity AS CHAR) AS quantity FROM reconciliationbatchdailylines WHERE DailyLineId=UNHEX('${binaryId(source.dailyLineId)}') AND BatchId=UNHEX('${binaryId(batchId)}');`)).toEqual([{ quantity: source.requiredQuantity.toFixed(6) }]);
    let predecessor: { issueId: string } | undefined;
    if (kind === 'supplemental') {
      await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      await thukhoPage.getByLabel(`Số lượng thực xuất ${source.ingredientName}`, { exact: true }).fill(String(source.requiredQuantity - 3));
      const initialResponse = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST', { timeout: 15_000 });
      await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
      const initial = await initialResponse;
      expect(initial.status()).toBe(201);
      predecessor = (await initial.json()).data;
      await expect(thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
    }
    const beforeDaily = await readDaily();
    const predecessorRows = predecessor ? dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l WHERE l.issueId=UNHEX('${binaryId(predecessor.issueId)}') ORDER BY id;`) : [];
    if (predecessor) expect(predecessorRows.length).toBeGreaterThan(0);
    expect(dbVerifier.query(`SELECT issueId FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`)).toHaveLength(kind === 'initial' ? 0 : 1);
    const before = dbVerifier.captureStockSnapshot(binaryId(source.ingredientId));
    const allStocks = () => dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
    const originalStocks = allStocks();
    expect(dbVerifier.query<{ version: string }>(`SELECT Version AS version FROM reconciliationbatches WHERE BatchId=UNHEX('${binaryId(batchId)}');`)).toEqual([{ version: String(beforeDaily.sourceVersion) }]);

    const secondContext = await browser.newContext({ viewport, baseURL });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const bodies: CreateMrxIssueRequest[] = [];
    const arrivals: number[] = [];
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const pending: Promise<unknown>[] = [];
    let settled: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      const secondPage = await secondContext.newPage();
      await loginRole(secondPage, 'thukho', baseURL);
      await secondPage.goto(url);
      const pages = [thukhoPage, secondPage];
      for (const [index, page] of pages.entries()) {
        await respectApiBudget(page);
        if (kind === 'supplemental') {
          await page.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
          await dialog.getByLabel('Chọn nguyên liệu bổ sung', { exact: true }).selectOption(source.dailyLineId);
          await dialog.getByLabel('Số lượng xuất thêm', { exact: true }).fill(String(index + 1));
          await dialog.getByLabel('Lý do xuất bổ sung', { exact: true }).fill(`${scope.reason} phiên ${index + 1}`);
        } else {
          await page.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
          await page.getByLabel(`Số lượng thực xuất ${source.ingredientName}`, { exact: true }).fill(String(index + 1));
        }
        await page.route('**/api/inventory-issues', async (route) => {
          if (route.request().method() === 'POST') {
            bodies[index] = route.request().postDataJSON();
            arrivals[index] = Date.now();
            deadline ??= setTimeout(() => { timedOut = true; release(); }, 15_000);
            await gate;
            if (timedOut) { await route.abort('timedout'); return; }
          }
          await route.continue();
        });
      }
      const responses = pages.map((page) => page.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST', { timeout: 15_000 }));
      pending.push(...responses);
      const clicks = pages.map((page) => page.getByRole('button', { name: kind === 'supplemental' ? 'Xác nhận xuất bổ sung' : 'Xác nhận xuất kho', exact: true }).click());
      pending.push(...clicks);
      settled = Promise.allSettled(pending);
      await expect.poll(() => bodies.filter(Boolean).length, { timeout: 15_000 }).toBe(2);
      expect(bodies.map((body) => body.expectedVersion)).toEqual([beforeDaily.sourceVersion, beforeDaily.sourceVersion]);
      expect(new Set(bodies.map((body) => body.commandId)).size).toBe(2);
      expect(bodies.every((body) => body.isSupplemental === (kind === 'supplemental'))).toBe(true);
      expect(bodies.map((body) => body.lines.find((line) => line.reconciliationBatchDailyLineId === source.dailyLineId)?.issuedQty)).toEqual([1, 2]);
      const releasedAt = Date.now();
      release();
      await Promise.all(clicks);
      const results: Response[] = await Promise.all(responses);
      expect(timedOut).toBe(false);
      clearTimeout(deadline);
      expect(results.map((response) => response.status()).sort()).toEqual([201, 409]);
      const winner = results.findIndex((response) => response.status() === 201);
      const loser = 1 - winner;
      const created = (await results[winner].json()).data;
      expect(dbVerifier.query(`SELECT CAST(issuedQty AS CHAR) AS quantity FROM inventoryissuelines WHERE issueId=UNHEX('${binaryId(created.issueId)}') AND reconciliationBatchDailyLineId=UNHEX('${binaryId(source.dailyLineId)}');`)).toEqual([{ quantity: (winner + 1).toFixed(6) }]);
      const rejected = await results[loser].json();
      expect(rejected.success).toBe(false);
      if (kind === 'supplemental') {
        const loserDialog = pages[loser].getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
        await expect(loserDialog).toBeVisible();
        await expect(loserDialog.getByRole('alert')).toBeVisible();
        await expect(loserDialog.getByLabel('Số lượng xuất thêm', { exact: true })).toHaveValue(String(loser + 1));
      } else {
        await expect(pages[loser].getByRole('button', { name: 'Tải lại dữ liệu mới nhất', exact: true })).toBeVisible();
        await expect(pages[loser].getByLabel(`Số lượng thực xuất ${source.ingredientName}`, { exact: true })).toHaveValue(String(loser + 1));
      }
      await pages[loser].screenshot({ path: path.join(evidence, '12-race-loser-retained.png') });
      const after = dbVerifier.captureStockSnapshot(binaryId(source.ingredientId));
      expect(after).toEqual(before);
      expect(allStocks()).toEqual(originalStocks);
      expect(created.provisions).toEqual([]);
      const afterDaily = await readDaily();
      expect(afterDaily.sourceVersion).toBe(beforeDaily.sourceVersion + 1);
      const afterLine = afterDaily.dates.find((day) => day.serviceDate === scope.weekStartDate)!.lines.find((line) => line.dailyLineId === source.dailyLineId)!;
      const remaining = (kind === 'supplemental' ? 3 : source.requiredQuantity) - (winner + 1);
      expect(afterLine.remainingQuantity).toBe(remaining);
      if (predecessor) expect(dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l WHERE l.issueId=UNHEX('${binaryId(predecessor.issueId)}') ORDER BY id;`)).toEqual(predecessorRows);
      expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`)).toHaveLength(kind === 'supplemental' ? 2 : 1);
      for (const [index, body] of bodies.entries()) {
        expect(body.commandId).toMatch(/^[a-f0-9-]{36}$/i);
        const receipts = dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${body.commandId}';`);
        expect(receipts).toHaveLength(index === winner ? 1 : 0);
      }
      await pages[loser].reload();
      await expect(pages[loser].getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
      await expect(pages[loser].getByRole('dialog')).toHaveCount(0);
      await pages[loser].screenshot({ path: path.join(evidence, '13-race-loser-reloaded.png') });
      await Promise.all(pages.map((page) => page.unroute('**/api/inventory-issues')));
      const beforeReplay = dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,reconciliationbatches,lifecyclecommandreceipts,lifecycletransitions,currentstock,currentstocklots,stockmovements;');
      const replay = (page: typeof thukhoPage, body: CreateMrxIssueRequest) => page.evaluate(async (request) => {
        const response = await fetch('/api/inventory-issues', {
          method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION', 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(15_000),
        });
        return { status: response.status, body: await response.json() };
      }, body);
      await Promise.all(pages.map((page) => respectApiBudget(page)));
      const identicalReplays = await Promise.all(pages.map((page) => replay(page, bodies[winner])));
      const alteredBody: CreateMrxIssueRequest = { ...bodies[winner], lines: bodies[winner].lines.map((line) => line.reconciliationBatchDailyLineId === source.dailyLineId ? { ...line, issuedQty: 0.5 } : line) };
      const alteredReplay = await replay(pages[loser], alteredBody);
      for (const result of [...identicalReplays, alteredReplay]) {
        expect(result.status).toBe(201);
        expect(result.body.success).toBe(true);
        expect(result.body.data.issueId).toBe(created.issueId);
        expect(result.body.data.issueCode).toBe(created.issueCode);
      }
      expect(dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,reconciliationbatches,lifecyclecommandreceipts,lifecycletransitions,currentstock,currentstocklots,stockmovements;')).toEqual(beforeReplay);
      fs.writeFileSync(path.join(evidence, 'replay-result.json'), JSON.stringify({ batchId, commandId: bodies[winner].commandId, issueId: created.issueId, identicalReplays, alteredReplay, originalQuantity: winner + 1, attemptedAlteredQuantity: 0.5, ledgerUnchanged: true, limitation: 'Concurrent replay after observed commit, not simultaneous first-use duplicate command or dropped network response.' }, null, 2));
      expect(arrivals).toHaveLength(2);
      expect(arrivals.every((arrival) => arrival <= releasedAt)).toBe(true);
      expect(new Set(bodies.map((body) => body.commandId)).size).toBe(2);
      fs.writeFileSync(path.join(evidence, 'race-result.json'), JSON.stringify({ kind, batchId, predecessorIssueId: predecessor?.issueId, winnerIssueId: created.issueId, expectedVersion: beforeDaily.sourceVersion, finalVersion: afterDaily.sourceVersion, statuses: results.map((response) => response.status()), arrivals, releasedAt, timedOut, requestVersions: bodies.map((body) => body.expectedVersion), winnerQuantity: winner + 1, remaining, predecessorRetained: kind === 'supplemental', loserReceiptAbsent: true }, null, 2));
      console.log(`[G4] ${kind}: same valid version, distinct commands; one201/one409, loser draft retained/reload recovered, unchanged physical stock and winner-only receipt; initial predecessor retained where applicable.`);
    } finally {
      timedOut = true;
      clearTimeout(deadline);
      release();
      if (settled) await settled;
      await thukhoPage.unroute('**/api/inventory-issues');
      await secondContext.close();
    }
  });
  }

  for (const order of ['completion-first', 'supplemental-first'] as const) {
  test(`@G4-Race ${order}: completion and supplemental commands preserve terminal authority`, async ({ dieuphoiPage, adminPage, managerPage, thukhoPage, dbVerifier }) => {
    test.setTimeout(240_000);
    const scope = scenarioScope(dbVerifier, order === 'completion-first' ? 4 : 5);
    const evidence = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, order);
    fs.mkdirSync(evidence, { recursive: true });
    const stocks = () => dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
    const originalStocks = stocks();
    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
    const batchHex = binaryId(batchId);
    const days = dbVerifier.query<{ date: string }>(`SELECT DISTINCT CAST(ServiceDate AS CHAR) AS date FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') AND RequiredQuantity>0 ORDER BY date;`);
    expect(days).toHaveLength(6);
    for (const { date } of days) {
      await respectApiBudget(thukhoPage);
      await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${date}`);
      await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      const response = thukhoPage.waitForResponse((item) => item.url().endsWith('/api/inventory-issues') && item.request().method() === 'POST', { timeout: 15_000 });
      await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
      expect((await response).status()).toBe(201);
    }
    const state = () => dbVerifier.query<{ status: string; version: string }>(`SELECT Status AS status, Version AS version FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex}');`);
    const before = state()[0];
    expect(before.status).toBe('IN_PROGRESS');
    const initialLines = dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId WHERE i.reconciliationBatchId=UNHEX('${batchHex}') ORDER BY id;`);
    expect(initialLines.length).toBeGreaterThan(0);
    await thukhoPage.reload();
    const readDaily = () => thukhoPage.evaluate(async (id) => {
      const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Warehouse readiness failed: ${response.status}`);
      return (await response.json()).data;
    }, batchId) as Promise<MrxWarehouseDaily>;
    const daily = await readDaily();
    expect(daily.weeklyStatus).toBe('WEEK_COMPLETE');
    expect(daily.sourceVersion).toBe(Number(before.version));
    const source = daily.dates.find((day) => day.serviceDate === days[5].date)!.lines.find((line) => line.requiredQuantity > 0)!;
    await respectApiBudget(managerPage);
    await managerPage.goto(`/reconciliation?batchId=${batchId}`);
    await managerPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
    await thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
    const dialog = thukhoPage.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
    await dialog.getByLabel('Chọn nguyên liệu bổ sung', { exact: true }).selectOption(source.dailyLineId);
    await dialog.getByLabel('Số lượng xuất thêm', { exact: true }).fill('1');
    await dialog.getByLabel('Lý do xuất bổ sung', { exact: true }).fill(`${scope.reason} completion contention`);
    await respectApiBudget(thukhoPage);
    const held: Route[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const abortHeld = () => Promise.all(held.map((route) => route.abort('timedout').catch(() => {})));
    const barrier = async (route: Route) => {
      held.push(route);
      timer ??= setTimeout(() => { timedOut = true; void abortHeld(); }, 15_000);
    };
    const completePattern = `**/api/reconciliation/batches/${batchId}/complete`;
    const issuePattern = '**/api/inventory-issues';
    await managerPage.route(completePattern, barrier);
    await thukhoPage.route(issuePattern, barrier);
    const completed = managerPage.waitForResponse((item) => item.url().endsWith(`/batches/${batchId}/complete`) && item.request().method() === 'POST', { timeout: 15_000 });
    const issued = thukhoPage.waitForResponse((item) => item.url().endsWith('/api/inventory-issues') && item.request().method() === 'POST', { timeout: 15_000 });
    const clicks = [managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click(), thukhoPage.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true }).click()];
    const settled = Promise.allSettled([completed, issued, ...clicks]);
    try {
      await expect.poll(() => held.length, { timeout: 15_000 }).toBe(2);
      const completeRoute = held.find((route) => route.request().url().endsWith('/complete'))!;
      const issueRoute = held.find((route) => route.request().url().endsWith('/inventory-issues'))!;
      const completeBody = completeRoute.request().postDataJSON();
      const issueBody = issueRoute.request().postDataJSON() as CreateMrxIssueRequest;
      expect(completeBody.expectedVersion).toBe(Number(before.version));
      expect(issueBody.expectedVersion).toBe(Number(before.version));
      expect(issueBody.isSupplemental).toBe(true);
      expect(issueBody.lines).toHaveLength(1);
      expect(issueBody.lines[0].issuedQty).toBe(1);
      expect(issueBody.lines[0].reconciliationBatchDailyLineId).toBe(source.dailyLineId);
      const winnerRoute = order === 'completion-first' ? completeRoute : issueRoute;
      const loserRoute = order === 'completion-first' ? issueRoute : completeRoute;
      const winnerReleasedAt = Date.now();
      await winnerRoute.continue();
      const winner = await (order === 'completion-first' ? completed : issued);
      expect(winner.status(), await winner.text()).toBe(order === 'completion-first' ? 200 : 201);
      const afterWinner = state()[0];
      expect(Number(afterWinner.version)).toBe(Number(before.version) + 1);
      expect(afterWinner.status).toBe(order === 'completion-first' ? 'COMPLETED' : 'IN_PROGRESS');
      const ledger = () => dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,reconciliationbatches,reconciliationdispositions,lifecyclecommandreceipts,lifecycletransitions;');
      const committed = ledger();
      const winnerObservedAt = Date.now();
      const loserReleasedAt = Date.now();
      await loserRoute.continue();
      const results = await Promise.all([completed, issued]);
      expect(results.map((response) => response.status())).toEqual(order === 'completion-first' ? [200, 409] : [409, 201]);
      expect(ledger()).toEqual(committed);
      expect(stocks()).toEqual(originalStocks);
      const retained = dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId WHERE i.reconciliationBatchId=UNHEX('${batchHex}') ORDER BY id;`);
      expect(retained.filter((line) => initialLines.some((original) => JSON.stringify(original) === JSON.stringify(line)))).toEqual(initialLines);
      expect(dbVerifier.query(`SELECT issueId FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${batchHex}');`)).toHaveLength(order === 'completion-first' ? 6 : 7);
      expect(issueBody.commandId).toMatch(/^[a-f0-9-]{36}$/i);
      expect(dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${issueBody.commandId}';`)).toHaveLength(order === 'completion-first' ? 0 : 1);
      expect(timedOut).toBe(false);
      const afterDaily = await readDaily();
      expect(afterDaily.sourceVersion).toBe(Number(before.version) + 1);
      expect(afterDaily.weeklyStatus).toBe(order === 'completion-first' ? 'WEEK_COMPLETE' : 'VARIANCE_REQUIRES_RESOLUTION');
      await managerPage.reload();
      await managerPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
      await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
      fs.writeFileSync(path.join(evidence, 'completion-race.json'), JSON.stringify({ order, batchId, before, afterWinner, reloadedWeeklyStatus: afterDaily.weeklyStatus, winnerReleasedAt, winnerObservedAt, loserReleasedAt, versions: [completeBody.expectedVersion, issueBody.expectedVersion], statuses: results.map((response) => response.status()), initialIssues: 6, finalIssues: order === 'completion-first' ? 6 : 7, initialLinesRetained: true, loserNoWrites: true, physicalStockUnchanged: true, limitation: 'Ordered public dispatch after DB winner observation, not simultaneous internal DB lock overlap.' }, null, 2));
    } finally {
      clearTimeout(timer);
      await abortHeld();
      await settled;
      await managerPage.unroute(completePattern, barrier);
      await thukhoPage.unroute(issuePattern, barrier);
    }
  });
  }

  test('Stock oracle rejects a missing ingredient instead of reporting finite zero as a stock proof', async ({ dbVerifier }) => {
    const missingId = '00000000000000000000000000000000';
    expect(dbVerifier.query(`SELECT ingredientId FROM ingredients WHERE ingredientId=UNHEX('${missingId}');`)).toHaveLength(0);
    expect(() => dbVerifier.captureStockSnapshot(missingId)).toThrow(/one existing operational stock row/);
  });
});
