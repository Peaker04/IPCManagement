import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, parseCookingFile, scenarioScope } from '../fixtures/mrxWorkflow';
import { writeMenuCoverage, type CoverageDish, type CoverageSource } from '../fixtures/menuCoverage';
import { assertKitchenWorkbook } from '../fixtures/kitchenWorkbook';

test('@T7-Export-Consistency three same-week customers download purchasing and kitchen sheets', async ({ adminPage, dieuphoiPage, thukhoPage, beptruongPage, dbVerifier }) => {
  test.setTimeout(480_000);
  const scope = scenarioScope(dbVerifier, 32);
  const customers = dbVerifier.query<{ id: string; name: string; code: string }>("SELECT HEX(customerId) AS id, customerName AS name, customerCode AS code FROM customers WHERE isActive=1 ORDER BY customerCode LIMIT 3").map(customer => {
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
    customers.push({ id: created.data.customerId, name: created.data.customerName, code: customerCode });
  }
  expect(customers).toHaveLength(3);
  const lastDate = new Date(scope.weekStartDate);
  lastDate.setUTCDate(lastDate.getUTCDate() + 5);
  const end = lastDate.toISOString().slice(0, 10);
  const rows = dbVerifier.query<{ fact: string }>(`SELECT JSON_OBJECT('code',d.dishCode,'name',d.dishName,
    'tags',CONCAT_WS(' ',d.dishName,d.dishGroup,d.dishType),
    'materials',(SELECT JSON_ARRAYAGG(JSON_OBJECT('ingredientCode',i.ingredientCode,'ingredientName',i.ingredientName,
      'unitName',cu.unitName,'canonicalUnitCode',cu.unitCode,'grossQtyPerServing',CAST(b.grossQtyPerServing AS CHAR),
      'sourceRate',CAST(u.convertRateToBase AS CHAR),'targetRate',CAST(cu.convertRateToBase AS CHAR)))
      FROM dishbom b JOIN ingredients i ON i.ingredientId=b.ingredientId
      JOIN units u ON u.unitId=b.unitId JOIN units cu ON cu.unitId=i.unitId
      WHERE b.dishId=d.dishId AND b.customerId IS NULL AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=25000
      AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${end}'))) AS fact
    FROM dishes d WHERE d.isActive=1 AND EXISTS (SELECT 1 FROM dishbom b WHERE b.dishId=d.dishId
      AND b.customerId IS NULL AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=25000 AND b.effectiveFrom<='${scope.weekStartDate}'
      AND (b.effectiveTo IS NULL OR b.effectiveTo>='${end}'))
    AND NOT EXISTS (SELECT 1 FROM dishbom b JOIN ingredients i ON i.ingredientId=b.ingredientId
      JOIN units u ON u.unitId=b.unitId JOIN units cu ON cu.unitId=i.unitId
      WHERE b.dishId=d.dishId AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=25000 AND b.effectiveFrom<='${end}'
      AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}')
      AND (b.customerId IS NOT NULL OR u.convertRateToBase<=0 OR cu.convertRateToBase<=0
        OR (b.unitId<>i.unitId AND (COALESCE(TRIM(u.baseUnitCode),'')='' OR COALESCE(u.baseUnitCode,'')<>COALESCE(cu.baseUnitCode,'')))
        OR b.grossQtyPerServing<=0 OR b.effectiveFrom>'${scope.weekStartDate}' OR b.effectiveTo<'${end}'))
    ORDER BY d.dishCode;`);
  type Dish = Omit<CoverageDish, 'materials'> & { materials: (CoverageDish['materials'][number] & { ingredientName: string; unitName: string })[] };
  const catalog: Dish[] = rows.map(row => {
    const { tags, ...dish } = JSON.parse(row.fact) as Omit<Dish, 'variant'> & { tags: string };
    // Keep the Vietnamese distinction between "chay" and "cháy", regardless of database collation.
    return { ...dish, variant: /(^|[^\p{L}])chay(?=$|[^\p{L}])/iu.test(tags) ? 'vegetarian' : 'savory' };
  });
  const recipes = (['savory', 'vegetarian'] as const).flatMap(variant => {
    const candidates = catalog.filter(dish => dish.variant === variant
      && catalog.filter(candidate => candidate.name === dish.name).length === 1
      && new Set(dish.materials.map(material => material.ingredientCode)).size === dish.materials.length)
      .sort((a, b) => b.materials.length - a.materials.length);
    expect(candidates.length, `Real shared 25k BOMs for ${variant}`).toBeGreaterThanOrEqual(variant === 'savory' ? 6 : 2);
    if (candidates.length <= 10) return candidates;
    const middle = Math.floor(candidates.length / 2);
    return [...candidates.slice(0, 2), ...candidates.slice(middle - 2, middle + 2), ...candidates.slice(-4)];
  });
  const orders = customers.map((customer, index) => ({
    customer, manifest: writeMenuCoverage({ ...scope, caseId: `${scope.caseId}_${index}`,
      workbook: scope.workbook.replace(/\.xlsx$/, `-${index}.xlsx`) }, recipes, index),
  }));
  const batches: Awaited<ReturnType<typeof createTransferredBatch>>[] = [];
  for (const [index, { customer, manifest }] of orders.entries()) {
    const batch = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, sourceScenario: async page => {
      const savory = page.getByRole('spinbutton', { name: /Số suất Mặn/ });
      const vegetarian = page.getByRole('spinbutton', { name: /Số suất Chay/ });
      await expect(savory).toHaveCount(12);
      await expect(vegetarian).toHaveCount(12);
      for (const row of manifest.servings) {
        const label = `${row.date.slice(5).split('-').reverse().join('/')} ${row.shift === 'MORNING' ? 'Sáng' : 'Chiều'}`;
        await page.getByRole('spinbutton', { name: `Số suất Mặn ${label}`, exact: true }).fill(String(row.savory));
        await page.getByRole('spinbutton', { name: `Số suất Chay ${label}`, exact: true }).fill(String(row.vegetarian));
      }
    } }, {
      ...scope, workbook: manifest.workbook, caseId: `${scope.caseId}_${index}`, reason: `${scope.reason} customer ${index}`, customer: { customerId: customer.id, label: customer.name },
    });
    batches.push(batch);
    expect(batch.menuVersionId).toMatch(/^[a-f0-9-]{36}$/i);
    const bytes = Buffer.from(batch.menuVersionId.replace(/-/g, ''), 'hex');
    const versionHex = Buffer.concat([bytes.subarray(0, 4).reverse(), bytes.subarray(4, 6).reverse(),
      bytes.subarray(6, 8).reverse(), bytes.subarray(8)]).toString('hex');
    const facts = dbVerifier.query<CoverageSource>(`SELECT CAST(s.serviceDate AS CHAR) AS date,s.shiftName AS shift,
      IF(m.dishSlot LIKE 'vegetarian-%','vegetarian','savory') AS variant,SUBSTRING_INDEX(m.dishSlot,'-',-1) AS slot,d.dishCode AS dishCode
      FROM menuschedules s JOIN menuitems m ON m.menuId=s.menuId JOIN dishes d ON d.dishId=m.dishId
      WHERE s.menuVersionId=UNHEX('${versionHex}');`);
    const keys = (items: CoverageSource[]) => items.map(row => `${row.date}/${row.shift}/${row.variant}/${row.slot}/${row.dishCode}`).sort();
    expect(manifest.source).toHaveLength(120);
    expect(keys(facts), `Every persisted slot for ${customer.code}`).toEqual(keys(manifest.source));
  }
  const trigger = thukhoPage.getByRole('button', { name: /^Khách hàng:/ });
  const downloadButton = thukhoPage.getByRole('button', { name: 'Xuất nhu cầu theo NCC', exact: true });
  const open = (range: 'week' | 'day') => thukhoPage.goto(`/warehouse?view=mrx-preparation&date=${scope.weekStartDate}&range=${range}`);
  const download = async (label: string, indices: number[], range: 'week' | 'day') => {
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
    expect(new URL(received.url()).searchParams.get('layout')).toBe('supplier-demand');
    const file = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${label}.xlsx`);
    await (await event).saveAs(file);
    const materials = parseCookingFile(file, 'xlsx', 1);
    expect(materials[3]).toEqual(['Nguyên liệu', 'ĐVT', 'Tổng nhu cầu']);
    for (const i of indices) expect(materials[2][0]).toContain(customers[i].name);
    expect(materials[1][0]).toContain(scope.weekStartDate.split('-').reverse().join('/'));
    if (range === 'day' && indices.length === 3) expect(() => parseCookingFile(file, 'xlsx', 2)).toThrow('Missing worksheet');
    return materials.slice(4);
  };
  const totals = (parts: string[][][]) => {
    const result = new Map<string, number>();
    for (const rows of parts) {
      let supplier = '';
      for (const row of rows) {
        if (row[0]?.startsWith('NHÀ CUNG CẤP:') || row[0]?.startsWith('CẦN XÁC MINH NCC:')) supplier = row[0];
        if (row.length !== 3) continue;
        const key = JSON.stringify([supplier, row[0], row[1]]);
        result.set(key, (result.get(key) ?? 0) + Math.round(Number(row[2]) * 1_000_000));
      }
    }
    return [...result].sort();
  };
  for (const range of ['week', 'day'] as const) {
    await open(range);
    const combined = await download(`three-customers-${range}`, [0, 1, 2], range);
    const reduced = await download(`two-of-three-${range}`, [0, 1], range);
    const singles = [];
    for (let i = 0; i < 3; i++) singles.push(await download(`customer-${i + 1}-${range}`, [i], range));

    expect(totals([combined])).toEqual(totals(singles));
    expect(totals([reduced])).toEqual(totals(singles.slice(0, 2)));
  }

  await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${batches[0].batchId}`);
  await beptruongPage.getByRole('button', { name: 'Xuất phiếu nấu Excel', exact: true }).click();
  const dialog = beptruongPage.getByRole('dialog', { name: 'Xuất phiếu nấu Excel' });
  await expect(dialog.getByRole('checkbox', { name: /lô đang xem/ })).toBeChecked();
  for (const choice of await dialog.getByRole('checkbox').all()) await choice.check();
  await dialog.getByRole('combobox', { name: 'Ngày phục vụ' }).selectOption(scope.weekStartDate);
  await dialog.getByRole('combobox', { name: 'Ca phục vụ' }).selectOption('MORNING');
  const cookingResponse = beptruongPage.waitForResponse(response => new URL(response.url()).pathname.endsWith('/reconciliation/kitchen-cooking/xlsx'));
  const cookingDownload = beptruongPage.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Tải Excel · 3 lô' }).click();
  const response = await cookingResponse;
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).searchParams.getAll('batchIds').sort()).toEqual(batches.map(batch => batch.batchId).sort());
  const cookingFile = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'three-customers-cooking.xlsx');
  await (await cookingDownload).saveAs(cookingFile);
  const cooking = parseCookingFile(cookingFile, 'xlsx');
  expect(cooking[0]).toEqual(['Món', 'Tổng suất', 'Nguyên liệu · ĐVT', 'Định lượng / suất', 'Tổng cần', 'Số suất theo khách', '', '', 'Ghi chú']);
  expect(cooking[1].slice(5, 8).sort()).toEqual(customers.map(customer => customer.code).sort());
  assertKitchenWorkbook(cookingFile, orders, recipes, { date: scope.weekStartDate, shift: 'MORNING' });

  await beptruongPage.getByRole('button', { name: 'Xuất phiếu nấu Excel', exact: true }).click();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  for (const choice of await dialog.getByRole('checkbox').all()) await choice.check();
  await dialog.getByRole('combobox', { name: 'Ngày phục vụ' }).selectOption('');
  await dialog.getByRole('combobox', { name: 'Ca phục vụ' }).selectOption('ALL');
  const weeklyDownload = beptruongPage.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Tải Excel · 3 lô' }).click();
  const weeklyFile = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'three-customers-cooking-week.xlsx');
  await (await weeklyDownload).saveAs(weeklyFile);
  const week = parseCookingFile(weeklyFile, 'xlsx');
  expect(week.some(row => /\n(?:Công thức|Cụm) \d+/.test(row[0]))).toBe(false);
  const coverage = assertKitchenWorkbook(weeklyFile, orders, recipes);
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'kitchen-workbook-coverage.json'), JSON.stringify(coverage, null, 2));
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
