import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { test } from '../fixtures/mrxTest';

const TEMPLATE_FILE = path.resolve('backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx');
const WEEK_START = '2026-07-20';

async function importWeeklyMenu(page: Page): Promise<void> {
  await page.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${WEEK_START}`);
  await page.getByRole('button', { name: 'Nhập thực đơn Excel', exact: true }).first().click();
  await page.locator('select#import-customer-select').selectOption({ label: 'ANV - AMANN' });
  await page.locator('input[aria-label="Tuần bắt đầu nhập"]').fill('20/07/2026');
  await page.locator('input[aria-label="Tuần bắt đầu nhập"]').press('Enter');
  await page.setInputFiles('input[type="file"]', TEMPLATE_FILE);

  const tier25k = page.locator('button[role="radio"]:has-text("25.000")');
  if (await tier25k.isVisible()) await tier25k.click();

  await page.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.getByText('Kết quả phân tích file')).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(page.locator('div[role="dialog"]')).toBeHidden({ timeout: 20_000 });
}

async function openSourceEditor(page: Page): Promise<void> {
  await expect(page.getByLabel('Bảng sửa nguồn MRX')).toBeVisible();
  const editDishes = page.getByRole('button', { name: 'Chỉnh sửa món' });
  if (await editDishes.isVisible()) await editDishes.click();
  await expect(page.getByRole('button', { name: 'Xem menu đã gộp' })).toBeVisible();
}

async function openSourceReview(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
  await expect(page.getByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).toBeVisible();
}

async function tabToAccessibleName(page: Page, expectedName: string, maxTabs = 80): Promise<number> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let index = 1; index <= maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const element = document.activeElement;
      return element?.getAttribute('aria-label') || element?.textContent?.trim() || '';
    });
    if (name.includes(expectedName)) return index;
  }
  throw new Error(`Keyboard focus did not reach "${expectedName}" within ${maxTabs} Tab presses.`);
}

async function tabToRole(page: Page, expectedRole: string, maxTabs = 80): Promise<number> {
  for (let index = 1; index <= maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const role = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    if (role === expectedRole) return index;
  }
  throw new Error(`Keyboard focus did not reach role=${expectedRole} within ${maxTabs} Tab presses.`);
}

async function expectCompactSourceFlow(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  const grid = page.getByLabel('Bảng sửa nguồn MRX');
  await expect(grid).toBeVisible();
  const reviewTrigger = page.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ });
  await expect(reviewTrigger).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem menu đã gộp' })).toBeVisible();
  const gridBox = await grid.boundingBox();
  expect(gridBox?.width ?? 0).toBeGreaterThan(width * 0.8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await reviewTrigger.click();
  await expect(grid).toBeHidden();
  const reviewHeading = page.getByRole('heading', { name: 'Xem trước ảnh hưởng' });
  await expect(page.getByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).toBeVisible();
  await expect(reviewHeading).toBeFocused();
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click();
  await expect(grid).toBeVisible();
  await expect(page.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ })).toBeFocused();
}

async function fillMissingSplitServings(page: Page): Promise<void> {
  for (const input of await page.getByRole('spinbutton', { name: /Số suất Mặn/ }).all()) {
    if (!(await input.inputValue())) await input.fill('1000');
  }
  for (const input of await page.getByRole('spinbutton', { name: /Số suất Chay/ }).all()) {
    if (!(await input.inputValue())) await input.fill('50');
  }
}

async function previewAndApply(page: Page, reason: string): Promise<void> {
  await page.getByLabel('Lý do thay đổi nguồn').fill(reason);
  await page.getByRole('button', { name: 'Xem ảnh hưởng' }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng ngay' })).toBeEnabled();
  await page.getByRole('button', { name: 'Áp dụng ngay' }).click();
  await page.getByRole('button', { name: 'Xác nhận áp dụng' }).click();
  await expect(page.getByText('Đã áp dụng thay đổi nguồn.')).toBeVisible();
}

async function previewAndSubmit(page: Page, reason: string): Promise<void> {
  await page.getByLabel('Lý do thay đổi nguồn').fill(reason);
  await page.getByRole('button', { name: 'Xem ảnh hưởng' }).click();
  await expect(page.getByRole('button', { name: 'Gửi duyệt' })).toBeEnabled();
  await page.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(page.getByText('Đã gửi yêu cầu thay đổi để duyệt.')).toBeVisible();
}

async function createAndTransferBatch(page: Page): Promise<string> {
  const publish = page.locator('header button:has-text("Xuất bản thực đơn tuần")');
  if (await publish.isVisible()) await publish.click();

  await page.getByRole('button', { name: 'Lưu & kiểm tra định lượng' }).click();
  await page.getByRole('button', { name: 'Tạo lô nháp' }).click();
  await page.getByRole('button', { name: 'Đóng băng lô' }).click();
  await page.getByRole('button', { name: 'Chuyển sang Kho' }).click();

  return page.evaluate(async () => {
    const token = localStorage.getItem('ipc_v3_token');
    const response = await fetch('/api/reconciliation/batches?pageSize=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    return body.data?.items?.[0]?.batchId ?? '';
  });
}

async function completeIssueOnCurrentPage(page: Page): Promise<void> {
  const fillAll = page.locator('header button:has-text("Điền đủ toàn bộ")');
  await expect(fillAll).toBeVisible();
  await fillAll.click();
  const issueResponse = page.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
  await page.locator('header button:has-text("Xác nhận xuất kho")').click();
  const response = await issueResponse;
  if (!response.ok()) throw new Error(`Warehouse issue retry failed (${response.status()}): ${await response.text()}`);
}

async function issueDate(page: Page, batchId: string, date: string): Promise<void> {
  await page.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${date}`);
  await page.reload();
  await completeIssueOnCurrentPage(page);
}

