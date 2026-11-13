import fs from 'node:fs';
import path from 'node:path';
import type { Page, Response } from '@playwright/test';
import { test, expect } from '../fixtures/mrxTest';
import { loginRole, respectApiBudget } from '../fixtures/authHelpers';
import { createTransferredBatch, scenarioScope, parseCookingFile } from '../fixtures/mrxWorkflow';

function binaryId(value: string): string {
  expect(value).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
  const [a, b, c, d, e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}

function micros(value: string): bigint {
  expect(value).toMatch(/^\d+(\.\d{1,6})?$/);
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

test('@G6-Customer-Concurrency two NEW customers keep independent same-week source, issue and export identities', async ({ browser, viewport, baseURL, adminPage, dieuphoiPage, thukhoPage, dbVerifier }) => {
  test.setTimeout(420_000);
  expect(process.env.MRX_E2E_PROFILE, 'New customer fixtures require the admitted Qualification lifecycle').toBe('qualification');
  const scope = scenarioScope(dbVerifier, 20);
  const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  const stocks = () => dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
  const stockBefore = stocks(); // Includes absent stock; never create a stock row for this oracle.
  const customers: { customerId: string; customerCode: string; customerName: string }[] = [];
  for (const suffix of ['A', 'B']) {
    const customerCode = `WC${scope.caseId.replace(/[^a-z0-9]/gi, '')}${suffix}`.toUpperCase();
    const customerName = `MRX concurrent ${customerCode}`;
    const result = await adminPage.evaluate(async (body) => {
      const response = await fetch('/api/coordination/customers/contract', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, { customerCode, customerName, isActive: true });
    expect(result.status).toBe(201);
    const customer = result.body.data;
    expect(customer.customerCode).toBe(customerCode);
    expect(customer.customerName).toBe(customerName);
    expect(dbVerifier.query(`SELECT customerCode AS code FROM customers WHERE customerId=UNHEX('${binaryId(customer.customerId)}');`)).toEqual([{ code: customerCode }]);
    customers.push(customer);
  }
  expect(new Set(customers.map((customer) => customer.customerId)).size).toBe(2);
  const contexts = [];
  const barriers: { name: string; samples: { arrivedAt: number; dispatchedAt?: number; respondedAt?: number; status?: number }[]; releasedAt?: number; timedOut: boolean }[] = [];
  const cleanups: (() => Promise<void>)[] = [];
  try {
    // Separate authenticated sessions; same role identities, not extra grants or fake actors.
    for (const role of ['dieuphoi', 'admin', 'thukho'] as const) {
      const context = await browser.newContext({ viewport, baseURL });
      contexts.push(context);
      const page = await context.newPage();
      await loginRole(page, role, baseURL);
    }
    const coordinators = [dieuphoiPage, contexts[0].pages()[0]];
    const admins = [adminPage, contexts[1].pages()[0]];
    const warehouses = [thukhoPage, contexts[2].pages()[0]];
    async function holdBoth(pages: Page[], pattern: RegExp, name: string) {
      const observation: typeof barriers[number] = { name, samples: [], timedOut: false };
      barriers.push(observation);
      let release!: () => void;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      for (const [index, page] of pages.entries()) {
        const onResponse = (response: Response) => {
          if (pattern.test(response.url()) && response.request().method() === 'POST' && observation.samples[index]) {
            observation.samples[index].respondedAt = Date.now();
            observation.samples[index].status = response.status();
          }
        };
        page.on('response', onResponse);
        await page.route(pattern, async (route) => {
          if (route.request().method() !== 'POST') { await route.continue(); return; }
          expect(observation.samples[index], `${name}: one command per customer`).toBeUndefined();
          observation.samples[index] = { arrivedAt: Date.now() };
          if (!timer) timer = setTimeout(() => { observation.timedOut = true; release(); }, 15_000);
          if (observation.samples.filter(Boolean).length === 2) {
            clearTimeout(timer);
            observation.releasedAt = Date.now();
            release();
          }
          await gate;
          if (observation.timedOut) { await route.abort('timedout'); return; }
          observation.samples[index].dispatchedAt = Date.now();
          await route.continue();
        });
        cleanups.push(async () => { release(); clearTimeout(timer); page.off('response', onResponse); await page.unroute(pattern); });
      }
    }
    await holdBoth(coordinators, /\/weekly-menu\/import\/commit$/, 'import-commit');
    await holdBoth(coordinators, /\/batches\/quantity-import\/commit$/, 'quantity-commit');
    await holdBoth(coordinators, /\/batches\/[^/]+\/transfer-to-warehouse$/, 'transfer');
    const batches = await Promise.all(coordinators.map((coordinator, index) => createTransferredBatch({
      coordinator, admin: admins[index],
      sourceScenario: async (page) => {
        const savory = page.getByRole('spinbutton', { name: /Số suất Mặn/ });
        const vegetarian = page.getByRole('spinbutton', { name: /Số suất Chay/ });
        await expect(savory.first()).toBeVisible();
        expect(await vegetarian.count()).toBeGreaterThan(0);
        for (const input of await savory.all()) await input.fill(String((index + 1) * 100));
        for (const input of await vegetarian.all()) await input.fill(String((index + 1) * 10));
      },
    }, { ...scope, caseId: `${scope.caseId}_${index}`, reason: `${scope.reason} customer ${index}`, customer: { customerId: customers[index].customerId, label: `${customers[index].customerCode} - ${customers[index].customerName}` } })));
    expect(new Set(batches.map((batch) => batch.batchId)).size).toBe(2);
    const batchHex = batches.map((batch) => binaryId(batch.batchId));
    const sourceRows = batches.map((batch, index) => {
      const version = binaryId(batch.menuVersionId), customer = binaryId(customers[index].customerId);
      expect(dbVerifier.query(`SELECT HEX(v.customerId) AS customer, HEX(b.MenuVersionId) AS version FROM reconciliationbatches b JOIN menuversions v ON v.menuVersionId=b.MenuVersionId WHERE b.BatchId=UNHEX('${batchHex[index]}');`)).toEqual([{ customer, version }]);
      expect(dbVerifier.query(`SELECT HEX(customerId) AS customer FROM menuschedules WHERE menuVersionId=UNHEX('${version}') GROUP BY customerId;`)).toEqual([{ customer }]);
      expect(dbVerifier.query(`SELECT HEX(q.customerId) AS customer, CAST(q.savoryServings AS CHAR) AS savory, CAST(q.vegetarianServings AS CHAR) AS vegetarian FROM mealquantityplanlines q JOIN menuschedules s ON s.menuScheduleId=q.menuScheduleId WHERE s.menuVersionId=UNHEX('${version}') GROUP BY q.customerId,q.savoryServings,q.vegetarianServings;`)).toEqual([{ customer, savory: String((index + 1) * 100), vegetarian: String((index + 1) * 10) }]);
      return dbVerifier.query(`SELECT s.serviceDate, s.shiftName, CAST(s.menuPrice AS CHAR) AS price, m.dishSlot, HEX(m.dishId) AS dish FROM menuschedules s JOIN menuitems m ON m.menuId=s.menuId WHERE s.menuVersionId=UNHEX('${version}') ORDER BY s.serviceDate,s.shiftName,m.dishSlot,dish;`);
    });
    expect(sourceRows[1]).toEqual(sourceRows[0]);
    const quantities = batchHex.map((id) => dbVerifier.query<{ date: string; ingredient: string; unit: string; quantity: string }>(`SELECT ServiceDate AS date,HEX(IngredientId) AS ingredient,HEX(CanonicalUnitId) AS unit,CAST(RequiredQuantity AS CHAR) AS quantity FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${id}') AND RequiredQuantity>0 ORDER BY date,ingredient,unit;`));
    expect(quantities[0].length).toBeGreaterThan(0);
    expect(quantities[1].map(({ date, ingredient, unit }) => ({ date, ingredient, unit }))).toEqual(quantities[0].map(({ date, ingredient, unit }) => ({ date, ingredient, unit })));
    for (const [index, batch] of batches.entries()) {
      expect(dbVerifier.query(`SELECT HEX(b.bomId) AS id FROM dishbom b JOIN ingredients i ON i.ingredientId=b.ingredientId JOIN menuitems m ON m.dishId=b.dishId JOIN menuschedules s ON s.menuId=m.menuId WHERE s.menuVersionId=UNHEX('${binaryId(batch.menuVersionId)}') AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=s.menuPrice AND b.effectiveFrom<=s.serviceDate AND (b.effectiveTo IS NULL OR b.effectiveTo>=s.serviceDate) AND (b.customerId IS NULL OR b.customerId=s.customerId) AND b.unitId<>i.unitId;`), 'Canonical-unit fixture required; never normalize existing BOMs to manufacture PASS.').toEqual([]);
      expect(dbVerifier.query(`SELECT HEX(bomId) AS id FROM dishbom WHERE customerId=UNHEX('${binaryId(customers[index].customerId)}');`)).toEqual([]);
      const expected = dbVerifier.query(`WITH source AS (
        SELECT DISTINCT q.quantityPlanLineId,s.serviceDate,s.menuPrice,m.dishId,
          IF(m.dishSlot LIKE 'vegetarian-%',q.vegetarianServings,q.savoryServings) AS servings
        FROM mealquantityplanlines q JOIN menuschedules s ON s.menuScheduleId=q.menuScheduleId JOIN menuitems m ON m.menuId=q.menuId
        WHERE s.menuVersionId=UNHEX('${binaryId(batch.menuVersionId)}')
      ) SELECT source.serviceDate AS date,HEX(b.ingredientId) AS ingredient,HEX(i.unitId) AS unit,
        CAST(CAST(SUM(ROUND(b.grossQtyPerServing*source.servings,6)) AS DECIMAL(18,6)) AS CHAR) AS quantity
      FROM source JOIN dishbom b ON b.dishId=source.dishId JOIN ingredients i ON i.ingredientId=b.ingredientId
      WHERE b.customerId IS NULL AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=source.menuPrice
        AND b.effectiveFrom<=source.serviceDate AND (b.effectiveTo IS NULL OR b.effectiveTo>=source.serviceDate)
      GROUP BY source.serviceDate,b.ingredientId,i.unitId HAVING SUM(b.grossQtyPerServing*source.servings)>0 ORDER BY date,ingredient,unit;`);
      expect(quantities[index]).toEqual(expected);
    }
    const issue = async (page: Page, index: number, date: string) => {
      await respectApiBudget(page);
      await page.goto(`/warehouse?view=mrx-daily&batchId=${batches[index].batchId}&date=${date}`);
      await page.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      const response = page.waitForResponse((r) => r.url().endsWith('/api/inventory-issues') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
      const result = await response;
      expect(result.status()).toBe(201);
      const command = result.request().postDataJSON();
      expect(command.reconciliationBatchId).toBe(batches[index].batchId);
      expect(dbVerifier.query(`SELECT commandId FROM lifecyclecommandreceipts WHERE commandId='${command.commandId}';`)).toHaveLength(1);
      const receipt = (await result.json()).data;
      expect(dbVerifier.query(`SELECT HEX(reconciliationBatchId) AS batch FROM inventoryissues WHERE issueId=UNHEX('${binaryId(receipt.issueId)}');`)).toEqual([{ batch: batchHex[index] }]);
      return { issueId: receipt.issueId, commandId: command.commandId };
    };
    await holdBoth(warehouses, /\/api\/inventory-issues$/, 'initial-issue');
    const receipts = await Promise.all(warehouses.map((page, index) => issue(page, index, scope.weekStartDate)));
    expect(new Set(receipts.map((receipt) => receipt.commandId)).size).toBe(2);
    for (const cleanup of cleanups.splice(0)) await cleanup();
    const snapshot = (index: number) => ({
      source: dbVerifier.query(`SELECT HEX(q.quantityPlanLineId) AS id,HEX(m.dishId) AS dish,m.dishSlot,q.savoryServings,q.vegetarianServings FROM mealquantityplanlines q JOIN menuschedules s ON s.menuScheduleId=q.menuScheduleId JOIN menuitems m ON m.menuId=q.menuId WHERE s.menuVersionId=UNHEX('${binaryId(batches[index].menuVersionId)}') ORDER BY id,m.dishSlot,dish;`),
      batch: dbVerifier.query(`SELECT Version,Status FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex[index]}');`),
      daily: dbVerifier.query(`SELECT HEX(DailyLineId) AS id,CAST(RequiredQuantity AS CHAR) AS quantity FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex[index]}') ORDER BY id;`),
      issues: dbVerifier.query(`SELECT HEX(l.issueLineId) AS id,CAST(l.issuedQty AS CHAR) AS quantity FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId WHERE i.reconciliationBatchId=UNHEX('${batchHex[index]}') ORDER BY id;`),
    });
    const secondDate = new Date(`${scope.weekStartDate}T00:00:00Z`);
    secondDate.setUTCDate(secondDate.getUTCDate() + 1);
    // B-only writes must not change A, and vice versa, including its issue/version history.
    for (const index of [1, 0]) {
      const other = 1 - index, before = snapshot(other);
      await issue(warehouses[index], index, secondDate.toISOString().slice(0, 10));
      expect(snapshot(other)).toEqual(before);
    }
    for (const [index, exportPage] of admins.entries()) {
      await respectApiBudget(exportPage);
      await exportPage.goto(`/chef?view=mrx-cooking&batchId=${batches[index].batchId}`);
      const download = exportPage.waitForEvent('download');
      await exportPage.getByRole('button', { name: 'Tải Excel cả lô', exact: true }).click();
      const file = path.join(evidence, `new-customer-${index}-cooking.xlsx`);
      await (await download).saveAs(file);
      const rows = parseCookingFile(file, 'xlsx');
      expect(rows.length).toBeGreaterThan(1);
      expect(rows[0]).toHaveLength(14);
      const expected = dbVerifier.query<{ date: string; name: string; servings: string }>(`SELECT DISTINCT DATE_FORMAT(d.ServiceDate,'%d/%m/%Y') AS date,c.FrozenDishName AS name,CAST(c.FrozenServings AS CHAR) AS servings FROM reconciliationbatchcontributors c JOIN reconciliationbatchdailylines d ON d.DailyLineId=c.DailyLineId WHERE d.BatchId=UNHEX('${batchHex[index]}') AND c.InvalidatedAt IS NULL AND d.RequiredQuantity>0;`);
      expect([...new Set(rows.slice(1).map((row) => `${row[0]}|${row[4]}|${row[5]}`))].sort()).toEqual(expected.map((row) => `${row.date}|${row.name}|${row.servings}`).sort());
      const exportedQuantities = new Map<string, bigint>();
      for (const row of rows.slice(1)) {
        expect(row[11]).toBe(`${customers[index].customerCode} - ${customers[index].customerName}`);
        const key = `${row[0]}|${row[6]}|${row[7]}`;
        exportedQuantities.set(key, (exportedQuantities.get(key) ?? 0n) + micros(row[10]));
      }
      const expectedQuantities = dbVerifier.query<{ date: string; ingredient: string; unit: string; quantity: string }>(`SELECT DATE_FORMAT(d.ServiceDate,'%d/%m/%Y') AS date,i.ingredientName AS ingredient,u.unitName AS unit,CAST(SUM(d.RequiredQuantity) AS CHAR) AS quantity FROM reconciliationbatchdailylines d JOIN ingredients i ON i.ingredientId=d.IngredientId JOIN units u ON u.unitId=d.CanonicalUnitId WHERE d.BatchId=UNHEX('${batchHex[index]}') AND d.RequiredQuantity>0 GROUP BY d.ServiceDate,i.ingredientName,u.unitName;`);
      const compactUnit = (unit: string) => ({ kilogram: 'kg', kilograms: 'kg', gram: 'g', grams: 'g', liter: 'lít', litre: 'lít', liters: 'lít', litres: 'lít', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml' })[unit.trim().toLowerCase()] ?? unit.trim();
      expect([...exportedQuantities].map(([key, quantity]) => `${key}|${quantity}`).sort()).toEqual(expectedQuantities.map((row) => `${row.date}|${row.ingredient}|${compactUnit(row.unit)}|${micros(row.quantity)}`).sort());
    }
    expect(stocks()).toEqual(stockBefore);
    for (const barrier of barriers) {
      expect(barrier.timedOut).toBe(false);
      expect(barrier.samples).toHaveLength(2);
      expect(barrier.releasedAt).toBeDefined();
      expect(barrier.samples.every((sample) => sample.arrivedAt <= barrier.releasedAt!)).toBe(true);
      expect(barrier.samples.every((sample) => sample.status! >= 200 && sample.status! < 300)).toBe(true);
      // Prove HTTP intervals overlap, not merely two calls started together; no DB-lock overlap claim.
      expect(Math.max(...barrier.samples.map((sample) => sample.dispatchedAt!))).toBeLessThanOrEqual(Math.min(...barrier.samples.map((sample) => sample.respondedAt!)));
    }
    fs.writeFileSync(path.join(evidence, 'new-two-customer-concurrency.json'), JSON.stringify({ customers, batches, weekStartDate: scope.weekStartDate, receipts, barriers, sourceRows, quantities, physicalStockUnchanged: true, limitation: 'HTTP-boundary overlap only; internal DB schedules, combined preparation export, normalized-name import policy and full C03 readiness matrix are not qualified.' }, null, 2));
  } finally {
    const cleanupResults = await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
    const contextResults = await Promise.allSettled(contexts.map((context) => context.close()));
    const cleanupErrors = [...cleanupResults, ...contextResults].filter((result) => result.status === 'rejected');
    fs.writeFileSync(path.join(evidence, 'new-two-customer-attempt.json'), JSON.stringify({ customers, barriers, cleanupFailures: cleanupErrors.length }, null, 2));
    expect(cleanupErrors, 'Every task-owned route and context must close independently').toEqual([]);
  }
});
