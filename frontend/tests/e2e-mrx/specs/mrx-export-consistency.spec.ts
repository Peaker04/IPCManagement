import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, parseCookingFile, scenarioScope } from '../fixtures/mrxWorkflow';

test('@T7-Export-Consistency three same-week customers download purchasing and kitchen sheets', async ({ adminPage, dieuphoiPage, thukhoPage, dbVerifier }) => {
  test.setTimeout(480_000);
  const scope = scenarioScope(dbVerifier, 32);
  const customers = dbVerifier.query<{ id: string; name: string }>("SELECT HEX(customerId) AS id, customerName AS name FROM customers WHERE isActive=1 ORDER BY customerCode LIMIT 3").map(customer => {
    const bytes = Buffer.from(customer.id, 'hex');
    const hex = (start: number, end: number, reverse = false) => {
      const part = Buffer.from(bytes.subarray(start, end));
      return (reverse ? part.reverse() : part).toString('hex');
    };
    return { ...customer, id: [hex(0, 4, true), hex(4, 6, true), hex(6, 8, true), hex(8, 10), hex(10, 16)].join('-') };
  });
  if (customers.length === 2) {
    expect(process.env.MRX_E2E_PROFILE).toBe('qualification');
    const customerCode = `EX${scope.runId.replace(/[^a-z0-9]/gi, '')}`.toUpperCase();
    const created = await adminPage.evaluate(async body => {
      const response = await fetch('/api/coordination/customers/contract', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: (await response.json()).data };
    }, { customerCode, customerName: `Khách nghiệm thu ${customerCode}`, isActive: true });
    expect(created.status).toBe(201);
    customers.push({ id: created.data.customerId, name: created.data.customerName });
  }
  expect(customers).toHaveLength(3);
  const batches = [];
  for (const [index, customer] of customers.entries()) {
    batches.push(await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, sourceScenario: async page => {
      const savory = page.getByRole('spinbutton', { name: /Số suất Mặn/ });
      const vegetarian = page.getByRole('spinbutton', { name: /Số suất Chay/ });
      await expect(savory).toHaveCount(12);
      await expect(vegetarian).toHaveCount(12);
      for (const servings of await savory.all()) await servings.fill(String(17 + 13 * index));
      for (const servings of await vegetarian.all()) await servings.fill(String(5 + index));
    } }, {
      ...scope, caseId: `${scope.caseId}_${index}`, reason: `${scope.reason} customer ${index}`, customer: { customerId: customer.id, label: customer.name },
    }));
  }
  const trigger = thukhoPage.getByRole('button', { name: /^Khách hàng:/ });
  const downloadButton = thukhoPage.getByRole('button', { name: 'Xuất Excel chuẩn bị', exact: true });
  const open = (range: 'week' | 'day') => thukhoPage.goto(`/warehouse?view=mrx-preparation&date=${scope.weekStartDate}&range=${range}`);
  const download = async (label: string, indices: number[], range: 'week' | 'day') => {
    await open(range);
    await expect(downloadButton).toBeEnabled();
    await trigger.click();
    const choices = thukhoPage.getByRole('group', { name: 'Các lô trong phạm vi chuẩn bị' }).getByRole('checkbox');
    await expect(choices).toHaveCount(3);
    for (const [index, customer] of customers.entries()) {
      const choice = thukhoPage.locator('fieldset label').filter({ hasText: customer.name }).getByRole('checkbox');
      await choice.setChecked(indices.includes(index));
    }
    await thukhoPage.keyboard.press('Escape');
    const response = thukhoPage.waitForResponse(r => new URL(r.url()).pathname.endsWith('/preparation/export-workbook'));
    const event = thukhoPage.waitForEvent('download');
    await downloadButton.click();
    const received = await response;
    expect(received.ok()).toBeTruthy();
    expect(new URL(received.url()).searchParams.getAll('batchIds').sort()).toEqual(indices.map(i => batches[i].batchId).sort());
    const file = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${label}.xlsx`);
    await (await event).saveAs(file);
    const materials = parseCookingFile(file, 'xlsx', 1);
    const menu = parseCookingFile(file, 'xlsx', 2);
    expect(materials[3]).toEqual(['Nguyên liệu', 'ĐVT', 'Tổng nhu cầu', 'Còn thiếu', 'Cấp ngoài nhu cầu']);
    expect(menu[2]).toEqual(['Khách hàng', 'Ngày', 'Ca', 'Loại thực đơn', 'Món', 'Số suất']);
    expect(new Set(menu.slice(3).map(row => row[0])).size).toBe(indices.length);
    for (const i of indices) expect(materials[2][0]).toContain(customers[i].name);
    if (range === 'day') expect(new Set(menu.slice(3).map(row => row[1]))).toEqual(new Set([scope.weekStartDate.split('-').reverse().join('/')]));
    return { materials: materials.slice(4), menu: menu.slice(3) };
  };
  const totals = (parts: string[][][]) => {
    const result = new Map<string, number>();
    for (const rows of parts) {
      let group = '', supplier = '';
      for (const row of rows) {
        if (row[0]?.startsWith('NHÓM CUNG ỨNG:')) group = row[0];
        if (row[0]?.startsWith('NHÀ CUNG CẤP:')) supplier = row[0];
        if (row.length !== 5) continue;
        expect(Number(row[3])).toBe(Number(row[2]));
        expect(Number(row[4])).toBe(0);
        const key = JSON.stringify([group, supplier, row[0], row[1]]);
        result.set(key, (result.get(key) ?? 0) + Math.round(Number(row[2]) * 1_000_000));
      }
    }
    return [...result].sort();
  };
  const combined = await download('three-customers-week', [0, 1, 2], 'week');
  const singles = [];
  for (let i = 0; i < 3; i++) singles.push(await download(`customer-${i + 1}-week`, [i], 'week'));
  expect(totals([combined.materials])).toEqual(totals(singles.map(row => row.materials)));
  expect(combined.menu.map(row => JSON.stringify(row)).sort()).toEqual(singles.flatMap(row => row.menu).map(row => JSON.stringify(row)).sort());
  const reduced = await download('two-of-three-week', [0, 1], 'week');
  expect(totals([reduced.materials])).toEqual(totals(singles.slice(0, 2).map(row => row.materials)));
  expect(reduced.menu.map(row => JSON.stringify(row)).sort()).toEqual(singles.slice(0, 2).flatMap(row => row.menu).map(row => JSON.stringify(row)).sort());
  await download('three-customers-day', [0, 1, 2], 'day');
});

test('@T7-Export-Consistency setup one real transferred source', async ({ adminPage, dieuphoiPage, dbVerifier }) => {
  test.setTimeout(300_000);
  const scope = scenarioScope(dbVerifier, 30);
  const batch = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  const currentCustomer = await dieuphoiPage.getByLabel('Chọn khách hàng MRX', { exact: true }).inputValue();
  const otherCustomer = await dieuphoiPage.getByLabel('Chọn khách hàng MRX', { exact: true }).locator('option').evaluateAll((options, current) =>
    options.map(option => ({ customerId: (option as HTMLOptionElement).value, label: option.textContent?.trim() || '' }))
      .find(option => /^[0-9a-f-]{36}$/i.test(option.customerId) && option.customerId !== current), currentCustomer);
  let otherBatchId: string | null = null;
  if (otherCustomer) {
    const otherScope = scenarioScope(dbVerifier, 31);
    otherScope.customer = otherCustomer;
    const other = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, sourceScenario: async page => {
      await expect(page.getByRole('spinbutton', { name: /Số suất Mặn/ })).toHaveCount(12);
      await expect(page.getByRole('spinbutton', { name: /Số suất Chay/ })).toHaveCount(12);
      for (const input of await page.getByRole('spinbutton', { name: /Số suất Mặn/ }).all()) await input.fill('1000');
      for (const input of await page.getByRole('spinbutton', { name: /Số suất Chay/ }).all()) await input.fill('50');
    } }, otherScope);
    otherBatchId = other.batchId;
  }
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'export-scope.json'), JSON.stringify({
    runId: scope.runId, week: scope.weekStartDate, batchId: batch.batchId, otherBatchId,
  }, null, 2));
});
