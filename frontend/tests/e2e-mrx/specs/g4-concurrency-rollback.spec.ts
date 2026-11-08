import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { loginRole } from '../fixtures/authHelpers';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';
import type { MrxWarehouseDaily } from '../../../src/api/mrxApi';

function binaryId(value: string): string {
  const [a, b, c, d, e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}

 test.describe('@G4-Rollback Real Concurrency & Mathematical Stock Invariants', () => {
  test('@G4-Race Two valid warehouse browser contexts race supplemental issues from the same version', async ({ browser, viewport, baseURL, dieuphoiPage, adminPage, thukhoPage, dbVerifier }) => {
    test.setTimeout(240_000);
    const scope = scenarioScope(dbVerifier, 2);
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
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
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    await thukhoPage.getByLabel(`Số lượng thực xuất ${source.ingredientName}`, { exact: true }).fill(String(source.requiredQuantity - 3));
    const initialResponse = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    const initial = await initialResponse;
    expect(initial.ok()).toBe(true);
    const predecessor = (await initial.json()).data;
    await expect(thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
    const beforeDaily = await readDaily();
    const predecessorRows = dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l WHERE l.issueId=UNHEX('${binaryId(predecessor.issueId)}') ORDER BY id;`);
    expect(predecessorRows.length).toBeGreaterThan(0);
    const before = dbVerifier.captureStockSnapshot(binaryId(source.ingredientId));

    const secondContext = await browser.newContext({ viewport, baseURL });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const bodies: Array<{ commandId: string; expectedVersion: number; isSupplemental: boolean; lines: Array<{ issuedQty: number }> }> = [];
    try {
      const secondPage = await secondContext.newPage();
      await loginRole(secondPage, 'thukho', baseURL);
      await secondPage.goto(url);
      const pages = [thukhoPage, secondPage];
      for (const [index, page] of pages.entries()) {
        await page.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
        await dialog.getByLabel('Chọn nguyên liệu bổ sung', { exact: true }).selectOption(source.dailyLineId);
        await dialog.getByLabel('Số lượng xuất thêm', { exact: true }).fill(String(index + 1));
        await dialog.getByLabel('Lý do xuất bổ sung', { exact: true }).fill(`${scope.reason} phiên ${index + 1}`);
        await page.route('**/api/inventory-issues', async (route) => {
          if (route.request().method() === 'POST') {
            bodies[index] = route.request().postDataJSON();
            await gate;
          }
          await route.continue();
        });
      }
      const responses = pages.map((page) => page.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST'));
      const clicks = pages.map((page) => page.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true }).click());
      await expect.poll(() => bodies.filter(Boolean).length).toBe(2);
      expect(bodies.map((body) => body.expectedVersion)).toEqual([beforeDaily.sourceVersion, beforeDaily.sourceVersion]);
      expect(new Set(bodies.map((body) => body.commandId)).size).toBe(2);
      expect(bodies.every((body) => body.isSupplemental)).toBe(true);
      release();
      await Promise.all(clicks);
      const results = await Promise.all(responses);
      expect(results.map((response) => response.status()).sort()).toEqual([201, 409]);
      const winner = results.findIndex((response) => response.status() === 201);
      const loser = 1 - winner;
      const created = (await results[winner].json()).data;
      const rejected = await results[loser].json();
      expect(rejected.success).toBe(false);
      const loserDialog = pages[loser].getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
      await expect(loserDialog).toBeVisible();
      await expect(loserDialog.getByRole('alert')).toBeVisible();
      await expect(loserDialog.getByLabel('Số lượng xuất thêm', { exact: true })).toHaveValue(String(loser + 1));
      await pages[loser].screenshot({ path: path.join(evidence, '12-race-loser-retained.png') });
      const after = dbVerifier.captureStockSnapshot(binaryId(source.ingredientId));
      expect(after).toEqual(before);
      expect(created.provisions).toEqual([]);
      const afterDaily = await readDaily();
      expect(afterDaily.sourceVersion).toBe(beforeDaily.sourceVersion + 1);
      const afterLine = afterDaily.dates.find((day) => day.serviceDate === scope.weekStartDate)!.lines.find((line) => line.dailyLineId === source.dailyLineId)!;
      expect(afterLine.remainingQuantity).toBe(3 - (winner + 1));
      expect(dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l WHERE l.issueId=UNHEX('${binaryId(predecessor.issueId)}') ORDER BY id;`)).toEqual(predecessorRows);
      expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`)).toHaveLength(2);
      for (const [index, body] of bodies.entries()) {
        expect(body.commandId).toMatch(/^[a-f0-9-]{36}$/i);
        const receipts = dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${body.commandId}';`);
        expect(receipts).toHaveLength(index === winner ? 1 : 0);
      }
      await pages[loser].reload();
      await expect(pages[loser].getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
      await expect(pages[loser].getByRole('dialog')).toHaveCount(0);
      await pages[loser].screenshot({ path: path.join(evidence, '13-race-loser-reloaded.png') });
      fs.writeFileSync(path.join(evidence, 'race-result.json'), JSON.stringify({ batchId, predecessorIssueId: predecessor.issueId, winnerIssueId: created.issueId, expectedVersion: beforeDaily.sourceVersion, finalVersion: afterDaily.sourceVersion, statuses: results.map((response) => response.status()), winnerQuantity: winner + 1, remaining: afterLine.remainingQuantity, predecessorRetained: true, loserReceiptAbsent: true }, null, 2));
      console.log('[G4] Two independent logged-in browser contexts: same valid version, distinct commands; one201/one409, predecessor retained, loser draft retained/reload recovered, unchanged physical stock/lots/movements and winner-only receipt.');
    } finally {
      release();
      await thukhoPage.unroute('**/api/inventory-issues');
      await secondContext.close();
    }
  });

  test('Stock oracle rejects a missing ingredient instead of reporting finite zero as a stock proof', async ({ dbVerifier }) => {
    const missingId = '00000000000000000000000000000000';
    expect(dbVerifier.query(`SELECT ingredientId FROM ingredients WHERE ingredientId=UNHEX('${missingId}');`)).toHaveLength(0);
    expect(() => dbVerifier.captureStockSnapshot(missingId)).toThrow(/one existing operational stock row/);
  });
});
