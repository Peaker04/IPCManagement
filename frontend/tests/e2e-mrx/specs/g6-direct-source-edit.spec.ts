import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope, parseCookingFile } from '../fixtures/mrxWorkflow';
import type { MrxWarehouseDaily, CreateMrxIssueRequest, MrxKitchenCooking } from '../../../src/api/mrxApi';
import { assertServingInputs, materialTotals, writeMenuCoverage, type CoverageDish, type CoverageSource, type CoverageServings, type ServingInputFact } from '../fixtures/menuCoverage';
import type { MrxEditScope, MrxMenuChangeRequest, MrxMenuChangeResult } from '../../../src/api/mrxApi';
import { respectApiBudget } from '../fixtures/authHelpers';
import type { Page, Response, Route } from '@playwright/test';

function binaryId(value: string) {
  const [a,b,c,d,e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}
async function issue(page: Page) {
  await page.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
  const response = page.waitForResponse((item) => item.url().endsWith('/api/inventory-issues') && item.request().method() === 'POST');
  await page.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
  const accepted = await response;
  expect(accepted.status()).toBe(201);
  return accepted;
}

function toMicros(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  if (!/^\d+$/.test(whole) || !/^\d{0,6}$/.test(fraction)) throw new Error(`Invalid six-decimal quantity ${value}`);
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

test.setTimeout(300_000);
test.describe('ordered source commands', () => {
test.use({ actionTimeout: 15_000 });
for (const schedule of ['issue-first', 'apply-first'] as const) {
test(`@G6-Direct-Source-Edit ${schedule}: source correction preserves issued date and ordered public commands have one winner`, async ({ adminPage, managerPage, dieuphoiPage, thukhoPage, beptruongPage, dbVerifier }) => {
  const scope = scenarioScope(dbVerifier, schedule === 'issue-first' ? 8 : 9);
  const evidence = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, schedule);
  fs.mkdirSync(evidence, { recursive: true });
  const stocks = () => dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
  const originalStocks = stocks();
  const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  const batchHex = binaryId(batchId);
  const date = (offset: number) => { const day = new Date(`${scope.weekStartDate}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + offset); return day.toISOString().slice(0,10); };
  const short = (offset: number) => date(offset).slice(5).split('-').reverse().join('/');
  const savoryInput = (page: Page, offset: number) => page.getByRole('spinbutton', { name: `Số suất Mặn ${short(offset)} Sáng`, exact: true });
  const customerId = await dieuphoiPage.getByRole('combobox', { name: 'Chọn khách hàng MRX' }).inputValue();
  expect(dbVerifier.query(`SELECT HEX(v.CustomerId) AS customer FROM reconciliationbatches b JOIN menuversions v ON v.MenuVersionId=b.MenuVersionId WHERE b.BatchId=UNHEX('${batchHex}');`)).toEqual([{ customer: binaryId(customerId) }]);
  const sourceUrl = `/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}&customerId=${customerId}`;
  const sourceReads: unknown[] = [];
  managerPage.on('response', async (response) => {
    if (response.request().method() !== 'GET' || new URL(response.url()).pathname !== '/api/reconciliation/weekly-menu') return;
    try {
      const body = await response.json();
      sourceReads.push({ url: response.url(), status: response.status(), present: body.data != null, customer: body.data?.customerId, week: body.data?.weekStartDate, version: body.data?.menuVersionId });
    } catch (error) { sourceReads.push({ url: response.url(), error: String(error) }); }
    fs.writeFileSync(path.join(evidence, 'manager-source-reads.json'), JSON.stringify(sourceReads, null, 2));
  });
  const frozen = () => dbVerifier.query(`SELECT HEX(DailyLineId) AS id, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') AND ServiceDate='${date(0)}' ORDER BY id;`);
  const protectedState = () => dbVerifier.query('CHECKSUM TABLE menuversions,menus,menuschedules,menuitems,mealquantityplans,mealquantityplanlines,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors,reconciliationsourcerevisions,reconciliationsourcedeltas;');
  const sourceBeforeReview = protectedState();
  async function submitCorrection(servings: string, reason: string) {
    await respectApiBudget(dieuphoiPage);
    await dieuphoiPage.goto(sourceUrl);
    await savoryInput(dieuphoiPage, 1).fill(servings);
    await dieuphoiPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
    await expect(dieuphoiPage.getByRole('button', { name: 'Gửi duyệt', exact: true })).toBeDisabled();
    await dieuphoiPage.getByLabel('Lý do thay đổi nguồn').fill(reason);
    await dieuphoiPage.getByRole('button', { name: /^(?:Xem ảnh hưởng|Kiểm tra lại ảnh hưởng)$/ }).click();
    const sent = dieuphoiPage.waitForResponse((r) => r.url().endsWith('/amendments/mrx-submit') && r.request().method() === 'POST');
    await dieuphoiPage.getByRole('button', { name: 'Gửi duyệt', exact: true }).click();
    const response = await sent;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dieuphoiPage.getByText('Đã gửi yêu cầu thay đổi để duyệt.', { exact: true })).toBeVisible();
    return { result: (await response.json()).data, body: response.request().postDataJSON() };
  }
  async function openReview(page: Page, reason: string) {
    await page.goto(sourceUrl);
    await page.getByRole('button', { name: /Yêu cầu chờ duyệt/ }).click();
    const select = page.getByLabel('Yêu cầu nguồn cần duyệt');
    if (await select.isVisible()) {
      const id = await select.locator('option').filter({ hasText: reason }).getAttribute('value');
      expect(id).toBeTruthy();
      await select.selectOption(id!);
    }
    await expect(page.getByRole('region', { name: 'Duyệt thay đổi nguồn MRX' })).toContainText(reason);
  }
  const rejectedReason = `${scope.reason} reject first`;
  const submitted = await submitCorrection('1010', rejectedReason);
  expect(protectedState()).toEqual(sourceBeforeReview);
  for (const page of [dieuphoiPage, thukhoPage, beptruongPage]) {
    const status = await page.evaluate(async (body) => (await fetch('/api/coordination/weekly-menu/amendments/mrx-apply', {
      method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })).status, submitted.body);
    expect(status, 'Coordinator/Warehouse/Chef cannot directly apply source changes').toBe(403);
  }
  expect(protectedState()).toEqual(sourceBeforeReview);
  await openReview(adminPage, rejectedReason);
  await adminPage.getByRole('button', { name: 'Từ chối…', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Xác nhận từ chối', exact: true })).toBeDisabled();
  const rejection = `${scope.reason} servings need correction`;
  await adminPage.getByLabel('Lý do từ chối thay đổi nguồn').fill(rejection);
  const denied = adminPage.waitForResponse((r) => r.url().endsWith('/mrx-decision') && r.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).click();
  expect((await denied).status()).toBe(200);
  expect(protectedState()).toEqual(sourceBeforeReview);
  expect(dbVerifier.query(`SELECT status FROM menuamendments WHERE reason='${rejectedReason}';`)).toEqual([{ status: 'REJECTED' }]);
  expect(dbVerifier.query(`SELECT Reason AS reason FROM auditlogs WHERE EntityName='MenuAmendment' AND NewValue='REJECTED' AND Reason='${rejection}';`)).toEqual([{ reason: rejection }]);
  const resubmitReason = `${scope.reason} corrected resubmission`;
  await submitCorrection('1020', resubmitReason);
  await openReview(managerPage, resubmitReason);
  const approved = managerPage.waitForResponse((r) => r.url().endsWith('/mrx-decision') && r.request().method() === 'POST');
  await managerPage.getByRole('button', { name: 'Phê duyệt thay đổi', exact: true }).click();
  await managerPage.getByRole('button', { name: 'Xác nhận phê duyệt', exact: true }).click();
  expect((await approved).status()).toBe(200);
  const approvedSource = dbVerifier.query(`SELECT HEX(v.CustomerId) AS customer, HEX(b.MenuVersionId) AS source, b.Version AS version, COUNT(s.menuScheduleId) AS schedules FROM reconciliationbatches b JOIN menuversions v ON v.MenuVersionId=b.MenuVersionId JOIN menuschedules s ON s.MenuVersionId=b.MenuVersionId WHERE b.BatchId=UNHEX('${batchHex}') GROUP BY v.CustomerId,b.MenuVersionId,b.Version;`);
  expect(approvedSource).toHaveLength(1);
  fs.writeFileSync(path.join(evidence, 'manager-approved-source.json'), JSON.stringify({ sourceUrl, approvedSource, browserUrl: managerPage.url() }, null, 2));
  await managerPage.reload();
  await expect(savoryInput(managerPage, 1)).toHaveValue('1020');
  await respectApiBudget(managerPage);
  await savoryInput(managerPage, 1).fill('1021');
  await managerPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
  await managerPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} Manager direct apply`);
  await managerPage.getByRole('button', { name: /^(?:Xem ảnh hưởng|Kiểm tra lại ảnh hưởng)$/ }).click();
  await managerPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
  const appliedByManager = managerPage.waitForResponse((r) => r.url().endsWith('/mrx-apply') && r.request().method() === 'POST');
  await managerPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
  expect((await appliedByManager).status()).toBe(200);
  await managerPage.reload();
  await expect(savoryInput(managerPage, 1)).toHaveValue('1021');
  fs.writeFileSync(path.join(evidence, 'source-role-decisions.json'), JSON.stringify({ batchId, rejectedReason, rejection, resubmitReason, correctedServings: 1020, managerDirectServings: 1021, forbiddenApplyStatuses: [403,403,403], rejectedSourceUnchanged: true }, null, 2));

  await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${date(0)}`);
  await issue(thukhoPage);
  const originalFrozen = frozen();
  expect(originalFrozen.length).toBeGreaterThan(0);
  await adminPage.goto(sourceUrl);
  await expect(savoryInput(adminPage, 0)).toBeDisabled();
  const open = savoryInput(adminPage, 2);
  const changed = String(Number(await open.inputValue()) + 25);
  await open.fill(changed);
  await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
  await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} correction`);
  await adminPage.getByRole('button', { name: /^(?:Xem ảnh hưởng|Kiểm tra lại ảnh hưởng)$/ }).click();
  await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
  await adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
  await expect(adminPage.getByText('Đã áp dụng thay đổi nguồn.', { exact: true })).toBeVisible();
  expect(frozen()).toEqual(originalFrozen);
  await adminPage.reload();
  await expect(savoryInput(adminPage, 2)).toHaveValue(changed);
  await respectApiBudget(adminPage);
  await savoryInput(adminPage, 4).fill('1030');
  await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
  await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} race`);
  await adminPage.getByRole('button', { name: /^(?:Xem ảnh hưởng|Kiểm tra lại ảnh hưởng)$/ }).click();
  await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
  await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${date(4)}`);
  await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
  // The earlier warehouse client predates the Admin correction: prove its rejection, then use real recovery.
  const beforeRecovery = protectedState();
  const beforeRecoveryIssues = dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,lifecyclecommandreceipts;');
  const staleAttempt = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST', { timeout: 15_000 });
  await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
  const stale = await staleAttempt;
  expect(stale.status(), await stale.text()).toBe(409);
  expect(protectedState()).toEqual(beforeRecovery);
  expect(dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,lifecyclecommandreceipts;')).toEqual(beforeRecoveryIssues);
  const refreshedDaily = thukhoPage.waitForResponse((response) => response.url().endsWith(`/api/reconciliation/batches/${batchId}/warehouse-daily`) && response.request().method() === 'GET', { timeout: 15_000 });
  await thukhoPage.getByRole('button', { name: 'Tải lại dữ liệu mới nhất', exact: true }).click();
  const refreshed = await refreshedDaily;
  expect(refreshed.status()).toBe(200);
  fs.writeFileSync(path.join(evidence, 'warehouse-readiness.json'), JSON.stringify({ staleStatus: stale.status(), attemptedVersion: stale.request().postDataJSON().expectedVersion, refreshedVersion: (await refreshed.json()).data.sourceVersion, noSourceOrIssueOrReceiptWrites: true }, null, 2));
  await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
  await respectApiBudget(adminPage);
  await respectApiBudget(thukhoPage);
  const beforeRace = dbVerifier.query<{ version: string; menuVersion: string }>(`SELECT Version AS version, HEX(MenuVersionId) AS menuVersion FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex}');`);
  expect(beforeRace).toHaveLength(1);
  const held: Route[] = [];
  const observations: { kind: string; arrivedAt: number; releasedAt?: number }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const abortHeld = () => Promise.all(held.map((route) => route.abort('timedout').catch(() => {})));
  const barrier = async (route: Route) => {
    held.push(route);
    observations.push({ kind: route.request().url().endsWith('/mrx-apply') ? 'apply' : 'issue', arrivedAt: Date.now() });
    timer ??= setTimeout(() => { timedOut = true; void abortHeld(); }, 15_000);
  };
  const applyPattern = '**/api/coordination/weekly-menu/amendments/mrx-apply';
  const issuePattern = '**/api/inventory-issues';
  await adminPage.route(applyPattern, barrier);
  await thukhoPage.route(issuePattern, barrier);
  const applyResponse = adminPage.waitForResponse((item) => item.url().endsWith('/api/coordination/weekly-menu/amendments/mrx-apply') && item.request().method() === 'POST', { timeout: 15_000 });
  const issueResponse = thukhoPage.waitForResponse((item) => item.url().endsWith('/api/inventory-issues') && item.request().method() === 'POST', { timeout: 15_000 });
  const clicks = [adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click(), thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click()];
  const settled = Promise.allSettled([applyResponse, issueResponse, ...clicks]);
  try {
    await expect.poll(() => held.length, { timeout: 15_000 }).toBe(2);
    const applyRoute = held.find((route) => route.request().url().endsWith('/mrx-apply'))!;
    const issueRoute = held.find((route) => route.request().url().endsWith('/inventory-issues'))!;
    const applyBody = applyRoute.request().postDataJSON();
    const issueBody = issueRoute.request().postDataJSON() as CreateMrxIssueRequest;
    expect(applyBody.expectedBatchVersion).toBe(Number(beforeRace[0].version));
    expect(binaryId(applyBody.expectedBaseMenuVersionId)).toBe(beforeRace[0].menuVersion);
    expect(issueBody.expectedVersion).toBe(Number(beforeRace[0].version));
    expect(issueBody.isSupplemental).toBe(false);
    expect(issueBody.commandId).toMatch(/^[a-f0-9-]{36}$/i);
    const expectedLines = dbVerifier.query<{ daily: string; quantity: string }>(`SELECT HEX(DailyLineId) AS daily, CAST(RequiredQuantity AS CHAR) AS quantity FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') AND ServiceDate='${date(4)}' AND RequiredQuantity>0 ORDER BY daily;`);
    expect(expectedLines.length).toBeGreaterThan(0);
    expect(issueBody.lines.map((line) => ({ daily: binaryId(line.reconciliationBatchDailyLineId!), quantity: line.issuedQty.toFixed(6) })).sort((a,b) => a.daily.localeCompare(b.daily))).toEqual(expectedLines);
    expect(dbVerifier.query(`SELECT issueId FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${batchHex}') AND IssueDate='${date(4)}';`)).toHaveLength(0);
    const winnerKind = schedule === 'issue-first' ? 'issue' : 'apply';
    const winnerRoute = winnerKind === 'issue' ? issueRoute : applyRoute;
    const loserRoute = winnerKind === 'issue' ? applyRoute : issueRoute;
    observations.find((item) => item.kind === winnerKind)!.releasedAt = Date.now();
    await winnerRoute.continue();
    const winner = await (winnerKind === 'issue' ? issueResponse : applyResponse);
    expect(winner.status(), await winner.text()).toBe(winnerKind === 'issue' ? 201 : 200);
    const winnerObservedAt = Date.now();
    const batchAfterWinner = dbVerifier.query<{ version: string }>(`SELECT Version AS version FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex}');`);
    expect(Number(batchAfterWinner[0].version)).toBe(Number(beforeRace[0].version) + 1);
    const afterWinner = protectedState();
    const afterWinnerLedgers = dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,lifecyclecommandreceipts,menuamendments,menuamendmentlines;');
    observations.find((item) => item.kind !== winnerKind)!.releasedAt = Date.now();
    await loserRoute.continue();
    const [applied, issued] = await Promise.all([applyResponse, issueResponse]);
    const statuses = [applied.status(), issued.status()];
    expect(statuses).toEqual(schedule === 'issue-first' ? [409, 201] : [200, 409]);
    const losingResponse = schedule === 'issue-first' ? applied : issued;
    const conflict = await losingResponse.json();
    expect(conflict.success).toBe(false);
    expect(conflict.message.length).toBeGreaterThan(0);
    if (schedule === 'issue-first') expect(conflict.code).toBe('MRX_DAY_LOCKED');
    else expect(conflict.message).toContain('Danh sách xuất kho đã thay đổi');
    expect(protectedState()).toEqual(afterWinner);
    expect(dbVerifier.query('CHECKSUM TABLE inventoryissues,inventoryissuelines,lifecyclecommandreceipts,menuamendments,menuamendmentlines;')).toEqual(afterWinnerLedgers);
    expect(frozen()).toEqual(originalFrozen);
    expect(stocks()).toEqual(originalStocks);
    const revisions = dbVerifier.query(`SELECT HEX(SourceRevisionId) AS id FROM reconciliationsourcerevisions WHERE BatchId=UNHEX('${batchHex}') AND Reason='${scope.reason} race';`);
    expect(revisions.length).toBe(schedule === 'apply-first' ? 1 : 0);
    const issues = dbVerifier.query(`SELECT HEX(issueId) AS id FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${batchHex}') AND IssueDate='${date(4)}';`);
    expect(issues.length).toBe(schedule === 'issue-first' ? 1 : 0);
    const receipts = dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${issueBody.commandId}';`);
    expect(receipts).toHaveLength(schedule === 'issue-first' ? 1 : 0);
    expect(timedOut).toBe(false);
    fs.writeFileSync(path.join(evidence, 'source-issue-race.json'), JSON.stringify({ schedule, batchId, statuses, requestVersions: { apply: applyBody.expectedBatchVersion, issue: issueBody.expectedVersion, source: applyBody.expectedBaseMenuVersionId }, expectedDailyLines: expectedLines, issueLines: issueBody.lines, observations, winnerObservedAt, beforeRace, batchAfterWinner, conflictCode: conflict.code, conflictMessage: conflict.message, frozenDateUnchanged: true, noLoserWrites: true, physicalStockUnchanged: true, revisions, issues, receipts, limitation: 'Ordered HTTP dispatch with persisted winner observed before loser release; not simultaneous internal DB lock overlap.' }, null, 2));
  } finally {
    clearTimeout(timer);
    await abortHeld();
    await settled;
    await adminPage.unroute(applyPattern, barrier); await thukhoPage.unroute(issuePattern, barrier);
  }

  // Continue this same approved/rejected/raced source, not a fresh batch after the conflict.
  const predecessor = dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, HEX(l.issueId) AS issueId, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId WHERE i.reconciliationBatchId=UNHEX('${batchHex}') ORDER BY id;`);
  expect(predecessor.length).toBeGreaterThan(0);
  const readDaily = () => thukhoPage.evaluate(async (id) => {
    const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}` } });
    if (!response.ok) throw new Error(`Source-tail daily read ${response.status}`);
    return (await response.json()).data as MrxWarehouseDaily;
  }, batchId);
  const daily = await readDaily();
  expect(daily.dates.find((day) => day.serviceDate === date(0))!.remainingQuantity).toBe(0);
  const issuedDates: string[] = [];
  for (const day of daily.dates.filter((item) => item.isApplicable && item.remainingQuantity > 0)) {
    await respectApiBudget(thukhoPage);
    await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${day.serviceDate}`);
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    const opening = new Map(day.lines.filter((line) => line.requiredQuantity > 0).map((line) => [binaryId(line.ingredientId), dbVerifier.captureStockSnapshot(binaryId(line.ingredientId))]));
    const issued = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    const response = await issued;
    expect(response.status(), await response.text()).toBe(201);
    const command = response.request().postDataJSON() as CreateMrxIssueRequest;
    const expected = dbVerifier.query<{ daily: string; qty: string }>(`SELECT HEX(DailyLineId) AS daily, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') AND ServiceDate='${day.serviceDate}' AND RequiredQuantity>0 ORDER BY daily;`);
    expect(command.lines.map((line) => ({ daily: binaryId(line.reconciliationBatchDailyLineId!), qty: line.issuedQty.toFixed(6) })).sort((a,b) => a.daily.localeCompare(b.daily))).toEqual(expected);
    for (const line of command.lines) {
      const before = opening.get(binaryId(line.ingredientId))!;
      expect(dbVerifier.captureStockSnapshot(binaryId(line.ingredientId))).toEqual(before);
    }
    await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
    issuedDates.push(day.serviceDate);
  }
  expect((await readDaily()).dates.filter((day) => day.isApplicable).every((day) => day.remainingQuantity === 0)).toBe(true);
  expect(frozen()).toEqual(originalFrozen);
  const retained = dbVerifier.query(`SELECT HEX(l.issueLineId) AS id, HEX(l.issueId) AS issueId, CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId WHERE i.reconciliationBatchId=UNHEX('${batchHex}') ORDER BY id;`);
  for (const original of predecessor) expect(retained).toContainEqual(original);
  const codes = dbVerifier.query<{ code: string }>(`SELECT issueCode AS code FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${batchHex}') ORDER BY issueCode;`).map((row) => row.code);
  expect(codes).toHaveLength(daily.dates.filter((day) => day.isApplicable && day.requiredQuantity > 0).length);
  fs.writeFileSync(path.join(evidence, 'source-tail-progress.json'), JSON.stringify({ batchId, week: scope.weekStartDate, issuedDates, issueCodes: codes, frozenDateUnchanged: true, predecessorIssueLinesRetained: true, stage: 'WAREHOUSE_COMPLETE' }, null, 2));
  const beforeChef = dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements,inventoryissues,inventoryissuelines,reconciliationbatches,reconciliationbatchdailylines;');
  const cookingResponse = beptruongPage.waitForResponse((response) => response.url().endsWith(`/batches/${batchId}/kitchen-cooking`) && response.request().method() === 'GET');
  await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${batchId}`);
  const cooking = (await (await cookingResponse).json()).data as MrxKitchenCooking;
  expect(cooking.batchId).toBe(batchId);
  expect(cooking.rows.length).toBeGreaterThan(0);
  const identity = dbVerifier.query<{ label: string }>(`SELECT CONCAT(c.customerCode,' - ',c.customerName) AS label FROM reconciliationbatches b JOIN menuversions v ON v.menuVersionId=b.MenuVersionId JOIN customers c ON c.customerId=v.customerId WHERE b.BatchId=UNHEX('${batchHex}');`)[0];
  const outputs: Record<string, string[][]> = {};
  for (const format of ['csv', 'xlsx'] as const) {
    const download = beptruongPage.waitForEvent('download');
    await beptruongPage.getByRole('button', { name: format === 'csv' ? 'Tải CSV cả lô' : 'Tải Excel cả lô', exact: true }).click();
    const file = path.join(evidence, `source-tail-menu.${format}`);
    await (await download).saveAs(file);
    outputs[format] = parseCookingFile(file, format);
    expect(outputs[format]).toHaveLength(cooking.rows.length + 1);
    expect(outputs[format][0]).toHaveLength(14);
    for (const row of outputs[format].slice(1)) expect(row.slice(11)).toEqual([identity.label, date(0).split('-').reverse().join('/'), date(6).split('-').reverse().join('/')]);
  }
  expect(outputs.xlsx).toEqual(outputs.csv);
  expect(dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements,inventoryissues,inventoryissuelines,reconciliationbatches,reconciliationbatchdailylines;')).toEqual(beforeChef);
  await respectApiBudget(managerPage);
  await managerPage.goto(`/reconciliation?batchId=${batchId}`);
  await managerPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
  const completed = managerPage.waitForResponse((response) => response.url().endsWith(`/batches/${batchId}/complete`) && response.request().method() === 'POST');
  await managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
  expect((await completed).status()).toBe(200);
  await managerPage.reload();
  expect(dbVerifier.query(`SELECT Status FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex}');`)).toEqual([{ Status: 'COMPLETED' }]);
  await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
  const completedSource = protectedState();
  const completedStock = stocks();
  await adminPage.goto(sourceUrl);
  await adminPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Nhập Excel', exact: true })).toHaveCount(0);
  const completedImport = await adminPage.evaluate(async ({ bytes, customerId, weekStartDate }) => {
    const body = new FormData();
    body.append('file', new File([new Uint8Array(bytes)], 'completed-week.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    body.append('customerId', customerId);
    body.append('weekStartDate', weekStartDate);
    body.append('priceTierAmount', '25000');
    const response = await fetch('/api/coordination/weekly-menu/import/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      body,
    });
    return { status: response.status, body: await response.json() };
  }, { bytes: Array.from(fs.readFileSync(scope.workbook)), customerId, weekStartDate: scope.weekStartDate });
  expect(completedImport.status).toBe(409);
  expect(completedImport.body.code).toBe('MRX_REIMPORT_CLOSED');
  expect(protectedState()).toEqual(completedSource);
  expect(stocks()).toEqual(completedStock);
  await adminPage.screenshot({ path: path.join(evidence, 'menu-completed-edit-only.png') });
  fs.writeFileSync(path.join(evidence, 'menu-completed-reimport-blocked.json'), JSON.stringify({ batchId, week: scope.weekStartDate, status: completedImport.status, code: completedImport.body.code, sourceUnchanged: true, stockUnchanged: true }, null, 2));
  await managerPage.goto(`/reconciliation?view=transactions&batchId=${batchId}`);
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
  const history = path.join(evidence, 'source-tail-history.xlsx');
  await (await historyDownload).saveAs(history);
  expect([...new Set(parseCookingFile(history, 'xlsx').flat().join('\n').match(/ISS-[A-Z0-9-]+/g))].sort()).toEqual([...codes].sort());
  fs.writeFileSync(path.join(evidence, 'source-decision-weekly-terminal.json'), JSON.stringify({ batchId, week: scope.weekStartDate, customer: identity.label, issuedDates, issueCodes: codes, chefRows: cooking.rows.length, chefFormats: ['csv', 'xlsx'], chefNoMutation: true, frozenDateUnchanged: true, predecessorIssueLinesRetained: true, terminal: 'COMPLETED', historyIsolated: true }, null, 2));
  await managerPage.screenshot({ path: path.join(evidence, `source-decision-weekly-terminal-${schedule}.png`) });
  expect(stocks()).toEqual(originalStocks);
  console.log(`[BUSINESS] ${schedule}: source decisions and ordered public commands reached same-batch COMPLETED, ${codes.length} issues, Chef ${cooking.rows.length} rows/files, isolated history, unchanged physical stock.`);
});
}
});

