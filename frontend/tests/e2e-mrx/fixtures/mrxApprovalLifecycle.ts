import fs from 'node:fs';
import path from 'node:path';
import { type Page, type Response, type Route } from '@playwright/test';
import { expect } from '@playwright/test';
import type { MrxTestFixtures } from './mrxTest';
import { createTransferredBatch, parseCookingFile, type MrxScenarioScope } from './mrxWorkflow';
import { respectApiBudget } from './authHelpers';
import type { MrxKitchenCooking, MrxPreparation, MrxPreparationWorkbook, MrxVarianceRegisterReport, MrxSupplementalDemand, MrxSupplementalDishOptions, MrxSupplementalFulfillment, MrxWarehouseDaily } from '../../../src/api/mrxApi';

async function read<T>(page: Page, pathname: string): Promise<T> {
  await respectApiBudget(page);
  const result = await page.evaluate(async (url) => {
    const token = localStorage.getItem('ipc_v3_token');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status, body: await response.json() };
  }, pathname);
  expect(result.status, pathname).toBe(200);
  return result.body.data as T;
}

function post(page: Page, pathname: string): Promise<Response> {
  return page.waitForResponse(response =>
    new URL(response.url()).pathname === pathname && response.request().method() === 'POST');
}


function binaryId(value: string): string {
  expect(value).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  const [a,b,c,d,e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}
function frozenSnapshot(dbVerifier: MrxTestFixtures['dbVerifier'], batchId: string) {
  const batch = binaryId(batchId);
  return {
    daily: dbVerifier.query(`SELECT HEX(DailyLineId) id, HEX(BatchLineId) weekly, HEX(IngredientId) ingredient, HEX(CanonicalUnitId) unit, ServiceDate day, RequiredQuantity quantity FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batch}') ORDER BY DailyLineId;`),
    contributors: dbVerifier.query(`SELECT HEX(c.ContributorId) id, HEX(c.DailyLineId) daily, HEX(c.DishId) dish, c.FrozenDishCode code, c.FrozenShiftName shift, c.FrozenMenuVariant variant, c.FrozenServings servings, c.FrozenBomQuantityPerServing quantity, c.FrozenBomUnitToBaseRate bomRate, c.FrozenCanonicalUnitToBaseRate canonicalRate FROM reconciliationbatchcontributors c JOIN reconciliationbatchdailylines d ON d.DailyLineId=c.DailyLineId WHERE d.BatchId=UNHEX('${batch}') ORDER BY c.ContributorId;`),
  };
}
async function assertBatchQueue(page: Page, batchId: string, state: 'PENDING' | 'PROCESSED', ready: boolean) {
  const result = await read<{ items: Array<{ targetId: string; status: string }> }>(page,
    `/api/operational-approvals/inbox?targetType=mrx-batch-review&targetId=${batchId}&state=${state}`);
  if (!ready) expect(result.items).toEqual([]);
  else {
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ targetId: batchId, status: state === 'PENDING' ? 'COMPLETION_READY' : 'COMPLETED' });
  }
}
export async function runMultiRoleApprovalLifecycle(
  { dieuphoiPage, adminPage, thukhoPage, managerPage, beptruongPage, dbVerifier }: MrxTestFixtures,
  scope: MrxScenarioScope, evidenceDirectory: string, verifyPurposeShortage = false) {

    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope, true);
    await assertBatchQueue(adminPage, batchId, 'PENDING', false);
    const date = scope.weekStartDate;
    const warehouseUrl = `/warehouse?view=mrx-daily&batchId=${batchId}&date=${date}`;
    const demandPath = '/api/reconciliation/supplemental-demands';
    const issuePath = '/api/inventory-issues';
    const cookingPath = `/api/reconciliation/batches/${batchId}/kitchen-cooking`;
    const balancePath = `${demandPath}/batches/${batchId}/fulfillment?serviceDate=${date}`;
    const originalStock = dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
    const originalFrozen = frozenSnapshot(dbVerifier, batchId);

    await thukhoPage.goto(warehouseUrl);
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    const initial = post(thukhoPage, issuePath);
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    expect((await initial).ok()).toBe(true);

    const openSupplemental = async () => {
      await thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
      return thukhoPage.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
    };
    const proposal = await openSupplemental();
    await proposal.getByRole('button', { name: 'Đề nghị suất phát sinh', exact: true }).click();
    await proposal.getByRole('combobox', { name: 'Menu hoặc tùy chọn 1', exact: true }).selectOption('CUSTOM');
    const firstDish = proposal.getByRole('combobox', { name: 'Món, ca và loại suất 1', exact: true });
    const available = firstDish.locator('option:not([disabled]):not([value=""])');
    await expect(available.nth(2)).toBeAttached();
    const choices = await available.evaluateAll(options => options.slice(0, 3).map(option => (option as HTMLOptionElement).value));
    for (const [index, value] of choices.entries()) {
      if (index > 0) {
        await proposal.getByRole('button', { name: 'Thêm món hoặc ca' }).click();
        await proposal.getByRole('combobox', { name: `Menu hoặc tùy chọn ${index + 1}`, exact: true }).selectOption('CUSTOM');
      }
      await proposal.getByRole('combobox', { name: `Món, ca và loại suất ${index + 1}`, exact: true }).selectOption(value);
      await proposal.getByRole('spinbutton', { name: `Suất tăng thêm ${index + 1}`, exact: true }).fill(String(index + 2));
    }
    await proposal.getByLabel('Lý do tăng suất').fill(scope.reason);
    const saved = post(thukhoPage, demandPath);
    await proposal.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }).click();
    const savedResponse = await saved;
    expect(savedResponse.ok()).toBe(true);
    const draft = (await savedResponse.json()).data as MrxSupplementalDemand;
    expect(draft.dishes.map(row => row.extraServings).sort()).toEqual([2, 3, 4]);
    expect(draft.materials.length).toBeGreaterThan(0);
    const submitted = post(thukhoPage, `${demandPath}/${draft.demandId}/submit`);
    await proposal.getByRole('button', { name: 'Gửi duyệt nhu cầu' }).click();
    const submittedResponse = await submitted;
    expect(submittedResponse.ok()).toBe(true);
    const pending = (await submittedResponse.json()).data as MrxSupplementalDemand;
    expect(pending.status).toBe('PENDING');
    const priorViewport = thukhoPage.viewportSize();
    if (priorViewport) {
      for (const width of [600, 960, 1440]) {
        await thukhoPage.setViewportSize({ width, height: 840 });
        const status = proposal.getByText('Đã gửi duyệt nhu cầu', { exact: true });
        await expect(status).toBeInViewport();
        const bounds = await proposal.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        await thukhoPage.screenshot({ path: path.join(evidenceDirectory, `supplemental-request-${width}.png`) });
      }
      await thukhoPage.setViewportSize(priorViewport);
    }
    const quantitiesByLine = (demand: MrxSupplementalDemand) => Object.fromEntries(
      demand.materials.map(row => [row.dailyLineId, [row.ingredientId, row.canonicalUnitId, row.requiredQuantity]]));
    expect(quantitiesByLine(pending)).toEqual(quantitiesByLine(draft));
    expect((await read<MrxSupplementalFulfillment>(thukhoPage, balancePath)).pendingDemandCount).toBe(1);

    const decisionPath = `/api/operational-approvals/mrx-supplemental-demand/${draft.demandId}/decision`;
    await managerPage.goto(`/approvals?targetType=mrx-supplemental-demand&targetId=${draft.demandId}`);
    await expect(managerPage.getByRole('button', { name: 'Phê duyệt hồ sơ' })).toBeVisible();
    const forbidden = await thukhoPage.evaluate(async id => {
      const response = await fetch('/api/operational-approvals/mrx-supplemental-demand/' + id + '/decision', {
        method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('ipc_v3_token'),
          'X-Operational-Mode': 'MATERIAL_RECONCILIATION', 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId: crypto.randomUUID(), expectedModeVersion: Number(localStorage.getItem('ipc_v3_mode_version')),
          expectedFingerprint: 'forbidden-actor', decision: 'Approve', reason: 'Role boundary probe' }),
      });
      return response.status;
    }, draft.demandId);
    expect(forbidden).toBe(403);
    for (const [width, height] of [[1440, 900], [960, 720], [600, 480]]) {
      await managerPage.setViewportSize({ width, height });
      expect(await managerPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      if (width < 1024) {
        await expect(managerPage.getByRole('combobox', { name: 'Lọc loại yêu cầu phê duyệt' })).toBeHidden();
        const bodyHeight = await managerPage.getByRole('heading', { name: 'Suất phát sinh đề nghị' })
          .locator('..').locator('..').evaluate(node => node.clientHeight);
        expect(bodyHeight).toBeGreaterThanOrEqual(180);
      }
      const control = managerPage.getByRole('button', { name: 'Phê duyệt hồ sơ' });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 1 });
      await managerPage.screenshot({ path: path.join(evidenceDirectory, 'mrx-demand-review-' + width + '.png') });
    }
    await managerPage.setViewportSize({ width: 1440, height: 900 });
    await managerPage.getByRole('button', { name: 'Phê duyệt hồ sơ' }).click();
    const approval = managerPage.getByRole('dialog', { name: 'Xác nhận phê duyệt' });
    await approval.getByLabel('Căn cứ quyết định').fill(scope.reason);
    const decisionPattern = '**' + decisionPath;
    let committedDecisionBody: unknown;
    await managerPage.route(decisionPattern, async route => {
      committedDecisionBody = route.request().postDataJSON();
      const result = await route.fetch();
      expect(result.status()).toBe(200);
      await route.abort('connectionreset');
    });
    await approval.getByRole('button', { name: 'Xác nhận phê duyệt', exact: true }).click();
    await expect(approval.getByRole('button', { name: 'Kiểm tra kết quả', exact: true })).toBeVisible();
    await expect(approval.getByText('Failed to fetch', { exact: true })).toHaveCount(0);
    await expect(approval.getByRole('button', { name: 'Hủy bỏ', exact: true })).toBeDisabled();
    await managerPage.keyboard.press('Escape');
    await expect(approval).toBeVisible();
    await managerPage.screenshot({ path: path.join(evidenceDirectory, 'manager-decision-response-lost.png') });
    await managerPage.reload();
    await expect(approval).toBeVisible();
    await expect(approval.getByLabel('Căn cứ quyết định')).toBeDisabled();
    await expect(approval.getByRole('button', { name: 'Kiểm tra kết quả', exact: true })).toBeVisible();
    await managerPage.screenshot({ path: path.join(evidenceDirectory, 'manager-decision-after-reload.png') });
    await managerPage.unroute(decisionPattern);
    const decided = post(managerPage, decisionPath);
    await approval.getByRole('button', { name: 'Kiểm tra kết quả', exact: true }).click();
    const replayedDecision = await decided;
    expect(replayedDecision.ok()).toBe(true);
    expect(replayedDecision.request().postDataJSON()).toEqual(committedDecisionBody);
    const approved = await read<MrxSupplementalDemand>(thukhoPage, `${demandPath}/${draft.demandId}`);
    expect(approved.status).toBe('APPROVED');
    expect(approved.snapshotFingerprint).toBe(draft.snapshotFingerprint);
    expect(approved.materials).toEqual(pending.materials);
    await expect(proposal.getByRole('link', { name: 'Xem đề nghị tại Duyệt vận hành' })).toHaveCount(0);
    await proposal.getByRole('button', { name: 'Cập nhật trạng thái đề nghị', exact: true }).click();
    await expect(proposal.getByText('Nhu cầu đã được duyệt', { exact: true })).toBeVisible();

    const daily = await read<MrxWarehouseDaily>(thukhoPage, `/api/reconciliation/batches/${batchId}/warehouse-daily`);
    const day = daily.dates.find(item => item.serviceDate === date)!;
    const readRemaining = async () => {
      const result = await read<MrxSupplementalFulfillment>(thukhoPage, balancePath);
      expect(result.pendingDemandCount).toBe(0);
      return result.lines.flatMap(line => line.extraDemands.filter(extra => extra.demandId === approved.demandId)
        .map(extra => ({ ...extra, dailyLineId: line.dailyLineId })));
    };
    const beforeIssue = await readRemaining();
    expect(beforeIssue).toHaveLength(approved.materials.length);
    const partial = beforeIssue.find(row => (row.remainingQuantity ?? 0) >= 0.000002);
    expect(partial).toBeDefined();
    const issue = async (rows: Array<{ dailyLineId: string; quantity: number }>, purpose = approved.demandId) => {
      await thukhoPage.goto(warehouseUrl);
      const actual = await openSupplemental();
      await actual.getByRole('combobox', { name: 'Mục đích xuất bổ sung' }).selectOption(purpose);
      for (const row of rows) {
        const material = day.lines.find(line => line.dailyLineId === row.dailyLineId)!;
        if (purpose === 'UNPLANNED_EXTRA') {
          await actual.getByRole('combobox', { name: 'Chọn nguyên liệu xuất bổ sung', exact: true }).fill(material.ingredientName!);
          await actual.getByRole('option').filter({ has: thukhoPage.getByText(material.ingredientName!, { exact: true }) }).click({ timeout: 15_000 });
        }
        await actual.getByRole('spinbutton', { name: `Lượng xuất bổ sung ${material.ingredientName}`, exact: true }).fill(String(row.quantity));
      }
      await actual.getByLabel('Lý do xuất bổ sung').fill(scope.reason);
      const posted = post(thukhoPage, issuePath);
      await actual.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true }).click();
      expect((await posted).ok()).toBe(true);
      await expect(actual).toHaveCount(0);
    };
    const purposeLine = day.lines.find(line => line.dailyLineId === partial!.dailyLineId)!;
    const outside = partial!.remainingQuantity!;
    if (verifyPurposeShortage) {
      await issue([{ dailyLineId: purposeLine.dailyLineId, quantity: outside }], 'UNPLANNED_EXTRA');

      const warehouse = await read<MrxWarehouseDaily>(thukhoPage, `/api/reconciliation/batches/${batchId}/warehouse-daily`);
      const liveLine = warehouse.dates.find(item => item.serviceDate === date)!.lines.find(item => item.dailyLineId === purposeLine.dailyLineId);
      expect(liveLine).toMatchObject({ issuedQuantity: purposeLine.requiredQuantity, remainingQuantity: outside, quantityStatus: 'PURPOSE_SHORTAGE' });
      const query = new URLSearchParams({ serviceDate: date, batchIds: batchId });
      const preparation = await read<MrxPreparation>(thukhoPage, `/api/reconciliation/preparation?${query}`);
      const allocation = preparation.aggregatedLines.flatMap(item => item.allocations).find(item => item.dailyLineId === purposeLine.dailyLineId);
      expect(allocation).toMatchObject({ remainingQuantity: outside, unplannedIssuedQuantity: outside });

      const workbookQuery = new URLSearchParams(query);
      workbookQuery.set('includeMenus', 'true');
      const workbook = await read<MrxPreparationWorkbook>(thukhoPage, `/api/reconciliation/preparation/workbook-preview?${workbookQuery}`);
      const summary = workbook.summaryRows.find(item => item.ingredientId === purposeLine.ingredientId && item.canonicalUnitId === purposeLine.canonicalUnitId);
      expect(summary).toMatchObject({ remainingQuantity: outside, unplannedIssuedQuantity: outside });
      const token = await thukhoPage.evaluate(() => localStorage.getItem('ipc_v3_token'));
      const download = await thukhoPage.request.get(`/api/reconciliation/preparation/export-workbook?${workbookQuery}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      });
      expect(download.status()).toBe(200);
      const file = path.join(evidenceDirectory, 'purpose-shortage.xlsx');
      fs.writeFileSync(file, await download.body());
      const spreadsheet = parseCookingFile(file, 'xlsx', 1).find(row => row[0] === summary!.ingredientName || row[0] === `${summary!.ingredientName} (${summary!.ingredientCode})`);
      expect(spreadsheet?.slice(3).map(Number)).toEqual([outside, outside]);

      const report = await read<MrxVarianceRegisterReport>(managerPage, `/api/reconciliation/reports/variance-register?batchId=${batchId}`);
      expect(report.rows.find(row => row.ingredientCode === purposeLine.ingredientCode && row.serviceDate === date))
        .toMatchObject({ difference: 0, varianceType: 'PURPOSE_SHORTAGE', remainingByPurpose: outside, unplannedIssuedQuantity: outside });
      await assertBatchQueue(managerPage, batchId, 'PENDING', false);
      fs.writeFileSync(path.join(evidenceDirectory, 'purpose-shortage.json'), JSON.stringify({ batchId, date, liveLine, allocation, summary, spreadsheet }, null, 2));
    }
    await issue([{ dailyLineId: partial!.dailyLineId, quantity: 0.000001 }]);
    const remaining = await readRemaining();
    expect(remaining.find(row => row.demandMaterialId === partial!.demandMaterialId)?.issuedQuantity).toBe(0.000001);
    const exactRemainders = remaining.filter(row => (row.remainingQuantity ?? 0) > 0)
      .map(row => ({ dailyLineId: row.dailyLineId, quantity: row.remainingQuantity! }));
    await issue(exactRemainders);
    expect((await readRemaining()).every(row => row.remainingQuantity === 0)).toBe(true);

    await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${batchId}`);
    await expect(beptruongPage.getByRole('heading', { name: 'Phiếu nấu theo lô', exact: true })).toBeVisible();
    const cooking = await read<MrxKitchenCooking>(beptruongPage, cookingPath);
    // Kitchen DTO uses Vietnamese display labels for shift and variant.
    const shifts: Record<string, string> = { MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều', EVENING: 'Ca tối', FULLDAY: 'Cả ngày' };
    const variants: Record<string, string> = { savory: 'Mặn', vegetarian: 'Chay' };
    for (const dish of approved.dishes) {
      const rows = cooking.rows.filter(row => row.serviceDate === date && row.dishCode === dish.dishCode
        && row.shiftName === shifts[dish.shiftName] && row.menuVariant === variants[dish.menuVariant]);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.approvedDemandIds).toContain(approved.demandId);
        expect(row.approvedExtraServings).toBe(dish.extraServings);
        expect(row.servings).toBe(row.frozenBaselineServings! + dish.extraServings);
      }
    }
    expect(dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;')).toEqual(originalStock);
    expect(frozenSnapshot(dbVerifier, batchId)).toEqual(originalFrozen);
    await beptruongPage.screenshot({ path: path.join(evidenceDirectory, 'chef-approved-servings.png') });

    const secondProposal = await openSupplemental();
    await secondProposal.getByRole('button', { name: 'Đề nghị suất phát sinh', exact: true }).click();
    await secondProposal.getByRole('button', { name: 'Lập đề nghị mới', exact: true }).click();
    await secondProposal.getByRole('combobox', { name: 'Menu hoặc tùy chọn 1', exact: true }).selectOption('CUSTOM');
    await secondProposal.getByRole('combobox', { name: 'Món, ca và loại suất 1', exact: true }).selectOption(choices[0]);
    await secondProposal.getByRole('spinbutton', { name: 'Suất tăng thêm 1', exact: true }).fill('7');
    await secondProposal.getByLabel('Lý do tăng suất').fill(scope.reason + ' competing decisions');
    const savedForRace = post(thukhoPage, demandPath);
    await secondProposal.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }).click();
    const raceDraft = await savedForRace;
    expect(raceDraft.ok()).toBe(true);
    const raceId = ((await raceDraft.json()).data as MrxSupplementalDemand).demandId;
    const submittedForRace = post(thukhoPage, `${demandPath}/${raceId}/submit`);
    await secondProposal.getByRole('button', { name: 'Gửi duyệt nhu cầu' }).click();
    expect((await (await submittedForRace).json()).data.status).toBe('PENDING');
    await secondProposal.getByRole('button', { name: 'Hủy bỏ', exact: true }).click();

    const racePath = '/api/operational-approvals/mrx-supplemental-demand/' + raceId;
    const raceDecision = racePath + '/decision';
    const reviewers = await Promise.all([managerPage, adminPage].map(async (page) => {
      const { user } = await read<{ user: { userId: string; roleCode: string } }>(page, '/api/Auth/me');
      const reason = scope.reason + ' ' + user.roleCode;
      await page.goto('/approvals?targetType=mrx-supplemental-demand&targetId=' + raceId);
      await page.getByRole('button', { name: 'Từ chối hồ sơ', exact: true }).click();
      await page.getByLabel('Căn cứ quyết định').fill(reason);
      return { page, user, reason };
    }));
    expect(new Set(reviewers.map(({ user }) => user.userId)).size).toBe(2);
    expect(reviewers.map(({ user }) => user.roleCode)).toEqual(['MANAGER', 'ADMIN']);
    let releaseRequests!: () => void;
    const bothSent = new Promise<void>(resolve => { releaseRequests = resolve; });
    const payloads: { commandId: string; expectedFingerprint: string }[] = [];
    const intercept = async (route: Route) => {
      payloads.push(route.request().postDataJSON());
      if (payloads.length === 2) releaseRequests();
      await bothSent;
      await route.continue();
    };
    const racePattern = '**' + raceDecision;
    await Promise.all(reviewers.map(({ page }) => page.route(racePattern, intercept)));
    let results: number[];
    try {
      results = await Promise.all(reviewers.map(async ({ page }) => {
        const response = post(page, raceDecision);
        await page.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).click();
        return (await response).status();
      }));
    } finally {
      releaseRequests();
      await Promise.all(reviewers.map(({ page }) => page.unroute(racePattern, intercept)));
    }
    expect([...results].sort()).toEqual([200, 409]);
    expect(payloads).toHaveLength(2);
    expect(payloads[0].expectedFingerprint).toBeTruthy();
    expect(payloads[0].expectedFingerprint).toBe(payloads[1].expectedFingerprint);
    expect(payloads[0].commandId).not.toBe(payloads[1].commandId);
    const winner = reviewers[results.indexOf(200)];
    const loser = reviewers[results.indexOf(409)];
    await expect(loser.page.getByRole('dialog', { name: 'Xác nhận từ chối' })
      .getByText('Đề nghị đã được xử lý. Mở Lịch sử quyết định để xem kết quả.', { exact: true })).toBeVisible();
    const history = await read<Array<{ decision: string; actionBy: string; reason: string }>>(managerPage, racePath + '/history');
    expect(history.filter(event => event.decision === 'REJECTED')).toEqual([
      expect.objectContaining({ actionBy: winner.user.userId, reason: winner.reason }),
    ]);
    expect((await read<MrxSupplementalDemand>(thukhoPage, demandPath + '/' + raceId)).status).toBe('REJECTED');
    const afterRaceCooking = await read<MrxKitchenCooking>(beptruongPage, cookingPath);
    expect(afterRaceCooking.rows.every(row => !row.approvedDemandIds?.includes(raceId))).toBe(true);
    fs.writeFileSync(path.join(evidenceDirectory, 'supplemental-decision-race.json'),
      JSON.stringify({ demandId: raceId, outcomes: reviewers.map(({ user }, i) => ({ role: user.roleCode, status: results[i] })),
        winner: winner.user.roleCode, history }, null, 2));

    // Close the full weekly scope after fulfilling the approved extra demand.
    for (let offset = 1; offset < 6; offset++) {
      const serviceDay = new Date(date + 'T00:00:00Z');
      serviceDay.setUTCDate(serviceDay.getUTCDate() + offset);
      await thukhoPage.goto('/warehouse?view=mrx-daily&batchId=' + batchId + '&date=' + serviceDay.toISOString().slice(0, 10));
      await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      const issued = post(thukhoPage, issuePath);
      await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
      expect((await issued).ok()).toBe(true);
      await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
    }
    if (verifyPurposeShortage) {
      await assertBatchQueue(managerPage, batchId, 'PENDING', false);
      await managerPage.goto(`/reconciliation?batchId=${batchId}&date=${date}`);
      await managerPage.getByRole('button', { name: `Xử lý chênh lệch ${purposeLine.ingredientName}`, exact: true }).click();
      const disposition = managerPage.getByRole('dialog', { name: 'Xử lý chênh lệch theo ngày', exact: true });
      await disposition.getByLabel('Lý do xử lý chênh lệch', { exact: true }).fill(scope.reason);
      const saved = managerPage.waitForResponse(response => response.url().endsWith(`/daily-lines/${purposeLine.dailyLineId}/disposition`) && response.request().method() === 'PUT');
      await disposition.getByRole('button', { name: 'Lưu hướng xử lý', exact: true }).click();
      expect((await saved).status()).toBe(204);
      await expect(disposition).toHaveCount(0);
    }
    await assertBatchQueue(managerPage, batchId, 'PENDING', true);
    await managerPage.goto('/approvals?targetType=mrx-batch-review&targetId=' + batchId);
    await managerPage.getByRole('button', { name: 'Mở đối soát', exact: true }).click();
    await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
    const completed = post(managerPage, '/api/reconciliation/batches/' + batchId + '/complete');
    await managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
    expect((await completed).ok()).toBe(true);
    await managerPage.reload();
    await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
    await managerPage.screenshot({ path: path.join(evidenceDirectory, 'supplemental-week-completed.png') });
    expect(dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;')).toEqual(originalStock);
    expect(frozenSnapshot(dbVerifier, batchId)).toEqual(originalFrozen);
    fs.writeFileSync(path.join(evidenceDirectory, 'supplemental-acceptance.json'),
      JSON.stringify({ batchId, demandId: approved.demandId, status: 'COMPLETED', forbiddenWarehouseDecision: forbidden,
        frozenBaselineUnchanged: true, stockUnchanged: true, capturedAtUtc: new Date().toISOString() }, null, 2));

    await assertBatchQueue(adminPage, batchId, 'PENDING', false);
    await assertBatchQueue(adminPage, batchId, 'PROCESSED', true);
    return { batchId };
}

