import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { expect, type Page, type Locator } from '@playwright/test';
import type { MySQLVerifier } from '../core/mysqlVerifier';
import { respectApiBudget } from './authHelpers';
import { evidenceStep } from './actionEvidence';

export type MrxScenarioScope = { runId: string; attemptId: string; caseId: string; weekStartDate: string; reason: string; workbook: string; customer?: { customerId: string; label: string } };

export function scenarioScope(verifier: MySQLVerifier, ordinal: number): MrxScenarioScope {
  const runId = process.env.MRX_EVIDENCE_RUN_ID;
  const directory = process.env.MRX_E2E_ARTIFACT_DIRECTORY;
  if (!runId || !directory || !Number.isSafeInteger(ordinal) || ordinal < 0) throw new Error('Scenario scope requires an owned run and ordinal.');
  const attemptId = process.env.MRX_EVIDENCE_ATTEMPT_ID || (process.env.MRX_E2E_CAMPAIGN_ID ? '' : runId);
  if (!/^[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$/.test(attemptId)) throw new Error('Scenario scope requires a valid campaign attempt identity.');
  const caseId = `${attemptId}_${ordinal}`;
  const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7) + 7 * (ordinal + 1));
  let week = '';
  for (let attempt = 0; attempt < 104; attempt++) {
    week = date.toISOString().slice(0, 10);
    const rows = verifier.query<{ count: string }>(`SELECT COUNT(*) AS count FROM menuversions WHERE weekStartDate='${week}';`);
    if (rows.length !== 1) throw new Error('Cannot determine whether scenario week is absent.');
    if (rows[0].count === '0' && !fs.existsSync(path.join(directory, `scope-${caseId}-${week}.xlsx`))) break;
    week = '';
    date.setUTCDate(date.getUTCDate() + 7);
  }
  if (!week) throw new Error('No non-colliding scenario week found within bounded search.');
  const repoRoot = fs.existsSync(path.resolve('scripts/mrx-evidence/MrxEvidenceSafety.ps1')) ? process.cwd() : path.resolve('..');
  if (!fs.existsSync(path.join(repoRoot, 'scripts/mrx-evidence/MrxEvidenceSafety.ps1'))) throw new Error('Scenario scope must run from repository root or frontend workspace.');
  const workbook = path.join(directory, `scope-${caseId}-${week}.xlsx`);
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `. ${quote(path.join(repoRoot, 'scripts/mrx-evidence/MrxEvidenceSafety.ps1'))}; New-MrxScenarioWorkbook -TemplatePath ${quote(path.join(repoRoot, 'backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx'))} -OutputPath ${quote(workbook)} -WeekStartDate '${week}'`,
  ], { stdio: 'pipe' });
  return { runId, attemptId, caseId, weekStartDate: week, workbook, reason: `MRX ${runId} case ${caseId} ${week}` };
}

export async function captureStationUI(page: Page, name: string, width: number, height: number, control: Locator) {
  await page.setViewportSize({ width, height });
  await expect(control).toBeVisible();
  await control.click({ trial: true });
  await control.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(control).toBeFocused();
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  const file = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `task8-${name}-${width}`);
  await page.screenshot({ path: `${file}.png` });
  fs.writeFileSync(`${file}.json`, JSON.stringify({ geometry, keyboard: 'Tab/Shift+Tab returned to control', control: await control.innerText() }, null, 2));
}

