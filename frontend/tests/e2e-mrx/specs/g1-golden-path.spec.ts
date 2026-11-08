import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';
import type { StockSnapshot } from '../core/mysqlVerifier';
import { evidenceStep } from '../fixtures/actionEvidence';
import type { MrxKitchenCooking } from '../../../src/api/mrxApi';

function guidToDotNetHex(value: string): string {
  const [a, b, c, d, e] = value.split('-');
  const reverseBytes = (part: string) => part.match(/../g)?.reverse().join('') ?? '';
  return `${reverseBytes(a)}${reverseBytes(b)}${reverseBytes(c)}${d}${e}`.toUpperCase();
}

test.describe('@G1-Golden MRX Golden Path Lifecycle (Horizontal & Vertical)', () => {
  test.setTimeout(180_000);
  test('Chuỗi Golden Path liên hoàn: Lập lô -> Đóng băng -> Bàn giao -> Kho xuất -> Bếp xem phiếu -> Manager khóa sổ', async ({
    dieuphoiPage,
    thukhoPage,
    beptruongPage,
    adminPage,
    managerPage,
    dbVerifier,
  }) => {
    const scope = scenarioScope(dbVerifier, 0);
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
    await thukhoPage.bringToFront();
    const { batchId: createdBatchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, recordSteps: true }, scope);
    fs.writeFileSync(path.join(evidence, 'measurement-scope.json'), JSON.stringify({ batchId: createdBatchId, serviceDate: scope.weekStartDate }, null, 2));

    // =========================================================================
    // CHẶNG 2: Thủ kho xuất kho định lượng
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 2: Thủ kho xuất kho định lượng...');
    await thukhoPage.bringToFront();
    await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${createdBatchId}&date=${scope.weekStartDate}`);
    await expect(thukhoPage.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue(createdBatchId);

    const fillAllBtn = thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ' });
    await expect(fillAllBtn).toBeVisible();
    await evidenceStep(thukhoPage, scope, 'warehouse-fill-first-day', 'WAREHOUSESTAFF', async () => {
      await fillAllBtn.click();
    }, { batchId: createdBatchId, serviceDate: scope.weekStartDate });
    for (const width of [960, 1024, 1280, 1366]) {
      await thukhoPage.setViewportSize({ width, height: 768 });
      for (const control of [fillAllBtn, thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }), thukhoPage.getByRole('button', { name: 'Cả tuần (Tổng hợp)', exact: true }), thukhoPage.getByRole('button', { name: /^Lịch sử phiếu \(\s*0\s*\)$/ })]) {
        await expect(control).toBeInViewport({ ratio: 1 });
        await control.click({ trial: true });
      }
      await expect(thukhoPage.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toBeInViewport({ ratio: 1 });
      await expect(thukhoPage.getByLabel('Ngày xuất kho', { exact: true })).toBeInViewport({ ratio: 1 });
      await thukhoPage.screenshot({ path: path.join(evidence, `warehouse-controls-${width}.png`) });
    }
    await thukhoPage.setViewportSize({ width: 1280, height: 720 });
    await thukhoPage.screenshot({ path: path.join(evidence, '05-warehouse-filled.png') });
    console.log('[UI] Thủ kho: đã bấm Điền đủ toàn bộ; tiếp theo bấm Xác nhận xuất kho.');
    const submitBtn = thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho' });
    const beforeStocks = new Map<string, StockSnapshot>();
    await thukhoPage.route('**/api/inventory-issues', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        for (const line of request.postDataJSON().lines) {
          const id = guidToDotNetHex(line.ingredientId);
          beforeStocks.set(id, dbVerifier.captureStockSnapshot(id));
        }
      }
      await route.continue();
    });
    const createResponse = (await evidenceStep(thukhoPage, scope, 'warehouse-confirm-first-day', 'WAREHOUSESTAFF', async () => {
      const [response] = await Promise.all([
        thukhoPage.waitForResponse((item) => item.url().includes('/api/inventory-issues') && item.request().method() === 'POST'),
        submitBtn.click(),
      ]);
      await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
      return response;
    }, { batchId: createdBatchId, serviceDate: scope.weekStartDate }))!;
    const createdIssue = (await createResponse.json()).data as {
      issueId: string;
      issueCode: string;
      provisions: Array<{ stockMovementId: string; provisionedQuantity: number }>;
    };
    await thukhoPage.unroute('**/api/inventory-issues');
    expect(createResponse.ok()).toBe(true);
    const createBody = createResponse.request().postDataJSON();
    expect(beforeStocks.size).toBeGreaterThan(0);
    const stockCheckpoints: Array<{ ingredientId: string; before: StockSnapshot; after: StockSnapshot }> = [];
    for (const line of createBody.lines) {
      const id = guidToDotNetHex(line.ingredientId);
      const before = beforeStocks.get(id)!;
      const after = dbVerifier.captureStockSnapshot(id);
      expect(after).toEqual(before);
      stockCheckpoints.push({ ingredientId: line.ingredientId, before, after });
    }
    expect(createdIssue.provisions).toEqual([]);
    const persistedLines = dbVerifier.query<{ daily: string; ingredient: string; unit: string; quantity: string }>(
      `SELECT HEX(reconciliationBatchDailyLineId) AS daily, HEX(ingredientId) AS ingredient, HEX(unitId) AS unit, CAST(issuedQty AS CHAR) AS quantity FROM inventoryissuelines WHERE issueId=UNHEX('${guidToDotNetHex(createdIssue.issueId)}') ORDER BY daily;`);
    expect(persistedLines).toEqual(createBody.lines.map((line: { reconciliationBatchDailyLineId: string; ingredientId: string; unitId: string; issuedQty: number }) => ({
      daily: guidToDotNetHex(line.reconciliationBatchDailyLineId), ingredient: guidToDotNetHex(line.ingredientId),
      unit: guidToDotNetHex(line.unitId), quantity: line.issuedQty.toFixed(6),
    })).sort((a: { daily: string }, b: { daily: string }) => a.daily.localeCompare(b.daily)));
    const provisionSummary = thukhoPage.getByText('Xuất kho thành công.', { exact: true });
    await expect(provisionSummary).toBeVisible();
    await expect(thukhoPage.getByRole('status').getByRole('list', { includeHidden: true })).toHaveCount(0);
    const noticeHeight = await provisionSummary.evaluate((element) => element.closest('[role="status"]')?.getBoundingClientRect().height ?? element.parentElement!.getBoundingClientRect().height);
    expect(noticeHeight).toBeLessThanOrEqual(64);
    await expect(thukhoPage.locator('header').getByText('Đang đối chiếu', { exact: true })).toBeVisible();
    await thukhoPage.screenshot({ path: path.join(evidence, '06-warehouse-issued.png') });
    console.log('[UI] Thủ kho: Xác nhận xuất kho thành công; đã đối chiếu tồn/lot/movement.');

    const reloadedIssue = await thukhoPage.evaluate(async (issueId) => {
      const token = localStorage.getItem('ipc_v3_token');
      const response = await fetch(`/api/inventory-issues/${issueId}?sourceFamily=MATERIAL_RECONCILIATION`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await response.json()).data;
    }, createdIssue.issueId);
    expect(reloadedIssue.provisions).toEqual(createdIssue.provisions);

    await evidenceStep(thukhoPage, scope, 'warehouse-exact-replay', 'WAREHOUSESTAFF', async () => {
      const replayedIssue = await thukhoPage.evaluate(async (body) => {
        const token = localStorage.getItem('ipc_v3_token');
        const response = await fetch('/api/inventory-issues', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return (await response.json()).data;
      }, createBody);
      expect(replayedIssue.issueId).toBe(createdIssue.issueId);
      expect(replayedIssue.provisions).toEqual(createdIssue.provisions);
    }, { batchId: createdBatchId, serviceDate: scope.weekStartDate });

    for (let offset = 1; offset < 6; offset++) {
      const day = new Date(`${scope.weekStartDate}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + offset);
      const serviceDate = day.toISOString().slice(0, 10);
      await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${createdBatchId}&date=${serviceDate}`);
      await expect(thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true })).toBeEnabled();
      await evidenceStep(thukhoPage, scope, `warehouse-fill-day-${offset + 1}`, 'WAREHOUSESTAFF', async () => {
        await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      }, { batchId: createdBatchId, serviceDate });
      await evidenceStep(thukhoPage, scope, `warehouse-confirm-day-${offset + 1}`, 'WAREHOUSESTAFF', async () => {
        const issued = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
        await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
        const result = await issued;
        expect(result.ok()).toBe(true);
        await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
        return result;
      }, { batchId: createdBatchId, serviceDate });
    }

    // =========================================================================
    // CHẶNG 3: Bếp trưởng kiểm tra phiếu nấu
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 3: Bếp trưởng kiểm tra phiếu nấu...');
    await beptruongPage.bringToFront();
    await evidenceStep(beptruongPage, scope, 'chef-open-and-verify-precision', 'CHEF', async () => {
      const loaded = beptruongPage.waitForResponse((response) => response.url().endsWith(`/api/reconciliation/batches/${createdBatchId}/kitchen-cooking`) && response.request().method() === 'GET');
      await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${createdBatchId}`);
      await expect(beptruongPage.getByRole('heading', { name: 'Phiếu nấu theo lô' })).toBeVisible();
      const response = await loaded;
      const cooking = (await response.json()).data as MrxKitchenCooking;
      const target = cooking.rows.find((row) => row.serviceDate === scope.weekStartDate && row.dishName === 'Rau má thịt bằm' && row.ingredientCode === 'ING-60BD2E4567');
      expect(target, 'Known real-template rate must exist; no substituted row is accepted.').toBeTruthy();
      expect(target!.bomQuantityPerServing).toBe(0.002586);
      expect(target!.servings).toBe(1000);
      expect(target!.totalRequiredQuantity).toBe(2.586);
      expect(target!.unitName).toBe('kg');
      const group = beptruongPage.getByRole('region', { name: `Món ${target!.dishName} · ${target!.menuVariant}`, exact: true })
        .filter({ hasText: `${target!.weekday} · ${scope.weekStartDate.split('-').reverse().join('/')} · ${target!.shiftName}` })
        .filter({ has: beptruongPage.getByText(`(${target!.dishCode})`, { exact: true }) });
      await expect(group).toHaveCount(1);
      const ingredient = group.getByRole('row').filter({ hasText: target!.ingredientCode });
      await expect(ingredient).toHaveCount(1);
      await ingredient.scrollIntoViewIfNeeded();
      const cells = ingredient.getByRole('cell');
      await expect(cells.nth(1)).toHaveText('kg');
      await expect(cells.nth(2)).toHaveText('0,002586');
      await expect(cells.nth(4)).toHaveText('2,586');
      await expect(beptruongPage.getByRole('spinbutton')).toHaveCount(0);
      await expect(beptruongPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true })).toHaveCount(0);
      fs.writeFileSync(path.join(evidence, 'chef-precision-oracle.json'), JSON.stringify({ runId: scope.runId, attemptId: scope.attemptId,
        batchId: createdBatchId, step: 'chef-open-and-verify-precision', responseRow: target, renderedCells: await cells.allTextContents(),
      }, null, 2));
      return response;
    }, { batchId: createdBatchId });
    await beptruongPage.screenshot({ path: path.join(evidence, '07-chef-cooking-sheet.png') });

    // =========================================================================
    // CHẶNG 4: Quản lý đối soát và kiểm tra bảng điều khiển
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 4: Quản lý đối soát...');
    await managerPage.bringToFront();
    await managerPage.goto(`/reconciliation?batchId=${createdBatchId}`);
    await expect(managerPage.getByRole('heading', { name: 'Đối soát nguyên liệu', exact: true })).toBeVisible();
    await evidenceStep(managerPage, scope, 'manager-open-completion', 'MANAGER', async () => {
      await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
      await expect(managerPage.getByRole('dialog')).toContainText(`Tuần bắt đầu ${scope.weekStartDate.split('-').reverse().join('/')}`);
      await expect(managerPage.getByRole('dialog')).toContainText('Đã xuất đủ');
    }, { batchId: createdBatchId });
    await managerPage.screenshot({ path: path.join(evidence, '08-manager-confirm-dialog.png') });
    console.log('[UI] Manager: đã bấm Chốt đối soát tuần; đang hiển thị modal xác nhận.');
    await evidenceStep(managerPage, scope, 'manager-confirm-completion', 'MANAGER', async () => {
      const completed = managerPage.waitForResponse((response) => response.url().endsWith(`/api/reconciliation/batches/${createdBatchId}/complete`) && response.request().method() === 'POST');
      await managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
      const result = await completed;
      expect(result.ok()).toBe(true);
      await expect(managerPage.getByRole('dialog')).toHaveCount(0);
      return result;
    }, { batchId: createdBatchId });
    await evidenceStep(managerPage, scope, 'manager-reload-completed', 'MANAGER', async () => {
      await managerPage.reload();
      await expect(managerPage.locator('header').getByText('Hoàn tất', { exact: true })).toBeVisible();
      await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
    }, { batchId: createdBatchId });
    await managerPage.screenshot({ path: path.join(evidence, '09-manager-completed-reloaded.png') });
    console.log('[UI] Manager: đã bấm Xác nhận khóa chốt tuần; tải lại kiểm tra trạng thái cuối.');

    // =========================================================================
    // CHẶNG 5: Vertical SQL Invariant Assertion trên Database Sandbox
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 5: Vertical SQL Assertion...');
    for (const checkpoint of stockCheckpoints)
      expect(dbVerifier.captureStockSnapshot(guidToDotNetHex(checkpoint.ingredientId))).toEqual(checkpoint.before);
    const rows = dbVerifier.query<{ Status: string; Version: string }>(
      `SELECT Status, Version FROM reconciliationbatches WHERE HEX(BatchId)='${guidToDotNetHex(createdBatchId)}';`
    );

    const movementRows = dbVerifier.query<{ StockMovementId: string }>(
      `SELECT HEX(sm.MovementId) AS StockMovementId FROM stockmovements sm ` +
      `JOIN inventoryissues i ON i.IssueId=sm.RefId WHERE sm.RefTable='inventoryissues' ` +
      `AND i.ReconciliationBatchId=UNHEX('${guidToDotNetHex(createdBatchId)}')`
    );
    expect(movementRows).toEqual([]);

    expect(rows.length).toBe(1);
    expect(rows[0].Status).toBe('COMPLETED');
    fs.writeFileSync(path.join(evidence, 'golden-persistence.json'), JSON.stringify({ runId: scope.runId, attemptId: scope.attemptId,
      batchId: createdBatchId, serviceDate: scope.weekStartDate, firstIssueId: createdIssue.issueId,
      issueRequestBodySha256: createHash('sha256').update(createResponse.request().postData()!).digest('hex'),
      stockStep: 'warehouse-confirm-first-day', stockCheckpoints, persistedStockMovements: movementRows, persistedIssueLines: persistedLines,
      completionStep: 'manager-reload-completed', persistedBatch: rows[0], capturedAtUtc: new Date().toISOString(),
    }, null, 2));
    console.log(`[G1-GOLDEN] Verified Batch Status in DB: ${rows[0].Status}, Version: ${rows[0].Version}`);
  });
});