export async function runAdminApprovalLifecycle(
  { adminPage, dbVerifier }: Pick<MrxTestFixtures, 'adminPage' | 'dbVerifier'>,
  scope: MrxScenarioScope, evidenceDirectory: string) {

    const decisions: string[] = [];
    const directSourceRequests: string[] = [];
    adminPage.on('request', request => {
      if (request.method() !== 'POST') return;
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/decision') || pathname.endsWith('/mrx-submit')) decisions.push(pathname);
      if (pathname.endsWith('/mrx-apply')) directSourceRequests.push(pathname);
    });
    const { batchId } = await createTransferredBatch({ coordinator: adminPage, admin: adminPage }, scope);
    expect(directSourceRequests).toHaveLength(1);
    expect(decisions).toEqual([]);
    await assertBatchQueue(adminPage, batchId, 'PENDING', false);
    const date = scope.weekStartDate;
    const warehouseUrl = '/warehouse?view=mrx-daily&batchId=' + batchId + '&date=' + date;
    const demandPath = '/api/reconciliation/supplemental-demands';
    const issuePath = '/api/inventory-issues';
    const stock = dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
    const frozen = frozenSnapshot(dbVerifier, batchId);
    const identity = await read<{ user: { userId: string; roleCode: string } }>(adminPage, '/api/Auth/me');
    expect(identity.user.roleCode).toBe('ADMIN');
    await adminPage.goto(warehouseUrl);
    await adminPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    const initial = post(adminPage, issuePath);
    await adminPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    expect((await initial).ok()).toBe(true);
    await adminPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
    await dialog.getByRole('button', { name: 'Đề nghị suất phát sinh', exact: true }).click();
    const dishOptions = await read<MrxSupplementalDishOptions>(adminPage,
      `/api/reconciliation/supplemental-demands/batches/${batchId}/dish-options?serviceDate=${date}`);
    const selectableMenus = ['MORNING:savory', 'MORNING:vegetarian', 'AFTERNOON:savory', 'AFTERNOON:vegetarian']
      .map(key => ({ key, dishes: dishOptions.dishes.filter(dish => key === `${dish.shiftName}:${dish.menuVariant}`) }))
      .filter(menu => menu.dishes.length > 1 && menu.dishes.every(dish => !dish.blockedReason));
    expect(selectableMenus.length).toBeGreaterThan(0);
    const menu = selectableMenus[0];
    const checkMenu = (proposal: MrxSupplementalDemand, servings: number) => {
      const identity = (dish: { dishId: string; shiftName: string; menuVariant: string }) =>
        [dish.dishId, dish.shiftName, dish.menuVariant].join(':');
      expect(proposal.dishes.map(identity).sort()).toEqual(menu.dishes.map(identity).sort());
      expect(proposal.dishes.every(dish => dish.extraServings === servings)).toBe(true);
    };
    await dialog.getByRole('combobox', { name: 'Menu hoặc tùy chọn 1', exact: true }).selectOption(menu.key);
    await dialog.getByRole('spinbutton', { name: 'Suất tăng thêm 1', exact: true }).fill('10');
    await dialog.getByLabel('Lý do tăng suất').fill(scope.reason);
    const created = post(adminPage, demandPath);
    await dialog.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }).click();
    const draft = (await (await created).json()).data as MrxSupplementalDemand;
    expect(draft.status).toBe('DRAFT');
    const submitted = post(adminPage, demandPath + '/' + draft.demandId + '/submit');
    await dialog.getByRole('button', { name: 'Ghi nhận suất phát sinh', exact: true }).click();
    const confirmation = await submitted;
    expect(confirmation.ok()).toBe(true);
    const approved = (await confirmation.json()).data as MrxSupplementalDemand;
    expect(approved.status).toBe('APPROVED');
    checkMenu(approved, 10);
    expect(approved.createdBy).toBe(identity.user.userId);
    expect(approved.decidedBy).toBe(identity.user.userId);
    expect(approved.decidedAt).toBeTruthy();
    await expect(dialog.getByText('Admin đã ghi nhận nhu cầu', { exact: true })).toBeVisible();
    expect(decisions).toEqual([]);
    await adminPage.screenshot({ path: path.join(evidenceDirectory, 'admin-direct-demand-confirmed.png') });
    const day = (await read<MrxWarehouseDaily>(adminPage, '/api/reconciliation/batches/' + batchId + '/warehouse-daily'))
      .dates.find(row => row.serviceDate === date)!;
    await dialog.getByRole('button', { name: 'Nhập nguyên liệu trực tiếp', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Mục đích xuất bổ sung' }).selectOption(approved.demandId);
    for (const material of approved.materials) {
      const line = day.lines.find(row => row.dailyLineId === material.dailyLineId)!;
      await dialog.getByRole('spinbutton', { name: 'Lượng xuất bổ sung ' + line.ingredientName, exact: true }).fill(String(material.requiredQuantity));
    }
    await dialog.getByLabel('Lý do xuất bổ sung').fill(scope.reason);
    const actual = post(adminPage, issuePath);
    await dialog.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true }).click();
    expect((await actual).ok()).toBe(true);
    await expect(dialog).toHaveCount(0);
    await adminPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
    await dialog.getByRole('button', { name: 'Đề nghị suất phát sinh', exact: true }).click();
    await dialog.getByRole('button', { name: 'Lập đề nghị mới', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Menu hoặc tùy chọn 1', exact: true }).selectOption(menu.key);
    await dialog.getByRole('spinbutton', { name: 'Suất tăng thêm 1', exact: true }).fill('5');
    await dialog.getByLabel('Lý do tăng suất').fill(scope.reason + ' second request');
    const secondCreated = post(adminPage, demandPath);
    await dialog.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }).click();
    const secondDraft = (await (await secondCreated).json()).data as MrxSupplementalDemand;
    expect(secondDraft.demandId).not.toBe(approved.demandId);
    const secondSubmitted = post(adminPage, demandPath + '/' + secondDraft.demandId + '/submit');
    await dialog.getByRole('button', { name: 'Ghi nhận suất phát sinh', exact: true }).click();
    const secondConfirmation = await secondSubmitted;
    expect(secondConfirmation.ok()).toBe(true);
    const secondApproved = (await secondConfirmation.json()).data as MrxSupplementalDemand;
    expect(secondApproved.status).toBe('APPROVED');
    checkMenu(secondApproved, 5);
    await dialog.getByRole('button', { name: 'Nhập nguyên liệu trực tiếp', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Mục đích xuất bổ sung' }).selectOption(secondApproved.demandId);
    for (const material of secondApproved.materials) {
      const line = day.lines.find(row => row.dailyLineId === material.dailyLineId)!;
      await dialog.getByRole('spinbutton', { name: 'Lượng xuất bổ sung ' + line.ingredientName, exact: true }).fill(String(material.requiredQuantity));
    }
    await dialog.getByLabel('Lý do xuất bổ sung').fill(scope.reason + ' second issue');
    const secondActual = post(adminPage, issuePath);
    await dialog.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true }).click();
    expect((await secondActual).status()).toBe(201);
    await expect(dialog).toHaveCount(0);
    await adminPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
    await dialog.getByRole('button', { name: 'Đề nghị suất phát sinh', exact: true }).click();
    await dialog.getByRole('button', { name: 'Lập đề nghị mới', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Menu hoặc tùy chọn 1', exact: true }).selectOption(menu.key);
    await dialog.getByRole('spinbutton', { name: 'Suất tăng thêm 1', exact: true }).fill('1');
    await dialog.getByLabel('Lý do tăng suất').fill(scope.reason + ' cancellation check');
    const cancelCreated = post(adminPage, demandPath);
    await dialog.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }).click();
    const cancelDraft = (await (await cancelCreated).json()).data as MrxSupplementalDemand;
    const cancelApprovedResponse = post(adminPage, demandPath + '/' + cancelDraft.demandId + '/submit');
    await dialog.getByRole('button', { name: 'Ghi nhận suất phát sinh', exact: true }).click();
    const cancelApproved = (await (await cancelApprovedResponse).json()).data as MrxSupplementalDemand;
    expect(cancelApproved.status).toBe('APPROVED');
    const beforeCancellation = await read<MrxKitchenCooking>(adminPage, '/api/reconciliation/batches/' + batchId + '/kitchen-cooking');
    const extraRows = beforeCancellation.rows.filter(row => row.approvedDemandIds?.includes(cancelDraft.demandId));
    expect(extraRows.length).toBeGreaterThan(0);
    expect(extraRows.every(row => row.approvedExtraServings === 16)).toBe(true);
    await dialog.getByRole('button', { name: 'Hủy nhu cầu', exact: true }).click();
    await dialog.getByLabel('Lý do hủy nhu cầu').fill(scope.reason + ' customer withdrew extra servings');
    const originalViewport = adminPage.viewportSize();
    for (const width of [600, 960, 1440]) {
      await adminPage.setViewportSize({ width, height: 840 });
      await dialog.getByRole('button', { name: 'Xác nhận hủy nhu cầu', exact: true }).scrollIntoViewIfNeeded();
      await adminPage.screenshot({ path: path.join(evidenceDirectory, `admin-cancel-demand-${width}.png`) });
    }
    if (originalViewport) await adminPage.setViewportSize(originalViewport);
    const cancellation = post(adminPage, demandPath + '/' + cancelDraft.demandId + '/cancel');
    await dialog.getByRole('button', { name: 'Xác nhận hủy nhu cầu', exact: true }).click();
    const cancellationResponse = await cancellation;
    expect(cancellationResponse.ok(), await cancellationResponse.text()).toBe(true);
    const cancelled = (await cancellationResponse.json()).data as MrxSupplementalDemand;
    expect(cancelled.status).toBe('CANCELLED');
    await expect(dialog.getByText('Nhu cầu đã hủy', { exact: true })).toBeVisible();
    const cancelledHistory = await read<ApprovalHistoryItem[]>(adminPage, `/api/operational-approvals/mrx-supplemental-demand/${cancelled.demandId}/history`);
    expect(cancelledHistory.some(row => row.newStatus === 'CANCELLED' && row.actionBy === identity.user.userId)).toBe(true);
    fs.writeFileSync(path.join(evidenceDirectory, 'admin-cancel-demand.json'), JSON.stringify({ approved: cancelApproved, cancelled, history: cancelledHistory }, null, 2));
    await dialog.getByRole('button', { name: 'Hủy bỏ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const cooking = await read<MrxKitchenCooking>(adminPage, '/api/reconciliation/batches/' + batchId + '/kitchen-cooking');
    expect(cooking.rows.some(row => row.approvedDemandIds?.includes(cancelled.demandId))).toBe(false);
    const increasedRows = cooking.rows.filter(row => row.approvedDemandIds?.includes(secondApproved.demandId));
    expect(increasedRows.length).toBeGreaterThan(0);
    for (const row of increasedRows) {
      expect(row.approvedDemandIds).toContain(approved.demandId);
      expect(row.approvedExtraServings).toBe(15);
    }
    await adminPage.goto('/approvals?targetType=mrx-supplemental-demand&targetId=' + approved.demandId + '&state=PROCESSED');
    await expect(adminPage.getByText('Admin ghi nhận trực tiếp', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Đã lưu nháp', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Chờ duyệt', { exact: true })).toHaveCount(0);
    await expect(adminPage.getByRole('button', { name: 'Phê duyệt hồ sơ', exact: true })).toHaveCount(0);
    await adminPage.screenshot({ path: path.join(evidenceDirectory, 'admin-direct-demand-history.png') });
    const history = await read<Array<{ decision: string; actionBy: string }>>(adminPage,
      '/api/operational-approvals/mrx-supplemental-demand/' + approved.demandId + '/history');
    expect(history.filter(row => row.decision === 'ADMIN_DIRECT')).toEqual([
      expect.objectContaining({ actionBy: identity.user.userId }),
    ]);
    expect(history.map(row => row.decision)).not.toContain('PENDING');
    for (let offset = 1; offset < 6; offset++) {
      const serviceDay = new Date(date + 'T00:00:00Z');
      serviceDay.setUTCDate(serviceDay.getUTCDate() + offset);
      await adminPage.goto('/warehouse?view=mrx-daily&batchId=' + batchId + '&date=' + serviceDay.toISOString().slice(0, 10));
      await adminPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      const issued = post(adminPage, issuePath);
      await adminPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
      expect((await issued).status()).toBe(201);
      await expect(adminPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
    }
    await assertBatchQueue(adminPage, batchId, 'PENDING', true);
    await adminPage.goto('/reconciliation?batchId=' + batchId);
    await adminPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
    const complete = post(adminPage, '/api/reconciliation/batches/' + batchId + '/complete');
    await adminPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
    const completed = await complete;
    expect(completed.ok(), await completed.text()).toBe(true);
    await adminPage.reload();
    await expect(adminPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
    await adminPage.screenshot({ path: path.join(evidenceDirectory, 'admin-direct-week-completed.png') });
    const batchHistory = await read<Array<{ decision: string; actionBy: string }>>(adminPage,
      '/api/operational-approvals/mrx-batch-review/' + batchId + '/history');
    for (const status of ['DRAFT', 'READY', 'TRANSFERRED', 'COMPLETED']) {
      expect(batchHistory.filter(row => row.decision === status)).toEqual([expect.objectContaining({ actionBy: identity.user.userId })]);
    }
    expect(decisions).toEqual([]);
    expect(dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;')).toEqual(stock);
    expect(frozenSnapshot(dbVerifier, batchId)).toEqual(frozen);
    fs.writeFileSync(path.join(evidenceDirectory, 'admin-direct-demand-evidence.json'),
      JSON.stringify({ batchId, demandId: approved.demandId, actor: identity.user.userId,
        status: approved.status, batchStatus: 'COMPLETED', extraApprovalPosts: decisions.length, history, batchHistory,
        stockUnchanged: true, baselineUnchanged: true }, null, 2));

    await assertBatchQueue(adminPage, batchId, 'PENDING', false);
    await assertBatchQueue(adminPage, batchId, 'PROCESSED', true);
    return { batchId };
}