export async function createTransferredBatch(pages: { coordinator: Page; admin: Page; recordSteps?: boolean; stopAtDraft?: boolean; afterPublish?: (coordinator: Page, scope: MrxScenarioScope) => Promise<void>; afterTransfer?: () => Promise<void>; sourceScenario?: (coordinator: Page, scope: MrxScenarioScope) => Promise<void>; sourceAccepted?: (coordinator: Page, scope: MrxScenarioScope) => Promise<void> }, scope: MrxScenarioScope, auditUI = false): Promise<{ batchId: string; menuVersionId: string }> {
  const { coordinator, admin } = pages;
  // Golden opts in explicitly; shared setup must not instrument memory/endurance measurements.
  const step: typeof evidenceStep = pages.recordSteps ? evidenceStep : async (page, _scope, _name, _role, action) => {
    await respectApiBudget(page);
    return (await action()) || undefined;
  };
  const url = `/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}${scope.customer ? `&customerId=${scope.customer.customerId}` : ''}`;
  const artifactPrefix = `${scope.weekStartDate}${scope.customer ? `-${scope.customer.customerId}` : ''}`;
  await coordinator.bringToFront();
  await coordinator.goto(url);
  if (auditUI) await coordinator.setViewportSize({ width: 1366, height: 768 });
  await step(coordinator, scope, 'source-open-import', 'COORDINATOR', async () => {
    await coordinator.getByRole('button', { name: 'Nhập Excel', exact: true }).first().click();
    await expect(coordinator.getByLabel('Tuần bắt đầu nhập', { exact: true })).toBeVisible();
  });
  const scopeIntent = coordinator.getByLabel('Phạm vi nhập Excel');
  await expect(scopeIntent).toBeVisible();
  await scopeIntent.selectOption('current-week');
  await expect(coordinator.getByLabel('Tuần bắt đầu nhập', { exact: true })).not.toBeEditable();
  await scopeIntent.selectOption('new-week');
  await coordinator.locator('select#import-customer-select').selectOption(scope.customer ? { value: scope.customer.customerId } : { label: 'ANV - AMANN' });
  await coordinator.setInputFiles('input[type="file"]', scope.workbook);
  const dateInput = coordinator.getByLabel('Tuần bắt đầu nhập', { exact: true });
  if (await dateInput.getAttribute('readonly') !== null) {
    await coordinator.getByRole('button', { name: 'Đổi tuần', exact: true }).click();
  }
  await expect(dateInput).toBeEditable();
  await dateInput.fill(scope.weekStartDate.split('-').reverse().join('/'));
  await dateInput.press('Enter');
  const price = coordinator.locator('button[role="radio"]:has-text("25.000")');
  if (await price.isVisible()) await price.click();
  await step(coordinator, scope, 'source-preview-import', 'COORDINATOR', async () => {
    const response = coordinator.waitForResponse((item) => item.url().endsWith('/weekly-menu/import/preview') && item.request().method() === 'POST');
    await coordinator.getByRole('button', { name: 'Xem trước', exact: true }).click();
    const result = await response;
    await expect(coordinator.getByText('Kết quả phân tích file', { exact: true })).toBeVisible();
    return result;
  });
  console.log('[UI] Điều phối: đã bấm Nhập thực đơn Excel → Xem trước; chụp kết quả phân tích.');
  await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-01-import-preview.png`) });
  if (auditUI) await captureStationUI(coordinator, 'source-import', 1366, 768, coordinator.getByRole('button', { name: 'Xác nhận nhập', exact: true }));
  const importResponse = (await step(coordinator, scope, 'source-commit-import', 'COORDINATOR', async () => {
    const imported = coordinator.waitForResponse((response) => response.request().method() === 'POST'
      && response.url().includes('/weekly-menu/') && response.url().includes('commit'));
    await coordinator.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click();
    const result = await imported;
    expect(result.ok()).toBe(true);
    await expect(coordinator.getByRole('dialog')).toHaveCount(0);
    return result;
  }))!;
  expect(importResponse.ok()).toBe(true);
  const importedData = (await importResponse.json()).data;
  expect(importedData?.menuVersionId).toBeTruthy();
  const publish = coordinator.getByRole('button', { name: 'Xuất bản thực đơn tuần' });
  if (await publish.isVisible()) await step(coordinator, scope, 'source-publish', 'COORDINATOR', async () => {
    await publish.click();
    await expect(publish).toBeHidden();
  });
  await pages.afterPublish?.(coordinator, scope);
  const savory = coordinator.getByRole('spinbutton', { name: /Số suất Mặn/ });
  let mainDishName = '';
  if (pages.sourceScenario) {
    await pages.sourceScenario(coordinator, scope);
  } else {
  // Clone-only deliberate source edit: prove vertical grouping through a real approval, not DOM patching.
  await step(coordinator, scope, 'source-open-editor', 'COORDINATOR', async () => {
    await coordinator.getByRole('button', { name: 'Chỉnh sửa món', exact: true }).click();
    await expect(coordinator.getByRole('button', { name: 'Xem menu đã gộp', exact: true })).toBeVisible();
  });
  const shortDate = scope.weekStartDate.slice(5).split('-').reverse().join('/');
  const mainDish = coordinator.getByRole('combobox', { name: `Món chính ${shortDate} Sáng`, exact: true });
  mainDishName = await mainDish.inputValue();
  expect(mainDishName).not.toBe('');
  if (auditUI) await captureStationUI(coordinator, 'source-editor', 1366, 768, coordinator.getByRole('button', { name: 'Xem menu đã gộp', exact: true }));
  await step(coordinator, scope, 'source-select-dish-and-merge', 'COORDINATOR', async () => {
    await mainDish.fill(mainDishName);
    const mainOptionName = (await coordinator.getByRole('listbox').getByRole('option', { selected: true }).innerText()).replace(/\s+/g, ' ').trim();
    await mainDish.press('Escape');
    await coordinator.getByRole('combobox', { name: `Phụ 1 ${shortDate} Sáng`, exact: true }).fill(mainDishName);
    await coordinator.getByRole('listbox').getByRole('option', { name: mainOptionName, exact: true }).click();
    await coordinator.getByRole('button', { name: 'Xem menu đã gộp', exact: true }).click();
    await expect(coordinator.getByRole('spinbutton', { name: /Số suất Mặn/ }).first()).toBeVisible();
  });
  await expect(savory.first()).toBeVisible();
  for (const input of await coordinator.getByRole('spinbutton', { name: /Số suất/ }).all()) await expect(input).toHaveValue('');
  await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-00-no-default-servings.png`) });
  await step(coordinator, scope, 'source-fill-servings', 'COORDINATOR', async () => {
    for (const input of await savory.all()) await input.fill('1000');
    for (const input of await coordinator.getByRole('spinbutton', { name: /Số suất Chay/ }).all()) await input.fill('50');
  });
  }
  const firstSavoryValue = await savory.first().inputValue();
  await step(coordinator, scope, 'source-open-impact', 'COORDINATOR', async () => {
    await coordinator.getByRole('button', { name: /(?:Tiếp tục xem ảnh hưởng|Kiểm tra số suất) \(\d+\)/ }).click();
    await expect(coordinator.getByRole('button', { name: 'Quay lại thực đơn' })).toBeVisible();
    await expect(coordinator.getByRole('spinbutton', { name: /Số suất/ })).toHaveCount(0);
  });
  await coordinator.getByLabel('Lý do thay đổi nguồn').fill(scope.reason);
  await step(coordinator, scope, 'source-preview-impact', 'COORDINATOR', async () => {
    const response = coordinator.waitForResponse((item) => item.url().endsWith('/weekly-menu/amendments/preview') && item.request().method() === 'POST');
    await coordinator.getByRole('button', { name: 'Kiểm tra lại ảnh hưởng', exact: true }).click();
    const result = await response;
    await expect(coordinator.getByRole('button', { name: 'Gửi duyệt', exact: true })).toBeEnabled();
    return result;
  });
  if (auditUI) await captureStationUI(coordinator, 'source-review', 1366, 768, coordinator.getByRole('button', { name: 'Gửi duyệt', exact: true }));
  await expect(coordinator.getByText(/Nguồn thay đổi:/)).toContainText('6 ngày.');
  await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-review-summary.png`) });
  await expect(coordinator.getByRole('heading', { name: /^Số suất đề nghị theo ca/ })).toBeVisible();
  await expect(coordinator.getByRole('table', { name: 'Thay đổi số suất theo ca' })).toBeVisible();
  const columnGeometry = await coordinator.getByRole('table', { name: 'Thay đổi số suất theo ca' }).evaluate((table) => {
    const headings = Array.from(table.querySelectorAll('thead th'));
    const cells = Array.from(table.querySelectorAll('tbody tr:first-child > *'));
    return headings.map((heading, index) => ({ header: heading.textContent, delta: Math.abs(heading.getBoundingClientRect().right - cells[index].getBoundingClientRect().right), headerAlign: getComputedStyle(heading).textAlign, cellAlign: getComputedStyle(cells[index]).textAlign }));
  });
  expect(columnGeometry).toHaveLength(5);
  for (const column of columnGeometry) {
    expect(column.delta).toBeLessThanOrEqual(1);
    expect(column.headerAlign.replace('start', 'left').replace('end', 'right')).toBe(column.cellAlign.replace('start', 'left').replace('end', 'right'));
  }
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-column-alignment.json`), JSON.stringify(columnGeometry, null, 2));
  await expect(coordinator.getByRole('heading', { name: /^Chi tiết định lượng nguyên liệu/ })).toHaveCount(0);
  await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-review-source-details.png`) });
  await coordinator.getByRole('button', { name: 'Quay lại thực đơn' }).click();
  await expect(savory.first()).toHaveValue(firstSavoryValue);
  await expect(coordinator.getByRole('button', { name: /Tiếp tục xem ảnh hưởng|Kiểm tra số suất/ })).toBeFocused();
  await coordinator.getByRole('button', { name: /Tiếp tục xem ảnh hưởng|Kiểm tra số suất/ }).click();
  await expect(coordinator.getByLabel('Lý do thay đổi nguồn')).toHaveValue(scope.reason);
  await step(coordinator, scope, 'source-submit-review', 'COORDINATOR', async () => {
    const response = coordinator.waitForResponse((item) => item.url().endsWith('/weekly-menu/amendments/mrx-submit') && item.request().method() === 'POST');
    await coordinator.getByRole('button', { name: 'Gửi duyệt', exact: true }).click();
    const result = await response;
    await expect(coordinator.getByText('Đã gửi yêu cầu thay đổi để duyệt.')).toBeVisible();
    return result;
  });
  console.log('[UI] Điều phối: đã nhập số suất → Xem ảnh hưởng → Gửi duyệt.');
  await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-02-source-submitted.png`) });
  await admin.bringToFront();
  await admin.goto(url);
  await admin.getByRole('button', { name: /Yêu cầu chờ duyệt/ }).click();
  const selector = admin.getByLabel('Yêu cầu nguồn cần duyệt');
  if (await selector.isVisible()) {
    const id = await selector.locator('option').filter({ hasText: scope.reason }).getAttribute('value');
    expect(id).toBeTruthy();
    await selector.selectOption(id!);
  }
  await step(admin, scope, 'admin-open-source-approval', 'ADMIN', async () => {
    await admin.getByRole('button', { name: 'Phê duyệt thay đổi', exact: true }).click();
    await expect(admin.getByRole('button', { name: 'Xác nhận phê duyệt', exact: true })).toBeVisible();
  });
  await step(admin, scope, 'admin-confirm-source-approval', 'ADMIN', async () => {
    const response = admin.waitForResponse((item) => item.url().includes('/weekly-menu/amendments/') && item.url().includes('/mrx-decision') && item.request().method() === 'POST');
    await admin.getByRole('button', { name: 'Xác nhận phê duyệt', exact: true }).click();
    const result = await response;
    await expect(admin.getByText('Đã áp dụng thay đổi nguồn.')).toBeVisible();
    return result;
  });
  console.log('[UI] Admin: đã bấm Phê duyệt thay đổi; UI xác nhận đã áp dụng.');
  await admin.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-03-source-approved.png`) });
  await coordinator.bringToFront();
  await coordinator.reload();
  await pages.sourceAccepted?.(coordinator, scope);
  const quantityPreview = await step(coordinator, scope, 'source-check-quantity', 'COORDINATOR', async () => {
    const response = coordinator.waitForResponse((item) => item.url().endsWith('/batches/quantity-import/preview') && item.request().method() === 'POST');
    await coordinator.getByRole('button', { name: 'Lưu & kiểm tra định lượng', exact: true }).click();
    const result = await response;
    await expect(coordinator.getByRole('button', { name: 'Lập lô đối soát', exact: true })).toBeEnabled();
    return result;
  });
  const result = (await step(coordinator, scope, 'source-create-draft-batch', 'COORDINATOR', async () => {
    const created = coordinator.waitForResponse((response) => response.url().endsWith('/api/reconciliation/batches/quantity-import/commit') && response.request().method() === 'POST');
    await coordinator.getByRole('button', { name: 'Lập lô đối soát', exact: true }).click();
    const response = await created;
    await expect(coordinator.getByRole('button', { name: 'Đóng băng lô', exact: true })).toBeEnabled();
    return response;
  }))!;
  expect(result.ok()).toBe(true);
  const batchId = (await result.json()).data?.reconciliationBatchId as string;
  expect(batchId).toBeTruthy();
  if (pages.stopAtDraft) {
    const menuVersionId = quantityPreview!.request().postDataJSON().menuVersionId as string;
    expect(menuVersionId).toBeTruthy();
    return { batchId, menuVersionId };
  }
  for (const [action, label] of [['ready', 'Đóng băng lô'], ['transfer-to-warehouse', 'Chuyển sang Kho']]) {
    await step(coordinator, scope, `source-${action}`, 'COORDINATOR', async () => {
      const response = coordinator.waitForResponse((item) => item.url().endsWith(`/api/reconciliation/batches/${batchId}/${action}`) && item.request().method() === 'POST');
      await coordinator.getByRole('button', { name: label, exact: true }).click();
      const result = await response;
      expect(result.ok()).toBe(true);
      await expect(coordinator.getByRole('button', { name: label, exact: true })).toBeHidden();
      return result;
    }, { batchId });
    if (action === 'transfer-to-warehouse') await pages.afterTransfer?.();
    console.log(`[UI] Điều phối: đã bấm ${label}; server xác nhận thành công.`);
  }
  if (!pages.sourceScenario) {
  await expect(coordinator.getByRole('cell', { name: /Trái cây, 6 ngày, 1 loại món/ }).first()).toHaveAttribute('colspan', '6');
  const vertical = coordinator.getByRole('cell', { name: `${mainDishName}, 1 ngày, 2 loại món`, exact: true });
  await expect(vertical).toHaveAttribute('rowspan', '2');
  const verticalGeometry = await vertical.evaluate((cell) => {
    const row = cell.closest('tr')!;
    return { rowSpan: (cell as HTMLTableCellElement).rowSpan, cellHeight: cell.getBoundingClientRect().height, rowsHeight: row.getBoundingClientRect().height + row.nextElementSibling!.getBoundingClientRect().height };
  });
  expect(Math.abs(verticalGeometry.cellHeight - verticalGeometry.rowsHeight)).toBeLessThanOrEqual(1);
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-vertical-merge.json`), JSON.stringify(verticalGeometry, null, 2));
  const desktopMeasurements = [];
  for (const [width, height] of [[960, 720], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    await coordinator.setViewportSize({ width, height });
    const measurement = await coordinator.evaluate(() => ({
      width: innerWidth, height: innerHeight, pageOverflow: document.documentElement.scrollWidth - innerWidth,
      matrixWidth: document.querySelector('[aria-label="Bảng sửa nguồn MRX"]')!.getBoundingClientRect().width,
    }));
    expect(measurement.pageOverflow).toBeLessThanOrEqual(0);
    for (const control of await coordinator.locator('header').getByRole('button').all()) {
      await expect(control).toBeInViewport({ ratio: 1 });
      await control.click({ trial: true });
    }
    for (const name of ['Món & BOM đã đóng băng', 'Nhập thực đơn mới', 'Chỉnh sửa món']) {
      const control = coordinator.getByRole('button', { name, exact: true });
      await expect(control).toBeInViewport({ ratio: 1 });
      await control.click({ trial: true });
    }
    await expect(coordinator.getByRole('button', { name: 'Nhập Excel', exact: true })).toHaveCount(0);
    await expect(coordinator.getByRole('combobox', { name: 'Chọn khách hàng MRX' })).toBeInViewport({ ratio: 1 });
    await expect(coordinator.getByLabel('Tuần MRX bắt đầu', { exact: true })).toBeInViewport({ ratio: 1 });
    desktopMeasurements.push(measurement);
    await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-matrix-${width}x${height}.png`) });
  }
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-desktop-layout.json`), JSON.stringify(desktopMeasurements, null, 2));
  await coordinator.setViewportSize({ width: 1280, height: 720 });
  console.log('[UI] Ma trận thật gộp ngang 6 ngày, dọc 2 slot sau duyệt/reload; cột khớp <=1px; lệnh không bị che tại 960–1920px.');
  await coordinator.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${artifactPrefix}-04-transferred.png`) });
  }
  // Approval creates a new source revision; the batch uses the quantity-preview request, not the original import.
  const menuVersionId = quantityPreview!.request().postDataJSON().menuVersionId as string;
  expect(menuVersionId).toBeTruthy();
  return { batchId, menuVersionId };
}

export function writeBomImportWorkbook(file: string, rows: { dishCode: string; ingredientCode: string; ingredientName?: string; unitCode: string; quantity: string; status: string; date: string; note: string }[]): void {
  const headers = ['Mã món', 'Tên món', 'Mức giá', 'Khách hàng', 'Tên nguyên liệu', 'Đơn vị', 'Định lượng/suất', 'Hao hụt (%)', 'Hiệu lực từ', 'Hiệu lực đến', 'Trạng thái', 'Ghi chú', 'Mã nguyên liệu'];
  const values = rows.map(row => [row.dishCode, '', 25000, '', row.ingredientName ?? '', row.unitCode, Number(row.quantity), 0, row.date, row.date, row.status, row.note, row.ingredientCode]);
  if (values.some(row => !Number.isFinite(row[6]) || Number(row[6]) <= 0)) throw new Error('BOM fixture requires a positive finite quantity.');
  const escape = (value: unknown) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + [headers, ...values].map((row, index) =>
    `<row r="${index + 1}">` + row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${index + 1}" t="${typeof value === 'number' ? 'n' : 'inlineStr'}">` + (typeof value === 'number' ? `<v>${value}</v>` : `<is><t>${escape(value)}</t></is>`) + '</c>').join('') + '</row>').join('') + '</sheetData></worksheet>';
  const entries = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BOM" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
  };
  const payload = Buffer.from(JSON.stringify(entries), 'utf8').toString('base64');
  const literal = `'${file.replace(/'/g, "''")}'`;
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $entries=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json; $z=[IO.Compression.ZipFile]::Open(${literal},[IO.Compression.ZipArchiveMode]::Create); try {foreach($entry in $entries.PSObject.Properties){$w=[IO.StreamWriter]::new($z.CreateEntry($entry.Name).Open(),[Text.UTF8Encoding]::new($false)); try {$w.Write([string]$entry.Value)} finally {$w.Dispose()}}} finally {$z.Dispose()}`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { stdio: 'pipe', timeout: 15_000 });
}

export function parseCookingFile(file: string, format: 'csv' | 'xlsx', sheet: 1 | 2 | 3 = 1): string[][] {
  const literal = `'${file.replace(/'/g, "''")}'`;
  const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ` + (format === 'csv'
    ? `$rows=@(Import-Csv -LiteralPath ${literal} -Encoding UTF8); if($rows.Count -eq 0){throw 'Empty CSV'}; $result=[Collections.Generic.List[object]]::new(); $result.Add([string[]]@($rows[0].PSObject.Properties.Name)); foreach($r in $rows){$result.Add([string[]]@($r.PSObject.Properties.Value))}; ConvertTo-Json -InputObject $result.ToArray() -Depth 4 -Compress`
    : `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead(${literal}); try{$entry=$z.GetEntry('xl/worksheets/sheet${sheet}.xml'); if(!$entry){throw 'Missing worksheet'}; $reader=[IO.StreamReader]::new($entry.Open()); try{[xml]$xml=$reader.ReadToEnd()}finally{$reader.Dispose()}; $result=[Collections.Generic.List[object]]::new(); foreach($r in $xml.worksheet.sheetData.row){$result.Add([string[]]@($r.c | ForEach-Object { if($_.t -eq 'inlineStr' -and !$_.f){[string]$_.SelectSingleNode('*[local-name()="is"]/*[local-name()="t"]').InnerText} elseif($_.t -eq 'n' -and !$_.f){[string]$_.v} else {throw 'Unexpected cell type or formula'} }))}; ConvertTo-Json -InputObject $result.ToArray() -Depth 4 -Compress}finally{$z.Dispose()}`);
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile','-EncodedCommand', Buffer.from(script,'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 15_000 }));
}
