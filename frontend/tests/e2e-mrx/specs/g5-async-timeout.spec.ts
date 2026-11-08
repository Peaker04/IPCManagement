import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope, parseCookingFile, captureStationUI } from '../fixtures/mrxWorkflow';
import type { StockSnapshot } from '../core/mysqlVerifier';
import { readQualificationCredentials, respectApiBudget, respectLoginBudget } from '../fixtures/authHelpers';
import type { CreateMrxIssueRequest, MrxIssueCreated, MrxWarehouseDaily, CreateCoordinatedPreparationIssueRequest, CoordinatedPreparationIssueResult, MrxPreparation, MrxKitchenCooking } from '../../../src/api/mrxApi';

function binaryId(value: string): string {
  const [a, b, c, d, e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}

function micros(value: string): bigint {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error('Invalid six-decimal base quantity.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

test.describe('@G5-Async Asynchronous, Offline Resilience & Session Expiry', () => {
  for (const supplemental of [false, true]) {
  test(`@G5-Recovery Committed ${supplemental ? 'supplemental' : 'initial'} issue response is lost, same command replays without a second stock effect, reload recovers`, async ({ dieuphoiPage, adminPage, thukhoPage, dbVerifier }) => {
    test.setTimeout(240_000);
    const scope = scenarioScope(dbVerifier, supplemental ? 5 : 3);
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
    const url = `/warehouse?view=mrx-daily&batchId=${batchId}&date=${scope.weekStartDate}`;
    await thukhoPage.bringToFront();
    await thukhoPage.goto(url);
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    let predecessorIssueId: string | undefined;
    let priorIssued = 0;
    if (supplemental) {
      const daily = await thukhoPage.evaluate(async (id) => {
        const token = localStorage.getItem('ipc_v3_token');
        const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Actual warehouse projection failed.');
        return (await response.json()).data as MrxWarehouseDaily;
      }, batchId);
      const line = daily.dates.find((day) => day.serviceDate === scope.weekStartDate)!.lines.find((item) => item.requiredQuantity > 1)!;
      expect(line).toBeTruthy();
      priorIssued = line.requiredQuantity - 1;
      await thukhoPage.getByLabel(`Số lượng thực xuất ${line.ingredientName}`, { exact: true }).fill(String(priorIssued));
      const initial = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
      await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
      const response = await initial;
      expect(response.status()).toBe(201);
      predecessorIssueId = (await response.json()).data.issueId;
      await thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
      const dialog = thukhoPage.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
      await dialog.getByLabel('Chọn nguyên liệu bổ sung', { exact: true }).selectOption(line.dailyLineId);
      await dialog.getByLabel('Số lượng xuất thêm', { exact: true }).fill('1');
      await dialog.getByLabel('Lý do xuất bổ sung', { exact: true }).fill(scope.reason);
    }
    const predecessorRows = predecessorIssueId ? dbVerifier.query(`SELECT HEX(issueLineId) AS id, CAST(issuedQty AS CHAR) AS quantity FROM inventoryissuelines WHERE issueId=UNHEX('${binaryId(predecessorIssueId)}') ORDER BY id;`) : [];
    const issueCount = supplemental ? 2 : 1;
    const artifactSuffix = supplemental ? '-supplemental' : '';
    const submitName = supplemental ? 'Xác nhận xuất bổ sung' : 'Xác nhận xuất kho';
    let command: CreateMrxIssueRequest | undefined;
    let committed: MrxIssueCreated | undefined;
    const before = new Map<string, StockSnapshot>();
    await thukhoPage.route('**/api/inventory-issues', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      command = route.request().postDataJSON();
      for (const line of command!.lines) {
        const id = binaryId(line.ingredientId);
        before.set(id, dbVerifier.captureStockSnapshot(id));
      }
      // Forward the real command and wait for server commit, but drop its response to the browser.
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      committed = (await response.json()).data;
      await route.abort('connectionreset');
    });
    try {
      await thukhoPage.getByRole('button', { name: submitName, exact: true }).click();
      const alert = thukhoPage.getByRole('alert');
      await expect(alert).toContainText('Chưa xác nhận được kết quả xuất kho');
      await expect(alert.getByRole('button', { name: 'Tải lại để kiểm tra kết quả' })).toBeEnabled();
      await expect(thukhoPage.getByRole('button', { name: submitName, exact: true })).toBeDisabled();
      if (supplemental) {
        await expect(thukhoPage.getByLabel('Số lượng xuất thêm', { exact: true })).toHaveValue('1');
        await expect(thukhoPage.getByLabel('Lý do xuất bổ sung', { exact: true })).toHaveValue(scope.reason);
      }
      expect(command).toBeTruthy();
      expect(committed?.issueId).toBeTruthy();
      await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toHaveCount(0);
      await thukhoPage.screenshot({ path: path.join(evidence, `14-response-lost-error${artifactSuffix}.png`) });
    } finally { await thukhoPage.unroute('**/api/inventory-issues'); }
    if (!command || !committed) throw new Error('No actual committed command was observed.');
    expect(command.commandId).toMatch(/^[a-f0-9-]{36}$/i);
    const stocksAfterCommit = new Map<string, StockSnapshot>();
    for (const line of command.lines) {
      const id = binaryId(line.ingredientId);
      const opening = before.get(id)!;
      const closing = dbVerifier.captureStockSnapshot(id);
      expect(closing).toEqual(opening);
      stocksAfterCommit.set(id, closing);
    }
    const batchHex = binaryId(batchId);
    const receiptSql = `SELECT commandId, responseJson FROM lifecyclecommandreceipts WHERE commandId='${command.commandId}';`;
    const receiptsBeforeReplay = dbVerifier.query(receiptSql);
    expect(receiptsBeforeReplay).toHaveLength(1);
    const versionSql = `SELECT version FROM reconciliationbatches WHERE batchId=UNHEX('${batchHex}');`;
    const versionBeforeReplay = dbVerifier.query(versionSql);
    expect(Number(versionBeforeReplay[0].version)).toBe(command.expectedVersion + 1);
    const replay = await thukhoPage.evaluate(async (body) => {
      const token = localStorage.getItem('ipc_v3_token');
      const response = await fetch('/api/inventory-issues', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, command);
    expect(replay.status).toBe(201);
    expect(replay.body.data).toEqual(committed);
    expect(dbVerifier.query(receiptSql)).toEqual(receiptsBeforeReplay);
    expect(dbVerifier.query(versionSql)).toEqual(versionBeforeReplay);
    const expectedIds = [committed.issueId, ...(predecessorIssueId ? [predecessorIssueId] : [])].map((id) => ({ id: binaryId(id) })).sort((a, b) => a.id.localeCompare(b.id));
    expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${batchHex}') ORDER BY id;`)).toEqual(expectedIds);
    if (predecessorIssueId) expect(dbVerifier.query(`SELECT HEX(issueLineId) AS id, CAST(issuedQty AS CHAR) AS quantity FROM inventoryissuelines WHERE issueId=UNHEX('${binaryId(predecessorIssueId)}') ORDER BY id;`)).toEqual(predecessorRows);
    for (const [id, snapshot] of stocksAfterCommit) expect(dbVerifier.captureStockSnapshot(id)).toEqual(snapshot);
    await thukhoPage.getByRole('button', { name: 'Tải lại để kiểm tra kết quả', exact: true }).click();
    await expect(thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
    await expect(thukhoPage.getByRole('button', { name: new RegExp(`^Lịch sử phiếu \\(\\s*${issueCount}\\s*\\)$`) })).toBeVisible();
    await expect(thukhoPage.getByRole('alert')).toHaveCount(0);
    const projection = await thukhoPage.evaluate(async (id) => {
      const token = localStorage.getItem('ipc_v3_token');
      const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Reload projection failed.');
      return (await response.json()).data;
    }, batchId);
    for (const line of command.lines) {
      const actual = projection.dates.flatMap((day: { lines: Array<{ dailyLineId: string; issuedQuantity: number; remainingQuantity: number }> }) => day.lines).find((item: { dailyLineId: string }) => item.dailyLineId === line.reconciliationBatchDailyLineId);
      expect(actual?.issuedQuantity).toBe(priorIssued + line.issuedQty);
      expect(actual?.remainingQuantity).toBe(0);
    }
    await thukhoPage.screenshot({ path: path.join(evidence, `15-response-lost-recovered${artifactSuffix}.png`) });
    fs.writeFileSync(path.join(evidence, `response-loss-result${artifactSuffix}.json`), JSON.stringify({ batchId, commandId: command.commandId, issueId: committed.issueId, commitStatus: 201, replayStatus: replay.status, issueCount, supplemental, predecessorRetained: supplemental ? true : undefined, unchangedReceipt: true, unchangedVersionAfterReplay: true, unchangedStocksAndMovementsAfterReplay: true, verifiedIngredientCount: stocksAfterCommit.size }, null, 2));
    console.log(`[G5] ${supplemental ? 'Supplemental' : 'Initial'} real201 committed response dropped; exact command replay returns same issue/receipt, no new stock/lot/movement/version effect; real recovery action reloads history${issueCount}.`);
  });
  }

  test('@G5-Session Same actor recovers the original draft after 401; foreign/stale drafts stay unavailable and stock changes once', async ({ dieuphoiPage, adminPage, thukhoPage, dbVerifier }) => {
    test.setTimeout(240_000);
    const scope = scenarioScope(dbVerifier, 4);
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
    const url = `/warehouse?view=mrx-daily&batchId=${batchId}&date=${scope.weekStartDate}`;
    await thukhoPage.goto(url);
    const daily = await thukhoPage.evaluate(async (id) => {
      const token = localStorage.getItem('ipc_v3_token');
      const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Actual warehouse projection failed.');
      return (await response.json()).data as MrxWarehouseDaily;
    }, batchId);
    const lines = daily.dates.find((day) => day.serviceDate === scope.weekStartDate)!.lines;
    const selected = lines.find((line) => line.requiredQuantity > 3)!;
    expect(selected).toBeTruthy();
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    await thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true }).fill('2.75');
    const opening = new Map(lines.map((line) => [line.ingredientId, dbVerifier.captureStockSnapshot(binaryId(line.ingredientId))]));
    const versionSql = `SELECT version FROM reconciliationbatches WHERE batchId=UNHEX('${binaryId(batchId)}');`;
    const beforeVersion = dbVerifier.query(versionSql);
    let issueSubmits = 0;
    thukhoPage.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/inventory-issues' && request.method() === 'POST') issueSubmits += 1;
    });
    // Abort before forwarding: unlike committed-response loss, the server receives no command.
    let precommit: CreateMrxIssueRequest | undefined;
    await thukhoPage.route('**/api/inventory-issues', async (route) => {
      precommit = route.request().postDataJSON() as CreateMrxIssueRequest;
      await route.abort('connectionfailed');
    });
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    await expect(thukhoPage.getByText('Chưa xác nhận được kết quả xuất kho', { exact: true })).toBeVisible();
    await expect(thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true })).toBeDisabled();
    expect(precommit?.commandId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(dbVerifier.query(versionSql)).toEqual(beforeVersion);
    expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`)).toHaveLength(0);
    expect(dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${precommit!.commandId}';`)).toHaveLength(0);
    for (const [id, stock] of opening) expect(dbVerifier.captureStockSnapshot(binaryId(id))).toEqual(stock);
    await thukhoPage.unroute('**/api/inventory-issues');
    await thukhoPage.getByRole('button', { name: 'Tải lại để kiểm tra kết quả', exact: true }).click();
    await thukhoPage.getByRole('button', { name: 'Khôi phục bản nháp', exact: true }).click();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toHaveValue('2.75');
    await expect(thukhoPage.getByRole('button', { name: /^Lịch sử phiếu \(\s*0\s*\)$/ })).toBeVisible();
    fs.writeFileSync(path.join(evidence, 'precommit-transport-no-write.json'), JSON.stringify({batchId,commandId:precommit!.commandId,fault:'Playwright abort before route forwarding; not a natural network incident',serverCommandNotForwarded:true,noIssue:true,noReceipt:true,unchangedVersionAndStocks:true,draftQuantityAfterExplicitRecovery:'2.75'},null,2));
    const saved = await thukhoPage.evaluate(({ id, date }) => {
      const key = Object.keys(localStorage).find((item) => item.endsWith(`mrx_initial_${id}_${date}`));
      if (!key) throw new Error('Actual pre-submit draft snapshot missing.');
      return { key, json: localStorage.getItem(key)! };
    }, { id: batchId, date: scope.weekStartDate });
    await respectApiBudget(adminPage);
    await adminPage.goto(url);
    await adminPage.evaluate(({ key, json }) => localStorage.setItem(key, json), saved);
    await adminPage.reload();
    await expect(adminPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toBeVisible();
    expect(new URL(adminPage.url()).searchParams.get('batchId')).toBe(batchId);
    expect(new URL(adminPage.url()).searchParams.get('date')).toBe(scope.weekStartDate);
    await expect(adminPage.getByRole('button', { name: 'Khôi phục bản nháp', exact: true })).toHaveCount(0);
    await respectApiBudget(thukhoPage, 32);
    await thukhoPage.evaluate(({ key, json }) => {
      const stale = JSON.parse(json); stale.version += 1;
      localStorage.setItem(key, JSON.stringify(stale));
    }, saved);
    await thukhoPage.reload();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toBeVisible();
    expect(new URL(thukhoPage.url()).searchParams.get('batchId')).toBe(batchId);
    expect(new URL(thukhoPage.url()).searchParams.get('date')).toBe(scope.weekStartDate);
    await expect(thukhoPage.getByRole('button', { name: 'Khôi phục bản nháp', exact: true })).toHaveCount(0);
    await thukhoPage.evaluate(({ key, json }) => localStorage.setItem(key, json), saved);
    await thukhoPage.reload();
    await thukhoPage.getByRole('button', { name: 'Khôi phục bản nháp', exact: true }).click();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toHaveValue('2.75');
    await expect(thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true })).toBeEnabled();
    await respectApiBudget(thukhoPage);
    await thukhoPage.reload();
    await thukhoPage.getByRole('button', { name: 'Khôi phục bản nháp', exact: true }).click();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toHaveValue('2.75');
    await respectApiBudget(thukhoPage);
    // Model a genuinely missing browser session; the unmodified server must deny the actual POST.
    await thukhoPage.evaluate(() => localStorage.removeItem('ipc_v3_token'));
    const deniedResponse = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    const denied = await deniedResponse;
    expect(denied.status()).toBe(401);
    const commandId = denied.request().postDataJSON().commandId as string;
    expect(commandId).toMatch(/^[a-f0-9-]{36}$/i);
    await thukhoPage.waitForURL('**/login');
    expect(JSON.parse((await thukhoPage.evaluate((key) => localStorage.getItem(key), saved.key))!).quantities[selected.dailyLineId]).toBe('2.75');
    expect(issueSubmits).toBe(2);
    expect(dbVerifier.query(versionSql)).toEqual(beforeVersion);
    expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`)).toHaveLength(0);
    expect(dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${commandId}';`)).toHaveLength(0);
    for (const [id, stock] of opening) expect(dbVerifier.captureStockSnapshot(binaryId(id))).toEqual(stock);
    const credentials = readQualificationCredentials().thukho;
    await thukhoPage.getByLabel('Tên đăng nhập', { exact: true }).fill(credentials.username);
    await thukhoPage.getByLabel('Mật khẩu', { exact: true }).fill(credentials.password);
    await respectLoginBudget();
    const login = thukhoPage.waitForResponse((response) => response.url().toLowerCase().endsWith('/api/auth/login') && response.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Đăng nhập vào hệ thống', exact: true }).click();
    expect((await login).ok()).toBe(true);
    await thukhoPage.waitForURL((location) => !location.pathname.endsWith('/login'));
    await respectApiBudget(thukhoPage);
    await thukhoPage.goto(url);
    await thukhoPage.reload();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toBeVisible();
    await thukhoPage.getByRole('button', { name: 'Khôi phục bản nháp', exact: true }).click();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toHaveValue('2.75');
    expect(issueSubmits).toBe(2);
    expect(dbVerifier.query(versionSql)).toEqual(beforeVersion);
    expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`)).toHaveLength(0);
    expect(dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId IN ('${commandId}','${precommit!.commandId}');`)).toHaveLength(0);
    for (const [id, stock] of opening) expect(dbVerifier.captureStockSnapshot(binaryId(id))).toEqual(stock);
    const expectedQuantities = new Map(lines.map((line) => [line.dailyLineId, line.dailyLineId === selected.dailyLineId ? '2.75' : String(line.requiredQuantity)]));
    // Submit recovered values unchanged; no replacement entry after login.
    await thukhoPage.screenshot({ path: path.join(evidence, '16-session-original-draft-restored.png') });
    const submitted = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    const accepted = await submitted;
    expect(accepted.status()).toBe(201);
    const fresh = accepted.request().postDataJSON() as CreateMrxIssueRequest;
    const created: MrxIssueCreated = (await accepted.json()).data;
    expect(fresh.commandId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(fresh.commandId).not.toBe(commandId);
    expect(fresh.commandId).not.toBe(precommit!.commandId);
    expect(fresh.expectedVersion).toBe(Number(beforeVersion[0].version));
    expect(fresh.lines).toHaveLength(lines.length);
    for (const line of lines) {
      const sent = fresh.lines.find((item) => item.reconciliationBatchDailyLineId === line.dailyLineId);
      expect(sent?.issuedQty).toBe(Number(expectedQuantities.get(line.dailyLineId)!));
      expect(sent?.ingredientId).toBe(line.ingredientId);
      expect(sent?.unitId).toBe(line.canonicalUnitId);
    }
    const issuesSql = `SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(batchId)}');`;
    expect(dbVerifier.query(issuesSql)).toEqual([{ id: binaryId(created.issueId) }]);
    const receiptSql = `SELECT commandId, responseJson FROM lifecyclecommandreceipts WHERE commandId='${fresh.commandId}';`;
    const receipt = dbVerifier.query(receiptSql);
    expect(receipt).toHaveLength(1);
    expect(JSON.parse(receipt[0].responseJson).IssueId).toBe(created.issueId);
    expect(dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId IN ('${commandId}','${precommit!.commandId}');`)).toHaveLength(0);
    const afterVersion = dbVerifier.query(versionSql);
    expect(Number(afterVersion[0].version)).toBe(Number(beforeVersion[0].version) + 1);
    const persisted = dbVerifier.query(`SELECT HEX(reconciliationBatchDailyLineId) AS id, HEX(ingredientId) AS ingredientId, HEX(unitId) AS unitId, CAST(issuedQty AS CHAR) AS quantity FROM inventoryissuelines WHERE issueId=UNHEX('${binaryId(created.issueId)}') ORDER BY id;`);
    expect(persisted.map((line) => ({ ...line, quantity: micros(line.quantity) }))).toEqual(lines.map((line) => ({
      id: binaryId(line.dailyLineId), ingredientId: binaryId(line.ingredientId), unitId: binaryId(line.canonicalUnitId), quantity: micros(expectedQuantities.get(line.dailyLineId)!),
    })).sort((a, b) => a.id.localeCompare(b.id)));
    const closing = new Map<string, StockSnapshot>();
    for (const line of lines) {
      const stock = opening.get(line.ingredientId)!;
      const after = dbVerifier.captureStockSnapshot(binaryId(line.ingredientId));
      expect(after).toEqual(stock);
      closing.set(line.ingredientId, after);
    }
    await expect(thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
    await respectApiBudget(thukhoPage);
    await thukhoPage.reload();
    await expect(thukhoPage.getByLabel(`Số lượng thực xuất ${selected.ingredientName}`, { exact: true })).toBeDisabled();
    await expect(thukhoPage.getByRole('button', { name: /^Lịch sử phiếu \(\s*1\s*\)$/ })).toBeVisible();
    expect(issueSubmits).toBe(3);
    expect(dbVerifier.query(issuesSql)).toEqual([{ id: binaryId(created.issueId) }]);
    expect(dbVerifier.query(receiptSql)).toEqual(receipt);
    expect(dbVerifier.query(versionSql)).toEqual(afterVersion);
    for (const [id, stock] of closing) expect(dbVerifier.captureStockSnapshot(binaryId(id))).toEqual(stock);
    fs.writeFileSync(path.join(evidence, 'session-recovery-result.json'), JSON.stringify({ batchId, deniedStatus: 401, precommitCommandId: precommit!.commandId, deniedCommandId: commandId, freshCommandId: fresh.commandId, issueId: created.issueId, noIssueOnDenial: true, noReceiptOnDenial: true, unchangedStocksOnDenial: true, draftRestoredBefore401: true, draftPurgedOn401: false, restoredAfter401: true, recoveredQuantity: '2.75', crossUserDraftNotOffered: true, staleVersionDraftNotOffered: true, reauthenticatedSameActor: true, issueCount: 1, verifiedIngredientCount: closing.size, unchangedAfterReload: true }, null, 2));
  });

  test.describe('Coordinated member lifecycle', () => {
  test.setTimeout(420_000);
  test('@G5-Coordinated two actual customers share ingredients; stale last member rolls back all effects, then committed group response loss replays exactly', async ({ dieuphoiPage, adminPage, managerPage, thukhoPage, beptruongPage, dbVerifier }) => {
    let batchIds: string[] = [];
    let weekStartDate = '';
    const resumePath = process.env.MRX_COORDINATED_TAIL_RECEIPT;
    if (resumePath) {
      const campaign = process.env.MRX_EVIDENCE_RUN_ID!;
      const root = path.resolve('.artifacts/mrx-evidence', campaign);
      expect(fs.realpathSync(resumePath).startsWith(fs.realpathSync(root) + path.sep)).toBe(true);
      const receipt = JSON.parse(fs.readFileSync(resumePath, 'utf8')) as { campaignId: string; database: string; weekStartDate: string; batchIds: string[]; preparationGroupId: string };
      expect(receipt.campaignId).toBe(campaign);
      expect(receipt.database).toBe(`ipc_mrx_evidence_${campaign}`);
      expect(receipt.weekStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(receipt.preparationGroupId).toMatch(/^[a-f0-9-]{36}$/i);
      expect(receipt.batchIds).toHaveLength(2);
      expect(new Set(receipt.batchIds).size).toBe(2);
      for (const id of receipt.batchIds) {
        expect(id).toMatch(/^[a-f0-9-]{36}$/i);
        expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(id)}') AND preparationGroupId=UNHEX('${binaryId(receipt.preparationGroupId)}');`)).toHaveLength(1);
      }
      batchIds = receipt.batchIds;
      weekStartDate = receipt.weekStartDate;
      console.log(`[BUSINESS RESUME] Same retained coordinated members ${batchIds.join(',')}; no import, new batch, competing write or replay repeated.`);
    } else {
    const scope = scenarioScope(dbVerifier, 12);
    weekStartDate = scope.weekStartDate;
    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
    const secondCustomer = await dieuphoiPage.evaluate(async () => {
      const response = await fetch('/api/coordination/customers', { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
      if (!response.ok) throw new Error(`Customer read ${response.status}`);
      return (await response.json()).data.find((row: { customerCode: string }) => row.customerCode === 'DAV') as { customerId: string; customerCode: string; customerName: string } | undefined;
    });
    expect(secondCustomer, 'An actual second customer is required; never substitute another week of ANV.').toBeTruthy();
    const second = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, { ...scope, reason: `${scope.reason} second customer`, customer: { customerId: secondCustomer!.customerId, label: `${secondCustomer!.customerCode} - ${secondCustomer!.customerName}` } });
    batchIds = [batchId, second.batchId];
    await thukhoPage.bringToFront();
    const preparationResponse = thukhoPage.waitForResponse((r) => r.url().includes('/api/reconciliation/preparation?') && r.request().method() === 'GET');
    await thukhoPage.goto(`/warehouse?view=mrx-preparation&date=${scope.weekStartDate}`);
    const prepared = (await (await preparationResponse).json()).data as MrxPreparation;
    await expect(thukhoPage.getByRole('button', { name: 'Xuất Excel chuẩn bị', exact: true })).toBeEnabled();
    await expect(thukhoPage.getByRole('button', { name: /^Xác nhận xuất phối hợp/ })).toHaveCount(0);
    const preparedMembers = prepared.batches.filter((b) => batchIds.includes(b.batchId));
    expect(preparedMembers).toHaveLength(2);
    await captureStationUI(thukhoPage, 'preparation', 1280, 720, thukhoPage.getByRole('button', { name: 'Xuất Excel chuẩn bị', exact: true }));
    const workbookDownload = thukhoPage.waitForEvent('download');
    await thukhoPage.getByRole('button', { name: 'Xuất Excel chuẩn bị', exact: true }).click();
    const preparationFile = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'coordinated-preparation.xlsx');
    await (await workbookDownload).saveAs(preparationFile);
    const workbookRows = parseCookingFile(preparationFile, 'xlsx');
    expect(workbookRows[2]).toEqual(['Khách hàng', 'Ngày phục vụ', 'Ca', 'Thực đơn', 'Mã món', 'Tên món', 'Số suất']);
    const materialsAt = workbookRows.findIndex(row => row[0] === 'NGUYÊN LIỆU THEO NHÀ CUNG CẤP');
    expect(materialsAt).toBeGreaterThan(3);
    const menus = workbookRows.slice(3, materialsAt);
    const scopedBatches = batchIds.map(id => `UNHEX('${binaryId(id)}')`).join(',');
    const expectedMenus = dbVerifier.query<{ customer: string; date: string; shift: string; variant: string; code: string; name: string; servings: string }>(`SELECT DISTINCT c.customerName AS customer, DATE_FORMAT(d.ServiceDate,'%d/%m/%Y') AS date, rc.FrozenShiftName AS shift, rc.FrozenMenuVariant AS variant, rc.FrozenDishCode AS code, rc.FrozenDishName AS name, CAST(rc.FrozenServings AS CHAR) AS servings FROM reconciliationbatchcontributors rc JOIN reconciliationbatchdailylines d ON d.DailyLineId=rc.DailyLineId JOIN reconciliationbatches b ON b.BatchId=d.BatchId JOIN menuversions v ON v.menuVersionId=b.MenuVersionId JOIN customers c ON c.customerId=v.customerId WHERE d.BatchId IN (${scopedBatches}) AND d.ServiceDate BETWEEN '${scope.weekStartDate}' AND DATE_ADD('${scope.weekStartDate}', INTERVAL 6 DAY) AND d.RequiredQuantity>0 AND rc.InvalidatedAt IS NULL;`);
    expect(menus.map(row => row.join('|')).sort()).toEqual(expectedMenus.map(row => [row.customer, row.date,
      row.shift === 'MORNING' ? 'Sáng' : row.shift === 'AFTERNOON' ? 'Chiều' : row.shift,
      row.variant === 'savory' ? 'Mặn' : row.variant === 'vegetarian' ? 'Chay' : row.variant, row.code, row.name, row.servings].join('|')).sort());
    const materialHeaders = workbookRows.slice(materialsAt + 1).find(row => row[0] === 'Mã nguyên liệu')!;
    for (const member of preparedMembers) expect(materialHeaders).toContain(member.customerName);
    const materialQuantities = new Map<string, bigint>();
    let supplier = '';
    for (const row of workbookRows.slice(materialsAt + 1)) {
      if (row.length === 1 && row[0].startsWith('Nhà cung cấp: ')) { supplier = row[0]; continue; }
      if (row[0] === 'Mã nguyên liệu') continue;
      expect(supplier).toMatch(/^Nhà cung cấp: .+/);
      expect(micros(row[row.length - 1])).toBe(row.slice(3, -1).reduce((sum, quantity) => sum + micros(quantity), 0n));
      materialHeaders.slice(3, -1).forEach((customer, index) => {
        const key = `${customer}|${row[0]}|${row[2]}`;
        materialQuantities.set(key, (materialQuantities.get(key) ?? 0n) + micros(row[index + 3]));
      });
    }
    const expectedQuantities = dbVerifier.query<{ customer: string; code: string; unit: string; quantity: string }>(`SELECT c.customerName AS customer, i.ingredientCode AS code, u.unitName AS unit, CAST(SUM(d.RequiredQuantity) AS CHAR) AS quantity FROM reconciliationbatchdailylines d JOIN ingredients i ON i.ingredientId=d.IngredientId JOIN units u ON u.unitId=d.CanonicalUnitId JOIN reconciliationbatches b ON b.BatchId=d.BatchId JOIN menuversions v ON v.menuVersionId=b.MenuVersionId JOIN customers c ON c.customerId=v.customerId WHERE d.BatchId IN (${scopedBatches}) AND d.ServiceDate BETWEEN '${scope.weekStartDate}' AND DATE_ADD('${scope.weekStartDate}', INTERVAL 6 DAY) AND d.RequiredQuantity>0 GROUP BY c.customerName, i.ingredientCode, u.unitName;`);
    expect([...materialQuantities].filter(([, quantity]) => quantity > 0n).map(([key, quantity]) => `${key}|${quantity}`).sort())
      .toEqual(expectedQuantities.map(row => `${row.customer}|${row.code}|${row.unit}|${micros(row.quantity)}`).sort());
    // Retained-client compatibility only: preparation UI is export-only. Commands use a separately read exact day, never weekly allocations.
    const readCommandDay = () => thukhoPage.evaluate(async ({ date, ids }) => {
      const query = new URLSearchParams({ serviceDate: date });
      ids.forEach(id => query.append('batchIds', id));
      const response = await fetch(`/api/reconciliation/preparation?${query}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
      if (!response.ok) throw new Error(`Retained day read ${response.status}`);
      return (await response.json()).data as MrxPreparation;
    }, { date: scope.weekStartDate, ids: batchIds });
    const commandFor = (day: MrxPreparation): CreateCoordinatedPreparationIssueRequest => ({
      serviceDate: scope.weekStartDate, commandId: crypto.randomUUID(),
      batches: day.batches.map(batch => ({ reconciliationBatchId: batch.batchId, expectedVersion: batch.batchVersion,
        lines: day.aggregatedLines.flatMap(line => line.allocations.filter(allocation => allocation.batchId === batch.batchId && allocation.requiredQuantity > 0)
          .map(allocation => ({ ingredientId: line.ingredientId, unitId: line.canonicalUnitId, reconciliationBatchDailyLineId: allocation.dailyLineId, reconciliationBatchLineId: allocation.batchLineId, requestedQty: allocation.requiredQuantity, issuedQty: allocation.requiredQuantity }))) })),
    });
    const submitRetainedCommand = (body: CreateCoordinatedPreparationIssueRequest) => thukhoPage.evaluate(async command => {
      try {
        const response = await fetch('/api/reconciliation/preparation/issue', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'Content-Type': 'application/json', 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, body: JSON.stringify(command) });
        return { status: response.status, body: await response.json(), transportError: false };
      } catch { return { status: null, body: null, transportError: true }; }
    }, body);
    const originalCommandDay = await readCommandDay();
    const staleMember = originalCommandDay.batches[originalCommandDay.batches.length-1];
    await managerPage.goto(`/weekly-menu?view=mrx-batch&customerId=${staleMember.customerId}&weekStartDate=${scope.weekStartDate}`);
    const shortDate = scope.weekStartDate.slice(5).split('-').reverse().join('/');
    const servings = managerPage.getByRole('spinbutton', { name: `Số suất Mặn ${shortDate} MORNING`, exact: true });
    await servings.fill(String(Number(await servings.inputValue())+1));
    await managerPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
    await managerPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} advance last group member`);
    await managerPage.getByRole('button', { name: 'Xem ảnh hưởng', exact: true }).click();
    await managerPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
    const changed = managerPage.waitForResponse((r) => r.url().endsWith('/mrx-apply') && r.request().method() === 'POST');
    await managerPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
    expect((await changed).status()).toBe(200);
    await expect(managerPage.getByText('Đã áp dụng thay đổi nguồn.', { exact: true })).toBeVisible();
    const ids = batchIds.map((id)=>`UNHEX('${binaryId(id)}')`).join(',');
    const rejectedBaseline = () => ({
      durableTables: dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,stockmovements,currentstock,currentstocklots,lifecyclecommandreceipts,auditlogs,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors,reconciliationdailydispositions,reconciliationsourcerevisions;'),
      members: dbVerifier.query(`SELECT HEX(BatchId) AS batch, Version, Status FROM reconciliationbatches WHERE BatchId IN (${ids}) ORDER BY batch;`),
      children: dbVerifier.query(`SELECT HEX(issueId) AS id, HEX(preparationGroupId) AS groupId FROM inventoryissues WHERE reconciliationBatchId IN (${ids}) ORDER BY id;`),
      stocks: prepared.aggregatedLines.map((line)=>dbVerifier.captureStockSnapshot(binaryId(line.ingredientId))),
    });
    const afterCompetingWrite = rejectedBaseline();
    const staleCommand = commandFor(originalCommandDay);
    const conflict = await submitRetainedCommand(staleCommand);
    expect(conflict.transportError).toBe(false);
    expect(conflict.status, JSON.stringify(conflict.body)).toBe(409);
    expect(staleCommand.batches[staleCommand.batches.length-1].reconciliationBatchId).toBe(staleMember.batchId);
    expect(staleCommand.batches[staleCommand.batches.length-1].expectedVersion).toBe(staleMember.batchVersion);
    const actualVersion = dbVerifier.query<{version:string}>(`SELECT Version AS version FROM reconciliationbatches WHERE BatchId=UNHEX('${binaryId(staleMember.batchId)}');`)[0].version;
    expect(Number(actualVersion)).toBeGreaterThan(staleMember.batchVersion);
    expect(conflict.body.message).toMatch(/phiên bản|thay đổi|cập nhật/i);
    expect(rejectedBaseline()).toEqual(afterCompetingWrite);
    await thukhoPage.reload();
    await expect(thukhoPage.getByRole('button', { name: 'Xuất Excel chuẩn bị', exact: true })).toBeEnabled();
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'coordinated-stale-member-rollback.json'), JSON.stringify({batchIds, staleLastMember:staleMember.batchId,preparedVersion:staleMember.batchVersion,actualVersion,status:409,baselineAfterCompetingWrite:true,noDurableEffects:true,members:afterCompetingWrite.members},null,2));
    let command: CreateCoordinatedPreparationIssueRequest | undefined;
    let committed: CoordinatedPreparationIssueResult | undefined;
    const before = new Map<string, StockSnapshot>();
    const pattern = '**/api/reconciliation/preparation/issue';
    await thukhoPage.route(pattern, async (route) => {
      command = route.request().postDataJSON();
      for (const batch of command!.batches) for (const line of batch.lines) {
        const id = binaryId(line.ingredientId);
        if (!before.has(id)) before.set(id, dbVerifier.captureStockSnapshot(id));
      }
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed = (await response.json()).data;
      await route.abort('connectionreset');
    });
    try {
      const responseLost = await submitRetainedCommand(commandFor(await readCommandDay()));
      expect(responseLost.transportError).toBe(true);
      await expect(thukhoPage.getByRole('button', { name: /^Xác nhận xuất phối hợp/ })).toHaveCount(0);
    } finally { await thukhoPage.unroute(pattern); }
    expect(command).toBeTruthy(); expect(committed).toBeTruthy();
    expect(command!.batches.map((batch) => batch.reconciliationBatchId).sort()).toEqual([...batchIds].sort());
    expect(committed!.issues).toHaveLength(2);
    for (const batch of command!.batches) {
      const frozen = dbVerifier.query<{ daily: string; qty: string }>(`SELECT HEX(DailyLineId) AS daily, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${binaryId(batch.reconciliationBatchId)}') AND ServiceDate='${scope.weekStartDate}' AND RequiredQuantity>0 ORDER BY daily;`);
      expect(batch.lines.map((line) => ({ daily: binaryId(line.reconciliationBatchDailyLineId), qty: line.issuedQty.toFixed(6) })).sort((a,b) => a.daily.localeCompare(b.daily))).toEqual(frozen);
    }
    const shared = command!.batches[0].lines.filter((line) => command!.batches[1].lines.some((other) => other.ingredientId === line.ingredientId));
    expect(shared.length).toBeGreaterThan(0);
    const after = new Map<string, StockSnapshot>();
    for (const id of before.keys()) {
      const opening = before.get(id)!;
      const current = dbVerifier.captureStockSnapshot(id);
      expect(current).toEqual(opening);
      after.set(id, current);
    }
    const receipt = () => dbVerifier.query(`SELECT ResponseJson AS receipt FROM lifecyclecommandreceipts WHERE CommandId='${command!.commandId}' AND AggregateType='CoordinatedPreparationIssue';`);
    const originalReceipt = receipt(); expect(originalReceipt).toHaveLength(1);
    const versions = () => dbVerifier.query(`SELECT HEX(BatchId) AS batch, Version AS version FROM reconciliationbatches WHERE BatchId IN (${batchIds.map((id) => `UNHEX('${binaryId(id)}')`).join(',')}) ORDER BY batch;`);
    const committedVersions = versions();
    const replay = await thukhoPage.evaluate(async (body) => {
      const response = await fetch('/api/reconciliation/preparation/issue', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'Content-Type': 'application/json', 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, command!);
    expect(replay.status).toBe(200);
    expect(replay.body.data.preparationGroupId).toBe(committed!.preparationGroupId);
    expect(replay.body.data.issues).toEqual(committed!.issues);
    expect(replay.body.data.idempotentReplay).toBe(true);
    expect(receipt()).toEqual(originalReceipt); expect(versions()).toEqual(committedVersions);
    for (const [id, snapshot] of after) expect(dbVerifier.captureStockSnapshot(id)).toEqual(snapshot);
    for (const child of committed!.issues) {
      expect(dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${binaryId(child.reconciliationBatchId)}');`)).toEqual([{ id: binaryId(child.issueId) }]);
      const lines = dbVerifier.query<{ daily: string; qty: string }>(`SELECT HEX(reconciliationBatchDailyLineId) AS daily, CAST(issuedQty AS CHAR) AS qty FROM inventoryissuelines WHERE issueId=UNHEX('${binaryId(child.issueId)}') ORDER BY daily;`);
      const frozen = dbVerifier.query<{ daily: string; qty: string }>(`SELECT HEX(DailyLineId) AS daily, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${binaryId(child.reconciliationBatchId)}') AND ServiceDate='${scope.weekStartDate}' AND RequiredQuantity>0 ORDER BY daily;`);
      expect(lines).toEqual(frozen);
    }
    await thukhoPage.reload();
    await expect(thukhoPage.getByRole('button', { name: /^Xác nhận xuất phối hợp/ })).toHaveCount(0);
    await expect(thukhoPage.getByRole('button', { name: 'Xuất Excel chuẩn bị', exact: true })).toBeEnabled();
    for (const id of batchIds) {
      await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${id}&date=${scope.weekStartDate}`);
      await expect(thukhoPage.getByRole('button', { name: /^Lịch sử phiếu \(\s*1\s*\)$/ })).toBeVisible();
    }
    const identityEvidence = { batchIds, preparationGroupId: committed!.preparationGroupId, commitStatus: 200, replayStatus: replay.status, exactReplay: true, originalReceiptUnchanged: true, stocksAndVersionsUnchangedByReplay: true, verifiedIngredientCount: after.size, sharedIngredientCount: shared.length, staleLastMemberRollback: true };
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'coordinated-response-loss.json'), JSON.stringify(identityEvidence,null,2));
    }
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
    const terminals: object[] = [];
    const dateLabel = (date: string) => date.split('-').reverse().join('/');
    for (const id of batchIds) {
      const hex = binaryId(id);
      const identity = dbVerifier.query<{ label: string; week: string; customerId: string }>(`SELECT CONCAT(c.customerCode,' - ',c.customerName) AS label, CAST(v.weekStartDate AS CHAR) AS week, HEX(c.customerId) AS customerId FROM reconciliationbatches b JOIN menuversions v ON v.menuVersionId=b.MenuVersionId JOIN customers c ON c.customerId=v.customerId WHERE b.BatchId=UNHEX('${hex}');`)[0];
      expect(identity.week).toBe(weekStartDate);
      const readDaily = () => thukhoPage.evaluate(async (batch) => {
        const response = await fetch(`/api/reconciliation/batches/${batch}/warehouse-daily`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
        if (!response.ok) throw new Error(`Member daily read ${response.status}`);
        return (await response.json()).data as MrxWarehouseDaily;
      }, id);
      const daily = await readDaily();
      expect(daily.dates.find((day) => day.serviceDate === weekStartDate)!.remainingQuantity).toBe(0);
      const issuedDates: string[] = [];
      for (const day of daily.dates.filter((item) => item.isApplicable && item.remainingQuantity > 0)) {
        expect(day.serviceDate).not.toBe(weekStartDate);
        await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${id}&date=${day.serviceDate}`);
        await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
        const opening = new Map<string, StockSnapshot>();
        await thukhoPage.route('**/api/inventory-issues', async (route) => {
          if (route.request().method() === 'POST') for (const line of route.request().postDataJSON().lines) opening.set(binaryId(line.ingredientId), dbVerifier.captureStockSnapshot(binaryId(line.ingredientId)));
          await route.continue();
        });
        const issued = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
        try {
          await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
          const response = await issued;
          expect(response.status(), await response.text()).toBe(201);
          const command = response.request().postDataJSON() as CreateMrxIssueRequest;
          const expected = dbVerifier.query<{ daily: string; qty: string }>(`SELECT HEX(DailyLineId) AS daily, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${hex}') AND ServiceDate='${day.serviceDate}' AND RequiredQuantity>0 ORDER BY daily;`);
          expect(command.lines.map((line) => ({ daily: binaryId(line.reconciliationBatchDailyLineId!), qty: line.issuedQty.toFixed(6) })).sort((a,b) => a.daily.localeCompare(b.daily))).toEqual(expected);
          for (const line of command.lines) {
            const stock = opening.get(binaryId(line.ingredientId))!;
            expect(dbVerifier.captureStockSnapshot(binaryId(line.ingredientId))).toEqual(stock);
          }
        } finally { await thukhoPage.unroute('**/api/inventory-issues'); }
        await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
        issuedDates.push(day.serviceDate);
      }
      expect((await readDaily()).dates.filter((day) => day.isApplicable).every((day) => day.remainingQuantity === 0)).toBe(true);
      const codes = dbVerifier.query<{ code: string }>(`SELECT issueCode AS code FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${hex}') ORDER BY issueCode;`).map((row) => row.code);
      expect(codes).toHaveLength(daily.dates.filter((day) => day.isApplicable && day.requiredQuantity > 0).length);
      const beforeChef = dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements,inventoryissues,inventoryissuelines,reconciliationbatches,reconciliationbatchdailylines;');
      const cookingResponse = beptruongPage.waitForResponse((response) => response.url().endsWith(`/batches/${id}/kitchen-cooking`) && response.request().method() === 'GET');
      await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${id}`);
      const cooking = (await (await cookingResponse).json()).data as MrxKitchenCooking;
      expect(cooking.batchId).toBe(id);
      await expect(beptruongPage.getByRole('heading', { name: 'Phiếu nấu theo lô', exact: true })).toBeVisible();
      const exports: Record<string, string[][]> = {};
      const end = new Date(`${identity.week}T00:00:00Z`); end.setUTCDate(end.getUTCDate()+6);
      for (const format of ['csv','xlsx'] as const) {
        const downloaded = beptruongPage.waitForEvent('download');
        await beptruongPage.getByRole('button', { name: format === 'csv' ? 'Tải CSV cả lô' : 'Tải Excel cả lô', exact: true }).click();
        const file = path.join(evidence, `coordinated-menu-${id}.${format}`);
        await (await downloaded).saveAs(file);
        exports[format] = parseCookingFile(file, format);
        expect(exports[format]).toHaveLength(cooking.rows.length+1);
        expect(exports[format][0]).toHaveLength(14);
        const rows = exports[format].slice(1).map((row) => {
          expect(row.slice(11)).toEqual([identity.label, dateLabel(identity.week), dateLabel(end.toISOString().slice(0,10))]);
          return [row[0],row[1],row[2],row[3],row[4],Number(row[5]),row[6],row[7],Number(row[8]),row[9] === '' ? null : Number(row[9]),Number(row[10])];
        });
        const expected = cooking.rows.map((row) => [dateLabel(row.serviceDate),row.weekday,row.shiftName,row.menuVariant,row.dishName,row.servings,row.ingredientName,row.unitName,row.bomQuantityPerServing,row.wasteRatePercent ?? null,row.totalRequiredQuantity]);
        expect(rows.map((row) => JSON.stringify(row)).sort()).toEqual(expected.map((row) => JSON.stringify(row)).sort());
      }
      expect(exports.xlsx).toEqual(exports.csv);
      expect(dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements,inventoryissues,inventoryissuelines,reconciliationbatches,reconciliationbatchdailylines;')).toEqual(beforeChef);
      await managerPage.goto(`/reconciliation?batchId=${id}`);
      await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
      const completed = managerPage.waitForResponse((response) => response.url().endsWith(`/batches/${id}/complete`) && response.request().method() === 'POST');
      await managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
      expect((await completed).status()).toBe(200);
      await managerPage.reload();
      expect(dbVerifier.query(`SELECT Status FROM reconciliationbatches WHERE BatchId=UNHEX('${hex}');`)).toEqual([{ Status: 'COMPLETED' }]);
      await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
      await managerPage.goto(`/reconciliation?view=transactions&batchId=${id}`);
      const visible = new Set<string>();
      for (let page = 1; page <= 10; page++) {
        await expect(managerPage.getByRole('table')).toBeVisible();
        for (const code of await managerPage.getByRole('table').getByRole('button', { name: /^ISS-/ }).allTextContents()) visible.add(code.trim());
        const next = managerPage.getByRole('button', { name: 'Trang sau', exact: true });
        if (!(await next.isEnabled())) break;
        expect(page).toBeLessThan(10);
        const loaded = managerPage.waitForResponse((response) => response.url().includes('/transactions-history?'));
        await next.click(); expect((await loaded).status()).toBe(200);
        await managerPage.waitForLoadState('networkidle');
      }
      expect([...visible].sort()).toEqual([...codes].sort());
      const historyDownload = managerPage.waitForEvent('download');
      await managerPage.getByRole('button', { name: 'Tải Excel Lịch sử kho', exact: true }).click();
      const history = path.join(evidence, `coordinated-history-${id}.xlsx`);
      await (await historyDownload).saveAs(history);
      expect([...new Set(parseCookingFile(history, 'xlsx').flat().join('\n').match(/ISS-[A-Z0-9-]+/g))].sort()).toEqual([...codes].sort());
      terminals.push({ batchId: id, customerId: identity.customerId, customer: identity.label, week: identity.week, coordinatedDate: weekStartDate, remainingDatesIssued: issuedDates, issueCodes: codes, chefRows: cooking.rows.length, chefFormats: ['csv','xlsx'], chefNoMutation: true, terminal: 'COMPLETED', historyIsolated: true });
      fs.writeFileSync(path.join(evidence,'coordinated-member-terminals.json'), JSON.stringify({ members: terminals, expectedMembers: batchIds, bothCompleted: terminals.length === batchIds.length },null,2));
      await managerPage.screenshot({ path: path.join(evidence, `coordinated-terminal-${id}.png`) });
      console.log(`[BUSINESS] ${identity.label}: remaining ${issuedDates.length} dates issued, Chef files parsed, Manager COMPLETED/reload, exact isolated history.`);
    }
    expect(terminals).toHaveLength(2);
    fs.writeFileSync(path.join(evidence, 'measurement-scope.json'), JSON.stringify({ batchId: batchIds[0], serviceDate: weekStartDate }, null, 2));
  });
  });
});