test.describe('@G6-Direct-Source-Edit MRX direct edit, day lock, persistence and race', () => {
  test('Nguồn MRX cập nhật ngày mở nhưng không rewrite ngày đã xuất', async ({ adminPage, dieuphoiPage, thukhoPage, dbVerifier }) => {
    test.setTimeout(240_000);

    await importWeeklyMenu(adminPage);
    await expect(adminPage.getByLabel('Bảng sửa nguồn MRX')).toBeVisible();
    await expect(adminPage.getByText('MẶN · CA SÁNG')).toBeVisible();
    await expect(adminPage.getByText('CHAY · CA SÁNG')).toBeVisible();
    await expect(adminPage.getByText('Thịt heo kho sả ruốc').first()).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: /Trái cây, 2 ngày, 1 loại món/ }).first()).toBeVisible();
    expect(await tabToAccessibleName(adminPage, 'Số suất Mặn 20/07 MORNING')).toBeGreaterThan(0);
    await adminPage.getByRole('button', { name: 'Chỉnh sửa món' }).click();
    await expect(adminPage.getByLabel('Bảng sửa nguồn MRX')).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Xem menu đã gộp' })).toBeVisible();
    await expect(adminPage.getByRole('combobox', { name: 'Sữa chua 20/07 MORNING' })).toBeVisible();
    await expect(adminPage.getByRole('combobox', { name: 'Sữa chua 21/07 MORNING' })).toBeVisible();
    await expect(adminPage.getByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).toHaveCount(0);

    expect(await tabToRole(adminPage, 'combobox')).toBeGreaterThan(0);
    const focusedDish = adminPage.locator(':focus');
    const dishBeforeKeyboardSelection = await focusedDish.inputValue();
    await adminPage.keyboard.press('ArrowDown');
    await adminPage.keyboard.press('Enter');
    await expect(focusedDish).not.toHaveValue(dishBeforeKeyboardSelection);
    await adminPage.keyboard.press('ArrowDown');
    await adminPage.keyboard.press('Escape');
    await expect(focusedDish).toBeFocused();

    await expectCompactSourceFlow(adminPage, 720, 450);
    await expectCompactSourceFlow(adminPage, 768, 1024);
    await adminPage.setViewportSize({ width: 1440, height: 900 });
    await fillMissingSplitServings(adminPage);
    await openSourceReview(adminPage);
    await previewAndApply(adminPage, 'G6 nhập số suất Mặn và Chay');

    const batchId = await createAndTransferBatch(adminPage);
    expect(batchId).toBeTruthy();

    await issueDate(thukhoPage, batchId, '2026-07-20');

    await adminPage.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${WEEK_START}`);
    await openSourceEditor(adminPage);

    const lockedSavory = adminPage.getByRole('spinbutton', { name: /Số suất Mặn 20\/07/ }).first();
    const openSavory = adminPage.getByRole('spinbutton', { name: /Số suất Mặn 22\/07/ }).first();
    await expect(lockedSavory).toBeDisabled();
    await expect(openSavory).toBeEnabled();

    const changedSavory = String(Number(await openSavory.inputValue()) + 25);
    await openSavory.fill(changedSavory);
    const dish = adminPage.getByRole('combobox', { name: /22\/07/ }).first();
    await dish.click();
    const alternative = adminPage.locator('[role="option"]:not([aria-selected="true"])').first();
    if (await alternative.count()) await alternative.click();
    await openSourceReview(adminPage);
    await previewAndApply(adminPage, 'G6 đổi món và số suất ngày chưa xuất');

    const revisions = dbVerifier.query<{ ApplyMode: string; Status: string; deltaCount: string }>(`
      SELECT r.ApplyMode, r.Status, COUNT(d.SourceDeltaId) AS deltaCount
      FROM reconciliationsourcerevisions r
      JOIN reconciliationsourcedeltas d ON d.SourceRevisionId = r.SourceRevisionId
      GROUP BY r.SourceRevisionId, r.ApplyMode, r.Status
      ORDER BY r.AppliedAt DESC
      LIMIT 1;
    `);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].ApplyMode).toBe('DIRECT');
    expect(revisions[0].Status).toBe('APPLIED');
    expect(Number(revisions[0].deltaCount)).toBeGreaterThan(0);

    const lockedDateDeltas = dbVerifier.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt
      FROM reconciliationsourcedeltas d
      JOIN reconciliationsourcerevisions r ON r.SourceRevisionId = d.SourceRevisionId
      WHERE d.ServiceDate = '2026-07-20' AND r.Reason = 'G6 đổi món và số suất ngày chưa xuất';
    `);
    expect(Number(lockedDateDeltas[0]?.cnt ?? 0)).toBe(0);

    await adminPage.reload();
    await openSourceEditor(adminPage);
    await expect(adminPage.getByRole('spinbutton', { name: /Số suất Mặn 22\/07/ }).first()).toHaveValue(changedSavory);
    await expect(adminPage.getByRole('spinbutton', { name: /Số suất Mặn 20\/07/ }).first()).toBeDisabled();

    await dieuphoiPage.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${WEEK_START}`);
    await openSourceEditor(dieuphoiPage);
    const coordinatorServings = dieuphoiPage.getByRole('spinbutton', { name: /Số suất Mặn 23\/07/ }).first();
    await coordinatorServings.fill(String(Number(await coordinatorServings.inputValue()) + 10));
    await openSourceReview(dieuphoiPage);
    await previewAndSubmit(dieuphoiPage, 'G6 Điều phối đề nghị tăng suất');

    const pending = dbVerifier.query<{ Status: string }>(`
      SELECT Status FROM menuamendments ORDER BY CreatedAt DESC LIMIT 1;
    `);
    expect(pending[0]?.Status).toBe('PENDING_REVIEW');

    await adminPage.reload();
    await adminPage.getByRole('button', { name: /Yêu cầu chờ duyệt/ }).click();
    const requestSelector = adminPage.getByLabel('Yêu cầu nguồn cần duyệt');
    if (await requestSelector.isVisible()) {
      const requestId = await requestSelector.locator('option').filter({ hasText: 'G6 Điều phối đề nghị tăng suất' }).getAttribute('value');
      if (requestId) await requestSelector.selectOption(requestId);
    }
    await adminPage.getByRole('button', { name: 'Phê duyệt thay đổi' }).click();
    await expect(adminPage.getByText('Đã áp dụng thay đổi nguồn.')).toBeVisible();

    const approved = dbVerifier.query<{ ApplyMode: string; Status: string }>(`
      SELECT ApplyMode, Status FROM reconciliationsourcerevisions ORDER BY AppliedAt DESC LIMIT 1;
    `);
    expect(approved).toEqual([{ ApplyMode: 'APPROVED_REQUEST', Status: 'APPLIED' }]);
    const revisionsBeforeRace = Number(dbVerifier.query<{ cnt: string }>('SELECT COUNT(*) AS cnt FROM reconciliationsourcerevisions;')[0]?.cnt ?? 0);

    await adminPage.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${WEEK_START}`);
    await openSourceEditor(adminPage);
    const raceServings = adminPage.getByRole('spinbutton', { name: /Số suất Mặn 24\/07/ }).first();
    await raceServings.fill(String(Number(await raceServings.inputValue()) + 5));
    await openSourceReview(adminPage);
    await adminPage.getByLabel('Lý do thay đổi nguồn').fill('G6 race apply với xuất kho');
    await adminPage.getByRole('button', { name: 'Xem ảnh hưởng' }).click();
    await adminPage.getByRole('button', { name: 'Áp dụng ngay' }).click();
    await expect(adminPage.getByRole('button', { name: 'Xác nhận áp dụng' })).toBeVisible();

    await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=2026-07-24`);
    await thukhoPage.locator('header button:has-text("Điền đủ toàn bộ")').click();
    const applyResponse = adminPage.waitForResponse((response) => response.url().endsWith('/api/coordination/weekly-menu/amendments/mrx-apply') && response.request().method() === 'POST');
    const issueResponse = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await Promise.all([
      adminPage.getByRole('button', { name: 'Xác nhận áp dụng' }).click(),
      thukhoPage.locator('header button:has-text("Xác nhận xuất kho")').click(),
    ]);
    const [applyStatus, issueStatus] = await Promise.all([applyResponse.then((response) => response.status()), issueResponse.then((response) => response.status())]);
    const applyWon = applyStatus >= 200 && applyStatus < 300;
    const issueWon = issueStatus >= 200 && issueStatus < 300;
    expect(Number(applyWon) + Number(issueWon)).toBe(1);
    expect([applyStatus, issueStatus]).toContain(409);
    if (!issueWon) {
      await expect(thukhoPage.getByText('Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.')).toBeVisible();
      await thukhoPage.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }).click();
      await completeIssueOnCurrentPage(thukhoPage);
    }

    const raceFacts = dbVerifier.query<{ issueCount: string; revisionCount: string }>(`
      SELECT
        (SELECT COUNT(*) FROM inventoryissues WHERE IssueDate = '2026-07-24') AS issueCount,
        (SELECT COUNT(*) FROM reconciliationsourcerevisions) AS revisionCount;
    `)[0];
    expect(Number(raceFacts.issueCount)).toBeGreaterThan(0);
    expect(Number(raceFacts.revisionCount) - revisionsBeforeRace).toBe(applyWon ? 1 : 0);

    await adminPage.reload();
    await openSourceEditor(adminPage);
    await expect(adminPage.getByRole('spinbutton', { name: /Số suất Mặn 24\/07/ }).first()).toBeDisabled();
  });
});
