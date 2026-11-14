import fs from 'node:fs';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope, parseCookingFile } from '../fixtures/mrxWorkflow';

function binaryId(value: string): string {
  const [a, b, c, d, e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}

test('@G6-Menu-Reimport current-week file import closes at READY while source editing remains available', async ({
  adminPage, dieuphoiPage, dbVerifier,
}) => {
  test.setTimeout(240_000);
  const scope = scenarioScope(dbVerifier, 28);
  const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, stopAtDraft: true,
    afterPublish: async (page, publishedScope) => {
      const count = () => dbVerifier.query<{ count: string }>(`SELECT COUNT(*) AS count FROM reconciliationbatches b JOIN menuversions v ON v.MenuVersionId=b.MenuVersionId WHERE v.WeekStartDate='${publishedScope.weekStartDate}';`)[0].count;
      expect(count()).toBe('0');
      const before = dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,reconciliationbatches;');
      await page.getByRole('button', { name: 'Nhập Excel', exact: true }).first().click();
      await page.getByRole('combobox', { name: 'Phạm vi nhập Excel' }).selectOption('current-week');
      await page.setInputFiles('input[type="file"]', publishedScope.workbook);
      await page.locator('button[role="radio"]:has-text("25.000")').click();
      const preview = page.waitForResponse(response => response.url().endsWith('/weekly-menu/import/preview') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      expect((await preview).status()).toBe(200);
      const commit = page.waitForResponse(response => response.url().endsWith('/weekly-menu/import/commit') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click();
      const response = await commit;
      expect(response.status(), await response.text()).toBe(200);
      const menuVersionId = (await response.json()).data?.menuVersionId as string;
      expect(menuVersionId).toBeTruthy();
      expect(count()).toBe('0');
      expect(dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,reconciliationbatches;')).not.toEqual(before);
      const customerId = await page.getByRole('combobox', { name: 'Chọn khách hàng MRX' }).inputValue();
      await adminPage.goto('/admin-data?view=bom');
      const templates = await adminPage.evaluate(async ({ customerId, weekStartDate, menuVersionId }) => {
        const read = async (params: Record<string, string>) => {
          const response = await fetch(`/api/Dishes/bom-template?${new URLSearchParams(params)}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
          });
          return { status: response.status, bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
        };
        return {
          scoped: await read({ TemplateType: 'mrx-missing', PriceTier: '25000', CustomerId: customerId, WeekStartDate: weekStartDate, MenuVersionId: menuVersionId }),
          catalog: await read({ TemplateType: 'missing', PriceTier: '25000', CustomerId: customerId, EffectiveDate: weekStartDate }),
        };
      }, { customerId, weekStartDate: publishedScope.weekStartDate, menuVersionId });
      expect(templates.scoped.status).toBe(200);
      expect(templates.catalog.status).toBe(200);
      const directory = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
      const scopedFile = `${directory}/missing-bom-mrx-week.xlsx`;
      const catalogFile = `${directory}/missing-bom-catalog.xlsx`;
      fs.writeFileSync(scopedFile, Buffer.from(templates.scoped.bytes));
      fs.writeFileSync(catalogFile, Buffer.from(templates.catalog.bytes));
      const scopedCodes = new Set(parseCookingFile(scopedFile, 'xlsx').slice(4).map(row => row[6]).filter(Boolean));
      const catalogCodes = new Set(parseCookingFile(catalogFile, 'xlsx').slice(4).map(row => row[6]).filter(Boolean));
      const scheduledCodes = new Set(dbVerifier.query<{ code: string }>(`SELECT DISTINCT d.DishCode AS code FROM menuschedules s JOIN menuitems i ON i.MenuId=s.MenuId JOIN dishes d ON d.DishId=i.DishId WHERE s.MenuVersionId=UNHEX('${binaryId(menuVersionId)}');`).map(row => row.code));
      expect([...scopedCodes].every(code => scheduledCodes.has(code))).toBe(true);
      const outsideCode = [...catalogCodes].find(code => !scheduledCodes.has(code));
      expect(outsideCode).toBeTruthy();
      fs.writeFileSync(`${directory}/missing-bom-scope.json`, JSON.stringify({ customerId, weekStartDate: publishedScope.weekStartDate, menuVersionId, scopedStatus: templates.scoped.status, catalogStatus: templates.catalog.status, scopedDishCount: scopedCodes.size, catalogDishCount: catalogCodes.size, outsideWeekDishCode: outsideCode, scopedOnlyScheduled: true }, null, 2));
      await page.reload();
      await page.screenshot({ path: `${process.env.MRX_E2E_ARTIFACT_DIRECTORY!}/menu-existing-no-batch-reimport.png` });
      const publish = page.getByRole('button', { name: 'Xuất bản thực đơn tuần', exact: true });
      if (await publish.isVisible()) await publish.click();
      fs.writeFileSync(`${process.env.MRX_E2E_ARTIFACT_DIRECTORY!}/menu-existing-no-batch-reimport.json`, JSON.stringify({ weekStartDate: publishedScope.weekStartDate, previewStatus: 200, commitStatus: response.status(), batchCount: count(), sourceChanged: true }, null, 2));
    },
  }, scope);
  const url = `/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}`;
  const checksumSql = 'CHECKSUM TABLE menuversions,menuschedules,menuitems,reconciliationbatches,reconciliationsourcerevisions,reconciliationsourcedeltas;';

  await adminPage.goto(url);
  await expect(adminPage.getByRole('button', { name: 'Nhập Excel', exact: true })).toBeVisible();
  const beforeReimport = dbVerifier.query(checksumSql);
  await adminPage.getByRole('button', { name: 'Nhập Excel', exact: true }).click();
  await expect(adminPage.getByRole('combobox', { name: 'Phạm vi nhập Excel' })).toHaveValue('current-week');
  await adminPage.setInputFiles('input[type="file"]', scope.workbook);
  await adminPage.locator('button[role="radio"]:has-text("25.000")').click();
  const preview = adminPage.waitForResponse(response => response.url().endsWith('/weekly-menu/import/preview') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xem trước', exact: true }).click();
  const previewResponse = await preview;
  expect(previewResponse.status(), await previewResponse.text()).toBe(200);
  expect(dbVerifier.query(checksumSql)).toEqual(beforeReimport);
  const commit = adminPage.waitForResponse(response => response.url().endsWith('/weekly-menu/import/commit') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
  const commitResponse = await commit;
  expect(commitResponse.status(), await commitResponse.text()).toBe(200);
  expect((await commitResponse.json()).data?.mrxSourceChange?.status).toBe('EXECUTED');
  expect(dbVerifier.query(checksumSql)).not.toEqual(beforeReimport);
  expect(dbVerifier.query<{ mode: string }>(`SELECT ApplyMode AS mode FROM reconciliationsourcerevisions WHERE BatchId=UNHEX('${binaryId(batchId)}') ORDER BY RevisionNumber;`))
    .toEqual([{ mode: 'REIMPORT' }]);

  await dieuphoiPage.goto(url);
  const batchRead = dieuphoiPage.waitForResponse(response => response.url().endsWith(`/api/reconciliation/batches/${batchId}`) && response.request().method() === 'GET');
  await dieuphoiPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
  expect((await batchRead).status()).toBe(200);
  const ready = dieuphoiPage.waitForResponse(response => response.url().endsWith(`/api/reconciliation/batches/${batchId}/ready`) && response.request().method() === 'POST');
  await dieuphoiPage.getByRole('button', { name: 'Đóng băng lô', exact: true }).click();
  const readyResponse = await ready;
  expect(readyResponse.status(), await readyResponse.text()).toBe(200);
  const afterReady = dbVerifier.query(checksumSql);

  await adminPage.goto(url);
  await adminPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Nhập thực đơn mới', exact: true })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Chỉnh sửa món', exact: true })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Nhập Excel', exact: true })).toHaveCount(0);
  const customerId = await adminPage.getByRole('combobox', { name: 'Chọn khách hàng MRX' }).inputValue();
  await adminPage.getByRole('button', { name: 'Nhập thực đơn mới', exact: true }).click();
  await expect(adminPage.getByRole('combobox', { name: 'Phạm vi nhập Excel' })).toHaveCount(0);
  await expect(adminPage.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');

  const blocked = await adminPage.evaluate(async ({ bytes, name, customerId, weekStartDate }) => {
    const body = new FormData();
    body.append('file', new File([new Uint8Array(bytes)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    body.append('customerId', customerId);
    body.append('weekStartDate', weekStartDate);
    body.append('priceTierAmount', '25000');
    const response = await fetch('/api/coordination/weekly-menu/import/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      body,
    });
    return { status: response.status, body: await response.json() };
  }, { bytes: Array.from(fs.readFileSync(scope.workbook)), name: 'same-week.xlsx', customerId, weekStartDate: scope.weekStartDate });
  expect(blocked.status).toBe(409);
  expect(blocked.body.code).toBe('MRX_REIMPORT_CLOSED');
  expect(dbVerifier.query(checksumSql)).toEqual(afterReady);
});

test('@G6-Menu-Reimport transferred batch rejects same-week Excel without changing source', async ({ adminPage, dieuphoiPage, dbVerifier }) => {
  test.setTimeout(240_000);
  const scope = scenarioScope(dbVerifier, 30);
  const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  const checksumSql = 'CHECKSUM TABLE menuversions,menuschedules,menuitems,reconciliationbatches,reconciliationsourcerevisions,reconciliationsourcedeltas,inventoryissues,stockmovements;';
  const before = dbVerifier.query(checksumSql);
  await adminPage.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}`);
  const batchRead = adminPage.waitForResponse(response => response.url().endsWith(`/api/reconciliation/batches/${batchId}`) && response.request().method() === 'GET');
  await adminPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
  expect((await batchRead).status()).toBe(200);
  await expect(adminPage.getByText('Đã chuyển Kho', { exact: true })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Nhập Excel', exact: true })).toHaveCount(0);
  await expect(adminPage.getByRole('button', { name: 'Chỉnh sửa món', exact: true })).toBeVisible();
  await adminPage.screenshot({ path: `${process.env.MRX_E2E_ARTIFACT_DIRECTORY!}/menu-transferred-edit-only.png` });
  const customerId = await adminPage.getByRole('combobox', { name: 'Chọn khách hàng MRX' }).inputValue();
  expect(customerId).toBeTruthy();
  const blocked = await adminPage.evaluate(async ({ bytes, name, customerId, weekStartDate }) => {
    const body = new FormData();
    body.append('file', new File([new Uint8Array(bytes)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    body.append('customerId', customerId);
    body.append('weekStartDate', weekStartDate);
    body.append('priceTierAmount', '25000');
    const response = await fetch('/api/coordination/weekly-menu/import/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      body,
    });
    return { status: response.status, body: await response.json() };
  }, { bytes: Array.from(fs.readFileSync(scope.workbook)), name: 'transferred-same-week.xlsx', customerId, weekStartDate: scope.weekStartDate });
  expect(blocked.status).toBe(409);
  expect(blocked.body.code).toBe('MRX_REIMPORT_CLOSED');
  expect(dbVerifier.query(checksumSql)).toEqual(before);
  fs.writeFileSync(`${process.env.MRX_E2E_ARTIFACT_DIRECTORY!}/menu-transferred-reimport-blocked.json`, JSON.stringify({ batchId, weekStartDate: scope.weekStartDate, status: blocked.status, code: blocked.body.code, sourceUnchanged: true }, null, 2));
});