for (const scenario of ['edits', 'reimports-and-groups', 'validation'] as const) {
test(`@G6-Menu-Coverage ${scenario}: four sections preserve source and independently checked terminal exports`, async ({ adminPage, managerPage, dieuphoiPage, thukhoPage, beptruongPage, dbVerifier }) => {
  test.setTimeout(600_000);
  const scope = scenarioScope(dbVerifier, scenario === 'edits' ? 12 : scenario === 'reimports-and-groups' ? 16 : 20);
  const evidence = scenario === 'edits' ? process.env.MRX_E2E_ARTIFACT_DIRECTORY! : path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, scenario);
  fs.mkdirSync(evidence, { recursive: true });
  const customer = dbVerifier.query<{ id: string }>("SELECT HEX(customerId) AS id FROM customers WHERE customerCode='ANV' AND isActive=1;");
  expect(customer).toHaveLength(1);
  const customerHex = customer[0].id;
  expect(customerHex).toMatch(/^[A-F0-9]{32}$/);
  const weekEnd = new Date(`${scope.weekStartDate}T00:00:00Z`); weekEnd.setUTCDate(weekEnd.getUTCDate() + 5);
  const end = weekEnd.toISOString().slice(0, 10);
  // Capture immutable master inputs before any source mutation; arithmetic below never reads demand as its answer.
  const rows = dbVerifier.query<{ fact: string }>(`SELECT JSON_OBJECT('id',HEX(d.dishId),'code',d.dishCode,'name',d.dishName,
    'variant',IF(LOWER(CONCAT(d.dishName,' ',COALESCE(d.dishGroup,''),' ',COALESCE(d.dishType,''))) LIKE '%chay%','vegetarian','savory'),
    'materials',(SELECT JSON_ARRAYAGG(JSON_OBJECT('ingredientCode',i.ingredientCode,'ingredientName',i.ingredientName,'ingredientId',HEX(i.ingredientId),'unitId',HEX(cu.unitId),'unitName',cu.unitName,'wasteRatePercent',b.wasteRatePercent,'canonicalUnitCode',cu.unitCode,
      'grossQtyPerServing',CAST(b.grossQtyPerServing AS CHAR),'sourceRate',CAST(u.convertRateToBase AS CHAR),'targetRate',CAST(cu.convertRateToBase AS CHAR)))
      FROM dishbom b JOIN ingredients i ON i.ingredientId=b.ingredientId JOIN units u ON u.unitId=b.unitId JOIN units cu ON cu.unitId=i.unitId
      WHERE b.dishId=d.dishId AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=25000
      AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${end}')
      AND u.baseUnitCode=cu.baseUnitCode AND u.convertRateToBase>0 AND cu.convertRateToBase>0
      AND (b.customerId=UNHEX('${customerHex}') OR (b.customerId IS NULL AND NOT EXISTS(
        SELECT 1 FROM dishbom preferred WHERE preferred.dishId=d.dishId AND preferred.customerId=UNHEX('${customerHex}')
        AND preferred.bomStatus='PUBLISHED' AND preferred.priceTierAmount=25000 AND preferred.effectiveFrom<='${scope.weekStartDate}'
        AND (preferred.effectiveTo IS NULL OR preferred.effectiveTo>='${end}')))))) AS fact
    FROM dishes d WHERE d.isActive=1 ORDER BY d.dishCode;`);
  type RecipeFact = Omit<CoverageDish, 'materials'> & { materials: (CoverageDish['materials'][number] & { ingredientName: string; ingredientId: string; unitId: string; unitName: string; wasteRatePercent: number })[] };
  const catalog = rows.map((r) => JSON.parse(r.fact) as RecipeFact & { id: string }).filter((d) => d.materials?.length);
  const stockableIngredients = new Set(dbVerifier.query<{ id: string }>(`SELECT HEX(s.ingredientId) AS id FROM currentstock s
    JOIN warehouses w ON w.warehouseId=s.warehouseId AND w.IsOperationalActive=1
    GROUP BY s.ingredientId HAVING COUNT(*)=1;`).map((row) => row.id));
  const stockableDishes = catalog.filter((dish) => dish.materials.every((material) => stockableIngredients.has(material.ingredientId.toUpperCase())));
  const dishes = (['savory', 'vegetarian'] as const).flatMap((variant) => stockableDishes.filter((d) => d.variant === variant).slice(0, 4));
  for (const variant of ['savory', 'vegetarian'] as const) {
    expect(dishes.filter((dish) => dish.variant === variant), `Clone needs four real ${variant} dishes whose BOM ingredients each have exactly one operational stock row`).toHaveLength(4);
  }
  const manifest = writeMenuCoverage(scope, dishes);
  scope.workbook = manifest.workbook;
  const expected = manifest.source.map((r) => ({ ...r }));
  const servings = manifest.servings.map((r) => ({ ...r }));
  const beforeImport = dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches;');
  const unaffectedInputs = () => dbVerifier.query(`SELECT HEX(l.quantityPlanLineId) AS id,HEX(l.menuScheduleId) AS schedule,
    l.savoryServings,l.vegetarianServings,l.finalServings FROM mealquantityplanlines l JOIN menuschedules s ON s.menuScheduleId=l.menuScheduleId
    WHERE NOT(s.customerId=UNHEX('${customerHex}') AND s.weekStartDate='${scope.weekStartDate}') ORDER BY id;`);
  const unaffectedBefore = unaffectedInputs();
  const previews: { response: Response; checksum: ReturnType<typeof dbVerifier.query> }[] = [];
  const imports: Response[] = [], submissions: Response[] = [], decisions: Response[] = [];
  const captureResponse = (response: Response) => {
    if (response.request().method() !== 'POST') return;
    const url = response.url();
    if (url.endsWith('/weekly-menu/import/preview')) previews.push({ response, checksum: dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches;') });
    if (url.includes('/weekly-menu/') && url.endsWith('/commit')) imports.push(response);
    if (url.endsWith('/amendments/mrx-submit')) submissions.push(response);
    if (url.endsWith('/mrx-decision')) decisions.push(response);
  };
  let currentVersionId = '', customerId = '';
  let importedPredecessor: ReturnType<typeof capturePredecessor> | undefined;
  const short = (date: string) => date.slice(5).split('-').reverse().join('/');
  const shiftLabel = (shift: string) => shift === 'MORNING' ? 'Sáng' : 'Chiều';
  const prefixName = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: · Đổi món cho nhóm · \\d+ dòng)?$`);
  const sourceUrl = `/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}`;
  const sourceFacts = (): CoverageSource[] => dbVerifier.query<CoverageSource>(`SELECT CAST(s.serviceDate AS CHAR) AS date,s.shiftName AS shift,
    IF(m.dishSlot LIKE 'vegetarian-%','vegetarian','savory') AS variant,SUBSTRING_INDEX(m.dishSlot,'-',-1) AS slot,d.dishCode AS dishCode
    FROM menuschedules s JOIN menuitems m ON m.menuId=s.menuId JOIN dishes d ON d.dishId=m.dishId
    WHERE s.customerId=UNHEX('${customerHex}') AND s.weekStartDate='${scope.weekStartDate}' AND s.menuVersionId=UNHEX('${binaryId(currentVersionId)}');`);
  const ordered = (facts: CoverageSource[]) => [...facts].sort((a, b) => `${a.date}/${a.shift}/${a.variant}/${a.slot}`.localeCompare(`${b.date}/${b.shift}/${b.variant}/${b.slot}`));
  const versionSnapshot = (id: string) => dbVerifier.query(`SELECT HEX(customerId) AS customer,CAST(weekStartDate AS CHAR) AS week,
    versionNo,normalizedSourceSnapshotJson FROM menuversions WHERE menuVersionId=UNHEX('${binaryId(id)}');`);
  const menuRows = (ids: string[]) => {
    expect(ids.every((id) => /^[A-F0-9]{32}$/.test(id))).toBe(true);
    return dbVerifier.query(`SELECT HEX(m.menuId) AS menu,m.menuCode,m.menuName,HEX(i.menuItemId) AS item,
      HEX(i.dishId) AS dish,i.dishSlot,i.displayOrder FROM menus m LEFT JOIN menuitems i ON i.menuId=m.menuId
      WHERE m.menuId IN (${ids.map((id) => `UNHEX('${id}')`).join(',')}) ORDER BY menu,item;`);
  };
  function capturePredecessor() {
    const version = versionSnapshot(currentVersionId);
    expect(version).toHaveLength(1);
    expect(() => JSON.parse(version[0].normalizedSourceSnapshotJson)).not.toThrow();
    const menuIds = dbVerifier.query<{ id: string }>(`SELECT HEX(menuId) AS id FROM menuschedules
      WHERE menuVersionId=UNHEX('${binaryId(currentVersionId)}') ORDER BY menuScheduleId;`).map((r) => r.id);
    expect(menuIds).toHaveLength(servings.length);
    return { versionId: currentVersionId, version, menuIds, menus: menuRows(menuIds) };
  }
  function assertPredecessor(before: ReturnType<typeof capturePredecessor>) {
    expect(versionSnapshot(before.versionId)).toEqual(before.version);
    expect(menuRows(before.menuIds)).toEqual(before.menus);
  }
  function acceptVersion(result: MrxMenuChangeResult) {
    expect(result.appliedMenuVersionId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(result.appliedMenuVersionId).not.toBe(currentVersionId);
    const previous = versionSnapshot(currentVersionId);
    expect(previous).toHaveLength(1);
    const next = versionSnapshot(result.appliedMenuVersionId!);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ customer: customerHex, week: scope.weekStartDate });
    expect(Number(next[0].versionNo)).toBe(Number(previous[0].versionNo) + 1);
    expect(dbVerifier.query(`SELECT sourceImportBatch FROM menuversions WHERE menuVersionId=UNHEX('${binaryId(result.appliedMenuVersionId!)}');`))
      .toEqual([{ sourceImportBatch: `AMEND-${result.menuAmendmentId}` }]);
    currentVersionId = result.appliedMenuVersionId!;
  }
  function assertCommand(body: MrxMenuChangeRequest, changedServings: CoverageServings[], changes: { target: CoverageSource; code: string }[] = []) {
    expect(binaryId(body.customerId)).toBe(customerHex);
    expect(body.weekStartDate).toBe(scope.weekStartDate);
    expect(body.expectedBaseMenuVersionId).toBe(currentVersionId);
    expect(body.lines).toHaveLength(changes.length || changedServings.length);
    const seenSlots = new Set<string>(), seenServings = new Set<string>();
    for (const line of body.lines) {
      const key = `${line.serviceDate}/${line.shiftName}`, slotKey = `${key}/${line.dishSlot}`;
      expect(seenSlots.has(slotKey), `Duplicate request slot ${slotKey}`).toBe(false);
      seenSlots.add(slotKey);
      const target = expected.filter((r) => r.date === line.serviceDate && r.shift === line.shiftName && `${r.variant}-${r.slot}` === line.dishSlot);
      expect(target, `Unexpected request target ${slotKey}`).toHaveLength(1);
      const change = changes.find((c) => c.target.date === line.serviceDate && c.target.shift === line.shiftName && `${c.target.variant}-${c.target.slot}` === line.dishSlot);
      if (changes.length) expect(change, `Unexpected changed slot ${slotKey}`).toBeTruthy();
      const code = change?.code ?? target[0].dishCode;
      expect(binaryId(line.newDishId!)).toBe(catalog.find((d) => d.code === code)!.id);
      expect(line.newServings).toBeUndefined();
      if (line.newSavoryServings != null || line.newVegetarianServings != null) {
        const authored = changedServings.filter((r) => r.date === line.serviceDate && r.shift === line.shiftName);
        expect(authored, `Unexpected serving edit ${key}`).toHaveLength(1);
        expect(seenServings.has(key), `Duplicate request serving pair ${key}`).toBe(false);
        seenServings.add(key);
        expect(line.newSavoryServings).toBe(authored[0].savory);
        expect(line.newVegetarianServings).toBe(authored[0].vegetarian);
      }
    }
    expect(seenServings.size).toBe(changedServings.length);
  }
  const rawInputs = () => dbVerifier.query<{ fact: string }>(`SELECT JSON_OBJECT('date',CAST(s.serviceDate AS CHAR),'shift',s.shiftName,
    'scheduleId',HEX(s.menuScheduleId),'quantityPlanLineId',HEX(l.quantityPlanLineId),
    'savory',l.savoryServings,'vegetarian',l.vegetarianServings,'final',l.finalServings,
    'identityMatches',IF(l.customerId=s.customerId AND l.menuId=s.menuId AND l.shiftName=s.shiftName AND p.serviceDate=s.serviceDate,1,0)) AS fact
    FROM menuschedules s LEFT JOIN mealquantityplanlines l ON l.menuScheduleId=s.menuScheduleId
    LEFT JOIN mealquantityplans p ON p.quantityPlanId=l.quantityPlanId
    WHERE s.customerId=UNHEX('${customerHex}') AND s.weekStartDate='${scope.weekStartDate}' AND s.menuVersionId=UNHEX('${binaryId(currentVersionId)}')
    ORDER BY s.serviceDate,s.shiftName,s.menuScheduleId,l.quantityPlanLineId;`)
    .map((r) => JSON.parse(r.fact) as ServingInputFact & { identityMatches: number });
  const readScope = async (page: Page) => page.evaluate(async ({ id, week }) => {
    const response = await fetch(`/api/reconciliation/weekly-menu/edit-scope?customerId=${id}&weekStartDate=${week}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
    });
    if (!response.ok) throw new Error(`Coverage input scope ${response.status}`);
    return (await response.json()).data as MrxEditScope;
  }, { id: customerId, week: scope.weekStartDate });
  const inputCheckpoints: object[] = [];
  let originalIdentities: object[] | undefined;
  async function checkInputs(page: Page, checkpoint: string, command?: { body: MrxMenuChangeRequest; amendmentId: string }) {
    const actual = rawInputs();
    assertServingInputs(servings, actual);
    expect(actual.every((r) => r.identityMatches === 1)).toBe(true);
    const identities = actual.map(({ date, shift, scheduleId, quantityPlanLineId }) => ({ date, shift, scheduleId, quantityPlanLineId }));
    originalIdentities ??= identities;
    expect(identities).toEqual(originalIdentities);
    const dto = await readScope(page);
    expect(dto.menuVersionId).toBe(currentVersionId);
    await expect(page.getByLabel('Chọn khách hàng MRX', { exact: true })).toHaveValue(customerId);
    expect(new URL(page.url()).searchParams.get('weekStartDate')).toBe(scope.weekStartDate);
    const cells = dto.days.flatMap((day) => day.shifts.map((shift) => ({ date: day.serviceDate, shift: shift.shiftName, savory: shift.savoryServings, vegetarian: shift.vegetarianServings })));
    const sortCells = <T extends { date: string; shift: string }>(items: T[]) => [...items].sort((a, b) => `${a.date}/${a.shift}`.localeCompare(`${b.date}/${b.shift}`));
    expect(sortCells(cells)).toEqual(sortCells(servings));
    await expect(page.getByRole('spinbutton', { name: /Số suất/ })).toHaveCount(servings.length * 2);
    for (const row of servings) for (const [variant, label] of [['savory', 'Mặn'], ['vegetarian', 'Chay']] as const) {
      await expect(page.getByRole('spinbutton', { name: `Số suất ${label} ${short(row.date)} ${shiftLabel(row.shift)}`, exact: true })).toHaveValue(String(row[variant]));
    }
    expect(rawInputs(), 'HTTP/DOM readback must not create or change serving rows').toEqual(actual);
    expect(unaffectedInputs(), 'Other customer/week input changed').toEqual(unaffectedBefore);
    inputCheckpoints.push({ checkpoint, menuVersionId: currentVersionId, command, expected: structuredClone(servings), actual, dto: cells });
    fs.writeFileSync(path.join(evidence, 'menu-coverage-input-checkpoints.json'), JSON.stringify(inputCheckpoints, null, 2));
  }
  dieuphoiPage.on('response', captureResponse);
  adminPage.on('response', captureResponse);
  let batchId: string;
  try {
    ({ batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, recordSteps: true,
      sourceScenario: async (page) => {
        console.log(`[MENU-COVERAGE ${scenario}] import committed; checking frozen source and ${servings.length} serving cells`);
        expect(previews).toHaveLength(1);
        expect(previews[0].response.ok()).toBe(true);
        expect(previews[0].checksum).toEqual(beforeImport);
        expect(imports).toHaveLength(1);
        expect(imports[0].ok()).toBe(true);
        currentVersionId = (await imports[0].json()).data.menuVersionId;
        expect(currentVersionId).toMatch(/^[a-f0-9-]{36}$/i);
        importedPredecessor = capturePredecessor();
        expect(importedPredecessor.version[0]).toMatchObject({ customer: customerHex, week: scope.weekStartDate });
        expect(ordered(sourceFacts())).toEqual(ordered(expected));
        console.log(`[MENU-COVERAGE ${scenario}] source facts match; checking empty serving cells`);
        for (const input of await page.getByRole('spinbutton', { name: /Số suất/ }).all()) await expect(input).toHaveValue('');
        console.log(`[MENU-COVERAGE ${scenario}] empty cells verified; filling servings`);
        for (const row of servings) for (const [variant, label] of [['savory', 'Mặn'], ['vegetarian', 'Chay']] as const) {
          await page.getByRole('spinbutton', { name: `Số suất ${label} ${short(row.date)} ${shiftLabel(row.shift)}`, exact: true }).fill(String(row[variant]));
        }
        console.log(`[MENU-COVERAGE ${scenario}] all servings filled`);
      },
      sourceAccepted: async (page) => {
        expect(submissions).toHaveLength(1);
        expect(decisions).toHaveLength(1);
        const body = submissions[0].request().postDataJSON() as MrxMenuChangeRequest;
        assertCommand(body, servings);
        customerId = body.customerId;
        const submitted = (await submissions[0].json()).data as MrxMenuChangeResult;
        const accepted = (await decisions[0].json()).data as MrxMenuChangeResult;
        expect(accepted.menuAmendmentId).toBe(submitted.menuAmendmentId);
        acceptVersion(accepted);
        expect(importedPredecessor).toBeDefined();
        assertPredecessor(importedPredecessor!);
        await checkInputs(page, 'accepted-source-before-quantity-preview', { body, amendmentId: accepted.menuAmendmentId });
        expect(ordered(sourceFacts())).toEqual(ordered(expected));
      },
    }, scope));
  } finally {
    dieuphoiPage.off('response', captureResponse);
    adminPage.off('response', captureResponse);
  }
  const batchHex = binaryId(batchId);
  await checkInputs(dieuphoiPage, 'transferred-source');
  const assertMaterials = () => {
    assertServingInputs(servings, rawInputs());
    expect(ordered(sourceFacts())).toEqual(ordered(expected));
    const wanted = materialTotals(expected, dishes, servings);
    const persisted = dbVerifier.query(`SELECT CAST(d.ServiceDate AS CHAR) AS date,i.ingredientCode AS ingredientCode,u.unitCode AS canonicalUnitCode,
      CAST(d.RequiredQuantity AS CHAR) AS quantity FROM reconciliationbatchdailylines d JOIN ingredients i ON i.ingredientId=d.IngredientId
      JOIN units u ON u.unitId=d.CanonicalUnitId WHERE d.BatchId=UNHEX('${batchHex}') AND d.RequiredQuantity>0 ORDER BY d.ServiceDate,i.ingredientCode,u.unitCode;`);
    expect(persisted).toEqual(wanted);
    fs.writeFileSync(path.join(evidence, 'menu-coverage-latest-readback.json'), JSON.stringify({ batchId, expected, servings, wanted, persisted }, null, 2));
  };
  assertMaterials();
  const editScope = () => readScope(adminPage);
  const snapshots: object[] = [];
  async function apply(label: string, changes: { target: CoverageSource; code: string }[], servingChange?: { date: string; shift: 'MORNING' | 'AFTERNOON'; variant: 'savory' | 'vegetarian'; value: number }, wholeGroup = false) {
    await respectApiBudget(adminPage, 32);
    await expect(adminPage.getByLabel('Chọn khách hàng MRX', { exact: true })).not.toHaveValue('');
    const prior = await editScope();
    expect(prior.menuVersionId).toBe(currentVersionId);
    const previousSnapshot = capturePredecessor();
    const declaredServings = servingChange ? [{ ...servings.find((s) => s.date === servingChange.date && s.shift === servingChange.shift)!, [servingChange.variant]: servingChange.value }] : [];
    if (changes.length) {
      await adminPage.getByRole('button', { name: 'Chỉnh sửa món', exact: true }).click();
      for (const { target, code } of wholeGroup ? changes.slice(0, 1) : changes) {
        const slot = prior.days.find((d) => d.serviceDate === target.date)!.shifts.find((s) => s.shiftName === target.shift)!.slots.find((s) => s.dishSlot === `${target.variant}-${target.slot}`)!;
        const expand = adminPage.getByRole('button', { name: new RegExp(`Tách để sửa riêng .* ${short(target.date)} ${shiftLabel(target.shift)}$`) });
        for (let count = 0; !wholeGroup && await expand.count(); count++) {
          expect(count).toBeLessThan(10);
          await expand.first().click();
        }
        const candidates = await adminPage.getByRole('combobox', { name: prefixName(`${slot.slotLabel} ${short(target.date)} ${shiftLabel(target.shift)}`) }).all();
        const matching = [];
        for (const candidate of candidates) if (await candidate.inputValue() === slot.dishName) matching.push(candidate);
        expect(matching, 'Picker identity must match the exact source variant/dish, not first ambiguous accessible name').toHaveLength(1);
        const input = matching[0];
        const dish = dishes.find((d) => d.code === code)!;
        await input.fill(dish.name);
        await adminPage.getByRole('listbox').getByRole('option').filter({ has: adminPage.getByText(dish.code, { exact: true }) }).click();
      }
    }
    if (servingChange) await adminPage.getByRole('spinbutton', { name: `Số suất ${servingChange.variant === 'savory' ? 'Mặn' : 'Chay'} ${short(servingChange.date)} ${shiftLabel(servingChange.shift)}`, exact: true }).fill(String(servingChange.value));
    await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
    await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} ${label}`);
    console.log(`[MENU-COVERAGE ${scenario}] ${label}: checking impact preview opened by continue action`);
    await expect(adminPage.getByRole('heading', { name: 'Xem trước ảnh hưởng' })).toBeVisible();
    await expect(adminPage.getByText(/Nguồn thay đổi: \d+ ngày/)).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Kiểm tra lại ảnh hưởng', exact: true })).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true })).toBeEnabled();
    console.log(`[MENU-COVERAGE ${scenario}] ${label}: impact ready; opening confirmation`);
    await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
    await expect(adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true })).toBeVisible();
    console.log(`[MENU-COVERAGE ${scenario}] ${label}: confirmation visible; sending apply`);
    const applied = adminPage.waitForResponse((r) => r.url().endsWith('/mrx-apply') && r.request().method() === 'POST', { timeout: 15_000 });
    await adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
    const response = await applied;
    console.log(`[MENU-COVERAGE ${scenario}] ${label}: apply HTTP ${response.status()}`);
    expect(response.status(), await response.text()).toBe(200);
    const body = response.request().postDataJSON() as MrxMenuChangeRequest;
    assertCommand(body, declaredServings, changes);
    expect(body.expectedBatchVersion).toBe(prior.batchVersion);
    const appliedResult = (await response.json()).data as MrxMenuChangeResult;
    acceptVersion(appliedResult);
    assertPredecessor(previousSnapshot);
    for (const change of changes) expected.find((r) => r.date === change.target.date && r.shift === change.target.shift && r.variant === change.target.variant && r.slot === change.target.slot)!.dishCode = change.code;
    if (servingChange) servings.find((s) => s.date === servingChange.date && s.shift === servingChange.shift)![servingChange.variant] = servingChange.value;
    await adminPage.reload();
    await checkInputs(adminPage, label, { body, amendmentId: appliedResult.menuAmendmentId });
    assertMaterials();
    snapshots.push({ label, body, menuVersionId: currentVersionId, expected: structuredClone(expected), servings: structuredClone(servings) });
    fs.writeFileSync(path.join(evidence, 'menu-coverage-revisions.json'), JSON.stringify(snapshots, null, 2));
  }
  await respectApiBudget(adminPage, 32);
  await adminPage.goto(sourceUrl);
  if (scenario === 'edits') {
  for (const shift of ['MORNING', 'AFTERNOON'] as const) for (const variant of ['savory', 'vegetarian'] as const) {
    const section = expected.filter((r) => r.shift === shift && r.variant === variant);
    const first = section.find((r) => r.date === scope.weekStartDate && r.slot === 'main')!;
    const otherDate = section.find((r) => r.date === manifest.servings[8].date && r.slot === 'main' && r.dishCode !== first.dishCode)
      ?? section.find((r) => r.date !== first.date && r.slot === 'main' && r.dishCode !== first.dishCode)!;
    await apply(`SWP-01 ${shift} ${variant}`, [{ target: { ...first }, code: otherDate.dishCode }, { target: { ...otherDate }, code: first.dishCode }]);
    const second = section.find((r) => r.date === first.date && r.slot !== first.slot && r.dishCode !== first.dishCode)!;
    expect(second, 'Vertical swap requires two distinct dishes on the same date').toBeTruthy();
    await apply(`SWP-02 ${shift} ${variant}`, [{ target: { ...first }, code: second.dishCode }, { target: { ...second }, code: first.dishCode }]);
    const nextDish = dishes.find((d) => d.variant === variant && d.code !== first.dishCode)!;
    await apply(`EDT-01 ${shift} ${variant}`, [{ target: { ...first }, code: nextDish.code }]);
    const count = servings.find((s) => s.date === first.date && s.shift === shift)![variant];
    await apply(`SRV-01 increase ${shift} ${variant}`, [], { date: first.date, shift, variant, value: count + 17 });
    await apply(`SRV-01 decrease ${shift} ${variant}`, [], { date: first.date, shift, variant, value: count - 3 });
  }
  } else if (scenario === 'reimports-and-groups') {
    async function reimport(label: string, workbook: string, wanted: CoverageSource[]) {
      await respectApiBudget(adminPage, 32);
      const prior = capturePredecessor();
      const beforePreview = dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors;');
      await adminPage.getByRole('button', { name: 'Nhập Excel', exact: true }).click();
      await expect(adminPage.getByRole('combobox', { name: 'Phạm vi nhập Excel' })).toHaveValue('current-week');
      await expect(adminPage.locator('select#import-customer-select')).toBeDisabled();
      await expect(adminPage.locator('select#import-customer-select')).toHaveValue(customerId);
      const dateInput = adminPage.getByLabel('Tuần bắt đầu nhập', { exact: true });
      await expect(dateInput).toHaveValue(scope.weekStartDate.split('-').reverse().join('/'));
      await expect(dateInput).toHaveAttribute('readonly');
      await adminPage.setInputFiles('input[type="file"]', workbook);
      await adminPage.locator('button[role="radio"]:has-text("25.000")').click();
      const preview = adminPage.waitForResponse((r) => r.url().endsWith('/weekly-menu/import/preview') && r.request().method() === 'POST');
      await adminPage.getByRole('button', { name: 'Xem trước', exact: true }).click();
      const previewResponse = await preview;
      expect(previewResponse.ok(), await previewResponse.text()).toBe(true);
      expect(dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors;')).toEqual(beforePreview);
      const committed = adminPage.waitForResponse((r) => r.url().includes('/weekly-menu/') && r.url().endsWith('/commit') && r.request().method() === 'POST');
      await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
      const response = await committed;
      expect(response.ok(), await response.text()).toBe(true);
      const result = (await response.json()).data;
      const changed = JSON.stringify(ordered(expected)) !== JSON.stringify(ordered(wanted));
      if (changed) acceptVersion(result.mrxSourceChange as MrxMenuChangeResult);
      else { expect(result.mrxSourceChange.status).toBe('UNCHANGED'); expect(result.menuVersionId).toBe(currentVersionId); }
      assertPredecessor(prior);
      expected.splice(0, expected.length, ...wanted.map((row) => ({ ...row })));
      await adminPage.reload();
      await checkInputs(adminPage, label);
      assertMaterials();
      snapshots.push({ label, menuVersionId: currentVersionId, expected: structuredClone(expected), servings: structuredClone(servings) });
      fs.writeFileSync(path.join(evidence, 'menu-coverage-revisions.json'), JSON.stringify(snapshots, null, 2));
    }
    await reimport('RIM-01 identical', manifest.workbook, manifest.source);
    const replacement = dishes.filter((d) => d.variant === 'savory').at(-1)!.code;
    const changed = manifest.source.map((row) => ({ ...row, dishCode: row.shift === 'MORNING' && row.variant === 'savory' && row.slot === 'main' && row.date <= manifest.servings[2].date ? replacement : row.dishCode }));
    await reimport('RIM-02 changed horizontal members', manifest.changedWorkbook, changed);
    await reimport('RIM-02 restore authored original', manifest.workbook, manifest.source);
    const rectangularDates = [manifest.servings[6].date, manifest.servings[8].date];
    const anchor = manifest.source.find((r) => r.date === rectangularDates[0] && r.shift === 'MORNING' && r.variant === 'savory' && r.slot === 'rau')!;
    const rectangular = manifest.source.map((row) => ({ ...row, dishCode: rectangularDates.includes(row.date) && row.shift === 'MORNING' && row.variant === 'savory' && ['rau', 'canh'].includes(row.slot) ? anchor.dishCode : row.dishCode }));
    await reimport('IMP-04 rectangular reimport', manifest.rectangularWorkbook, rectangular);
    for (const shift of ['MORNING', 'AFTERNOON'] as const) for (const variant of ['savory', 'vegetarian'] as const) {
      const verticalRows = ['main', 'sub1', 'rau', 'canh', 'dessert'].map((slot) => expected.find((r) => r.date === manifest.servings[4].date && r.shift === shift && r.variant === variant && r.slot === slot)!);
      const firstDifferent = verticalRows.findIndex((row) => row.dishCode !== verticalRows[0].dishCode);
      const vertical = verticalRows.slice(0, firstDifferent < 0 ? verticalRows.length : firstDifferent);
      expect(vertical.length, 'The edited vertical group must cover at least two adjacent slots').toBeGreaterThanOrEqual(2);
      const horizontal = expected.filter((r) => r.date <= manifest.servings[2].date && r.shift === shift && r.variant === variant && r.slot === 'main');
      expect(horizontal).toHaveLength(2);
      expect(new Set(horizontal.map((row) => row.dishCode)).size, 'Completion mode must have one horizontal dish group').toBe(1);
      const nextDish = dishes.filter((d) => d.variant === variant && d.code !== vertical[0].dishCode && d.code !== horizontal[0].dishCode).at(-1)!;
      await apply(`EDT-02 whole vertical ${shift} ${variant}`, vertical.map((target) => ({ target: { ...target }, code: nextDish.code })), undefined, true);
      const horizontalDish = dishes.filter((d) => d.variant === variant && d.code !== horizontal[0].dishCode && d.code !== vertical[0].dishCode).at(-1)!;
      await apply(`EDT-01 both horizontal members ${shift} ${variant}`, horizontal.map((target) => ({ target: { ...target }, code: horizontalDish.code })));
      const horizontalCode = horizontal[0].dishCode, verticalCode = vertical[0].dishCode;
      expect(horizontalCode).not.toBe(verticalCode);
      await apply(`SWP-03 all merged members ${shift} ${variant}`, [...vertical.map((target) => ({ target: { ...target }, code: horizontalCode })), ...horizontal.map((target) => ({ target: { ...target }, code: verticalCode }))]);
    }
  } else {
    async function rejectPreview(label: string, code: string) {
      const sql = 'CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors,reconciliationsourcerevisions,reconciliationsourcedeltas;';
      const before = dbVerifier.query(sql);
      await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
      await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} ${label}`);
      const pending = adminPage.waitForResponse((r) => r.url().endsWith('/amendments/preview') && r.request().method() === 'POST');
      await adminPage.getByRole('button', { name: 'Xem ảnh hưởng', exact: true }).click();
      const response = await pending;
      expect(response.status()).toBe(422); expect((await response.json()).code).toBe(code);
      await expect(adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true })).toBeDisabled();
      expect(dbVerifier.query(sql)).toEqual(before);
      fs.writeFileSync(path.join(evidence, `${label}-no-write.json`), JSON.stringify({ batchId, request: response.request().postDataJSON(), code, noWrite: true }, null, 2));
      await adminPage.reload(); await checkInputs(adminPage, label); assertMaterials();
    }
    await adminPage.getByRole('spinbutton', { name: `Số suất Mặn ${short(scope.weekStartDate)} Sáng`, exact: true }).fill('');
    await rejectPreview('SRV-02-missing', 'MRX_SERVINGS_SPLIT_REQUIRED');
    const original = servings[0].savory;
    await apply('SRV-02 explicit zero', [], { date: scope.weekStartDate, shift: 'MORNING', variant: 'savory', value: 0 });
    await apply('SRV-02 restore nonzero', [], { date: scope.weekStartDate, shift: 'MORNING', variant: 'savory', value: original });
    const missing = rows.map((row) => JSON.parse(row.fact) as RecipeFact & { id: string }).find((dish) => !dish.materials?.length);
    expect(missing, 'NEG-02 requires an existing active dish lacking the selected effective BOM; never provision one').toBeTruthy();
    const prior = await editScope();
    const slot = prior.days[0].shifts.find((shift) => shift.shiftName === 'MORNING')!.slots.find((cell) => cell.dishSlot === 'savory-main')!;
    await adminPage.getByRole('button', { name: 'Chỉnh sửa món', exact: true }).click();
    const candidates = await adminPage.getByRole('combobox', { name: `${slot.slotLabel} ${short(scope.weekStartDate)} Sáng`, exact: true }).all();
    const matching = [];
    for (const candidate of candidates) if (await candidate.inputValue() === slot.dishName) matching.push(candidate);
    expect(matching).toHaveLength(1);
    await matching[0].fill(missing!.name);
    await adminPage.getByRole('listbox').getByRole('option').filter({ has: adminPage.getByText(missing!.code, { exact: true }) }).click();
    await rejectPreview('NEG-02-missing-BOM', 'MRX_BOM_MISSING');
  }
  for (const day of [...new Set(expected.map((r) => r.date))]) {
    await respectApiBudget(thukhoPage);
    await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${day}`);
    const inputRows = dbVerifier.query<{ ingredientId: string; unitId: string; ingredientCode: string; canonicalUnitCode: string; date: string; quantity: string }>(`SELECT HEX(d.IngredientId) AS ingredientId,HEX(d.CanonicalUnitId) AS unitId,i.ingredientCode,u.unitCode AS canonicalUnitCode,CAST(d.ServiceDate AS CHAR) AS date,CAST(d.RequiredQuantity AS CHAR) AS quantity FROM reconciliationbatchdailylines d JOIN ingredients i ON i.ingredientId=d.IngredientId JOIN units u ON u.unitId=d.CanonicalUnitId WHERE d.BatchId=UNHEX('${batchHex}') AND d.ServiceDate='${day}' AND d.RequiredQuantity>0 ORDER BY i.ingredientCode,u.unitCode;`);
    const wantedDay = materialTotals(expected, dishes, servings).filter((row) => row.date === day);
    expect(inputRows.map(({ ingredientCode, canonicalUnitCode, date, quantity }) => ({ date, ingredientCode, canonicalUnitCode, quantity }))).toEqual(wantedDay);
    const opening = new Map(inputRows.map((row) => [row.ingredientId, dbVerifier.captureStockSnapshot(row.ingredientId)]));
    const response = await issue(thukhoPage);
    const created = (await response.json()).data;
    const request = response.request().postDataJSON() as CreateMrxIssueRequest;
    expect(request.lines).toHaveLength(wantedDay.length);
    const actualIssue = dbVerifier.query(`SELECT CAST(d.ServiceDate AS CHAR) AS date,i.ingredientCode,u.unitCode AS canonicalUnitCode,CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l JOIN inventoryissues issue ON issue.issueId=l.issueId JOIN reconciliationbatchdailylines d ON d.DailyLineId=l.reconciliationBatchDailyLineId JOIN ingredients i ON i.ingredientId=l.ingredientId JOIN units u ON u.unitId=l.unitId WHERE issue.issueId=UNHEX('${binaryId(created.issueId)}') AND issue.reconciliationBatchId=UNHEX('${batchHex}') ORDER BY i.ingredientCode,u.unitCode;`);
    expect(actualIssue).toEqual(wantedDay);
    const receipts = dbVerifier.query(`SELECT responseJson FROM lifecyclecommandreceipts WHERE commandId='${request.commandId}';`);
    expect(receipts).toHaveLength(1); expect(JSON.parse(receipts[0].responseJson).IssueId).toBe(created.issueId);
    for (const row of inputRows) {
      const before = opening.get(row.ingredientId)!;
      expect(dbVerifier.captureStockSnapshot(row.ingredientId)).toEqual(before);
    }
    if (scenario === 'reimports-and-groups' && day === scope.weekStartDate) {
      await respectApiBudget(adminPage);
      const prior = await editScope();
      const dates = [scope.weekStartDate, manifest.servings[2].date];
      expect(prior.days.find((d) => d.serviceDate === dates[0])!.isLocked).toBe(true);
      expect(prior.days.find((d) => d.serviceDate === dates[1])!.isLocked).toBe(false);
      const body: MrxMenuChangeRequest = { customerId, weekStartDate: scope.weekStartDate, expectedBaseMenuVersionId: currentVersionId,
        expectedBatchVersion: prior.batchVersion, reason: `${scope.reason} NEG-01 issued plus open dates must roll back together`,
        lines: dates.map((date) => {
          const shift = prior.days.find((d) => d.serviceDate === date)!.shifts.find((s) => s.shiftName === 'MORNING')!;
          return { serviceDate: date, shiftName: shift.shiftName, dishSlot: shift.slots[0].dishSlot, newDishId: shift.slots[0].dishId,
            newSavoryServings: servings.find((s) => s.date === date && s.shift === 'MORNING')!.savory + 1, newVegetarianServings: shift.vegetarianServings };
        }) };
      const protectedSql = 'CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors,reconciliationsourcerevisions,reconciliationsourcedeltas,inventoryissues,inventoryissuelines,lifecyclecommandreceipts,currentstock,currentstocklots,stockmovements;';
      const before = dbVerifier.query(protectedSql);
      const rejected = await adminPage.evaluate(async (request) => {
        const response = await fetch('/api/coordination/weekly-menu/amendments/mrx-apply', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'Content-Type': 'application/json', 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, body: JSON.stringify(request) });
        return { status: response.status, data: await response.json() };
      }, body);
      expect(rejected.status).toBe(409); expect(rejected.data.code).toBe('MRX_DAY_LOCKED');
      expect(dbVerifier.query(protectedSql)).toEqual(before);
      assertMaterials();
      fs.writeFileSync(path.join(evidence, 'mixed-day-atomic-rejection.json'), JSON.stringify({ batchId, body, rejected, unchanged: true }, null, 2));
    }
  }
  assertMaterials();
  await respectApiBudget(beptruongPage);
  const cookingResponse = beptruongPage.waitForResponse((r) => r.url().endsWith(`/batches/${batchId}/kitchen-cooking`));
  await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${batchId}`);
  const cooking = (await (await cookingResponse).json()).data as MrxKitchenCooking;
  expect(cooking.rows.length).toBeGreaterThan(0);
  const seenCooking = new Set<string>();
  const wantedCooking = expected.flatMap((cell) => {
    const key = `${cell.date}/${cell.shift}/${cell.variant}/${cell.dishCode}`;
    if (seenCooking.has(key)) return [];
    seenCooking.add(key);
    const dish = dishes.find((d) => d.code === cell.dishCode)!;
    const counts = servings.find((s) => s.date === cell.date && s.shift === cell.shift)!;
    return materialTotals([cell], [dish], [counts]).map((total) => {
      const materials = dish.materials.filter((m) => m.ingredientCode === total.ingredientCode && m.canonicalUnitCode === total.canonicalUnitCode);
      expect(materials, 'Independent Chef mapping needs an unambiguous captured recipe row').toHaveLength(1);
      const material = materials[0];
      const units: Record<string, string> = { KG: 'kg', G: 'g', L: 'lít', ML: 'ml' };
      return { serviceDate: cell.date, shiftName: cell.shift === 'MORNING' ? 'Ca sáng' : 'Ca chiều', menuVariant: cell.variant === 'savory' ? 'Mặn' : 'Chay',
        dishCode: dish.code, dishName: dish.name, servings: counts[cell.variant], ingredientCode: material.ingredientCode, ingredientName: material.ingredientName,
        unitName: units[material.canonicalUnitCode] ?? material.unitName.trim(), bom: Number(material.grossQtyPerServing).toFixed(6),
        waste: Number(material.wasteRatePercent).toFixed(6), total: total.quantity };
    });
  });
  const sortedRows = <T,>(values: T[]) => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  expect(sortedRows(cooking.rows.map((row) => ({ serviceDate: row.serviceDate, shiftName: row.shiftName, menuVariant: row.menuVariant,
    dishCode: row.dishCode, dishName: row.dishName, servings: row.servings, ingredientCode: row.ingredientCode, ingredientName: row.ingredientName,
    unitName: row.unitName, bom: row.bomQuantityPerServing?.toFixed(6), waste: row.wasteRatePercent?.toFixed(6), total: row.totalRequiredQuantity.toFixed(6) }))))
    .toEqual(sortedRows([...wantedCooking]));
  const fileRows = wantedCooking.map((row) => {
    const day = new Date(`${row.serviceDate}T00:00:00Z`), last = new Date(`${scope.weekStartDate}T00:00:00Z`); last.setUTCDate(last.getUTCDate() + 6);
    const formatted = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
    return [formatted(row.serviceDate), `Thứ ${day.getUTCDay() + 1}`, row.shiftName, row.menuVariant, row.dishName, String(row.servings), row.ingredientName,
      row.unitName, row.bom, row.waste, row.total, 'ANV - AMANN', formatted(scope.weekStartDate), formatted(last.toISOString())];
  });
  const exports: Record<string, string[][]> = {};
  for (const format of ['csv', 'xlsx'] as const) {
    const download = beptruongPage.waitForEvent('download');
    await beptruongPage.getByRole('button', { name: format === 'csv' ? 'Tải CSV cả lô' : 'Tải Excel cả lô', exact: true }).click();
    const file = path.join(evidence, `menu-coverage-chef.${format}`); await (await download).saveAs(file);
    exports[format] = parseCookingFile(file, format);
  }
  expect(exports.csv).toEqual(exports.xlsx);
  for (const format of ['csv', 'xlsx']) {
    expect(exports[format][0]).toEqual(['Ngày', 'Thứ', 'Ca', 'Thực đơn', 'Món', 'Số suất', 'Nguyên liệu', 'Đơn vị', 'Định lượng BOM / suất', 'Hao hụt (%)', 'Tổng lượng cần cho món', 'Khách hàng', 'Tuần bắt đầu', 'Tuần kết thúc']);
    const normalized = exports[format].slice(1).map((row) => row.map((value, index) => [8, 9, 10].includes(index) ? Number(value).toFixed(6) : value));
    expect(sortedRows(normalized), `Independent authored source→${format} numerical mapping`).toEqual(sortedRows([...fileRows]));
  }
  fs.writeFileSync(path.join(evidence, 'menu-coverage-chef-independent.json'), JSON.stringify({ batchId, expected: wantedCooking, actual: cooking.rows, csvRows: exports.csv.length - 1, xlsxRows: exports.xlsx.length - 1, independentNumericMatch: true }, null, 2));
  await respectApiBudget(managerPage);
  await managerPage.goto(`/reconciliation?batchId=${batchId}`);
  await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
  const completed = managerPage.waitForResponse((r) => r.url().endsWith(`/batches/${batchId}/complete`) && r.request().method() === 'POST');
  await managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
  expect((await completed).status()).toBe(200);
  await managerPage.reload();
  expect(dbVerifier.query(`SELECT Status FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex}');`)).toEqual([{ Status: 'COMPLETED' }]);
  await respectApiBudget(managerPage);
  const report = await managerPage.evaluate(async (id) => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' };
    const response = await fetch(`/api/reconciliation/reports/${id}`, { headers });
    const exported = await fetch(`/api/reconciliation/reports/${id}/export`, { headers });
    if (!response.ok || !exported.ok) throw new Error(`Report read/export ${response.status}/${exported.status}`);
    return { data: (await response.json()).data as import('../../../src/api/mrxApi').MrxBatch, csv: await exported.text() };
  }, batchId);
  const totals = new Map<string, { ingredientId: string; unitId: string; quantity: bigint }>();
  for (const row of materialTotals(expected, dishes, servings)) {
    const identities = dishes.flatMap((dish) => dish.materials).filter((m) => m.ingredientCode === row.ingredientCode && m.canonicalUnitCode === row.canonicalUnitCode);
    expect(new Set(identities.map((m) => `${m.ingredientId}/${m.unitId}`)).size).toBe(1);
    const existing = totals.get(row.ingredientCode);
    totals.set(row.ingredientCode, { ingredientId: identities[0].ingredientId, unitId: identities[0].unitId, quantity: (existing?.quantity ?? 0n) + toMicros(row.quantity) });
  }
  expect(report.data.status).toBe('COMPLETED'); expect(report.data.lines).toHaveLength(totals.size);
  const wantedReport = report.data.lines.map((line) => {
    const wanted = totals.get(line.ingredientCode!); expect(wanted).toBeDefined();
    expect(binaryId(line.ingredientId)).toBe(wanted!.ingredientId); expect(binaryId(line.canonicalUnitId)).toBe(wanted!.unitId);
    const quantity = `${wanted!.quantity / 1_000_000n}.${String(wanted!.quantity % 1_000_000n).padStart(6, '0')}`;
    expect(line.requiredQuantity.toFixed(6)).toBe(quantity); expect(line.issuedQuantity?.toFixed(6)).toBe(quantity);
    expect(line.issuedRequiredDifference).toBe(0); expect(line.purchasedQuantity).toBeNull();
    return [line.batchLineId, line.ingredientId, line.canonicalUnitId, quantity, '', quantity, '', '0.000000', ''];
  });
  const reportPath = path.join(evidence, 'menu-coverage-reconciliation.csv'); fs.writeFileSync(reportPath, report.csv);
  const reportRows = parseCookingFile(reportPath, 'csv');
  expect(reportRows[0].slice(0, 9)).toEqual(['batchLineId', 'ingredientId', 'canonicalUnitId', 'requiredQuantity', 'purchasedQuantity', 'issuedQuantity', 'purchasedRequiredDifference', 'issuedRequiredDifference', 'purchasedIssuedDifference']);
  const actualReport = reportRows.slice(1).map((row) => row.slice(0, 9).map((value, index) => index >= 3 && value !== '' ? Number(value).toFixed(6) : value));
  expect(sortedRows(actualReport)).toEqual(sortedRows(wantedReport));
  expect(sortedRows(report.data.dailyReview!.lines.filter((line) => line.requiredQuantity > 0).map((line) => ({ date: line.serviceDate!, ingredientCode: line.ingredientCode!, quantity: line.requiredQuantity.toFixed(6), issued: line.issuedQuantity?.toFixed(6), difference: line.issuedRequiredDifference }))))
    .toEqual(sortedRows(materialTotals(expected, dishes, servings).map((line) => ({ date: line.date, ingredientCode: line.ingredientCode, quantity: line.quantity, issued: line.quantity, difference: 0 }))));
  fs.writeFileSync(path.join(evidence, 'menu-coverage-reconciliation-independent.json'), JSON.stringify({ batchId, rows: totals.size, actual: report.data, csvRows: actualReport.length, independentNumericMatch: true }, null, 2));
  fs.writeFileSync(path.join(evidence, 'menu-coverage-terminal.json'), JSON.stringify({ batchId, week: scope.weekStartDate, manifestPath: manifest.manifestPath, workbook: manifest.workbookSha256, sourceTuples: expected.length, revisionCases: snapshots.length, terminal: 'COMPLETED',
    scenario, remainingCoverage: scenario === 'edits' ? ['See sibling reimports-and-groups result'] : [] }, null, 2));
});
}
