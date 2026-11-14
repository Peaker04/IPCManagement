import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { respectApiBudget } from '../fixtures/authHelpers';
import { createTransferredBatch, scenarioScope, parseCookingFile, writeBomImportWorkbook } from '../fixtures/mrxWorkflow';
import type { StockSnapshot } from '../core/mysqlVerifier';
import type { MrxEditScope, MrxKitchenCooking, MrxWarehouseDaily } from '../../../src/api/mrxApi';

test.setTimeout(360_000);
test.use({ actionTimeout: 15_000 });
test('@G6-Merged-Customer shared customer UI and four-slot dish editing preserve one-BOM servings and durable quantities', async ({ managerPage, adminPage, dieuphoiPage, beptruongPage, thukhoPage, dbVerifier }) => {
  const scope = scenarioScope(dbVerifier, 10);
  const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  const unitCatalog=dbVerifier.query<{code:string;base:string|null;rate:string}>('SELECT unitCode AS code,baseUnitCode AS base,CAST(convertRateToBase AS CHAR) AS rate FROM units ORDER BY unitCode;');
  fs.writeFileSync(path.join(evidence,'conversion-unit-prerequisites.json'),JSON.stringify(unitCatalog,null,2));
  expect(unitCatalog.some((a)=>a.base && Number(a.rate)>0 && unitCatalog.some((b)=>b.base?.toUpperCase()===a.base?.toUpperCase() && Number(b.rate)>0 && b.rate!==a.rate)), 'No real alternate-unit conversion pair; see conversion-unit-prerequisites.json. Do not fabricate PASS.').toBe(true);
  const code = `Q${scope.caseId.replace(/[^a-z0-9]/gi, '').slice(-16)}`.toUpperCase();
  const name = `Khách MRX ${scope.caseId}`;
  await managerPage.bringToFront();
  await managerPage.goto('/');
  const administration = managerPage.getByRole('button', { name: 'Quản trị hệ thống', exact: true });
  if (await administration.getAttribute('aria-expanded') !== 'true') await administration.click();
  await managerPage.getByRole('link', { name: 'Khách hàng & Hợp đồng', exact: true }).click();
  await expect(managerPage).toHaveURL(/view=customers/);
  await managerPage.getByRole('button', { name: 'Thêm khách hàng mới', exact: true }).click();
  const dialog = managerPage.getByRole('dialog');
  await dialog.getByLabel('Mã khách hàng', { exact: true }).fill(code);
  await dialog.getByLabel('Tên khách hàng', { exact: true }).fill(name);
  const created = managerPage.waitForResponse((r) => r.url().endsWith('/api/coordination/customers/contract') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Tạo khách hàng', exact: true }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const customer = (await response.json()).data;
  await expect(dialog).toHaveCount(0);
  await managerPage.reload();
  await expect(managerPage.getByText(name, { exact: true })).toBeVisible();
  expect(dbVerifier.query(`SELECT customerCode AS code, customerName AS name FROM customers WHERE customerCode='${code}';`)).toEqual([{ code, name }]);
  await managerPage.screenshot({ path: path.join(evidence, '20-shared-customer-created.png') });
  await dieuphoiPage.bringToFront();
  await dieuphoiPage.goto(`/weekly-menu?view=mrx-batch&customerId=${customer.customerId}&weekStartDate=${scope.weekStartDate}`);
  await expect(dieuphoiPage.getByLabel('Chọn khách hàng MRX', { exact: true })).toHaveValue(customer.customerId);
  await expect(dieuphoiPage.getByLabel('Chọn khách hàng MRX').locator('option:checked')).toHaveText(`${code} - ${name}`);
  scope.customer = { customerId: customer.customerId, label: `${code} - ${name}` };
  await expect(dieuphoiPage.getByLabel('Chọn khách hàng MRX')).toHaveValue(scope.customer.customerId);
  await beptruongPage.goto('/admin-data?view=customers');
  await expect(beptruongPage.getByRole('button', { name: 'Thêm khách hàng mới', exact: true })).toHaveCount(0);
  const denied = await beptruongPage.evaluate(async () => (await fetch('/api/coordination/customer-contracts', { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } })).status);
  expect(denied).toBe(403);
  console.log('[UI] Manager created/reloaded shared customer; Coordinator selected it in MRX; Chef denied.');

  const beforeInvalidImport = dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches;');
  await dieuphoiPage.getByRole('button', { name: 'Nhập Excel', exact: true }).first().click();
  await dieuphoiPage.locator('select#import-customer-select').selectOption(customer.customerId);
  const dateField = dieuphoiPage.getByLabel('Tuần bắt đầu nhập', { exact: true });
  if (await dateField.getAttribute('readonly') !== null) await dieuphoiPage.getByRole('button', { name: 'Đổi tuần', exact: true }).click();
  await dieuphoiPage.getByLabel('Tuần bắt đầu nhập', { exact: true }).fill(scope.weekStartDate.split('-').reverse().join('/'));
  await dieuphoiPage.getByLabel('Tuần bắt đầu nhập', { exact: true }).press('Enter');
  await dieuphoiPage.setInputFiles('input[type="file"]', path.resolve('README.md'));
  await expect(dieuphoiPage.getByText('Vui lòng chọn file .xlsx.', { exact: true })).toBeVisible();
  await expect(dieuphoiPage.getByRole('button', { name: 'Xem trước', exact: true })).toBeDisabled();
  await dieuphoiPage.getByLabel('Chọn file Excel thực đơn', { exact: true }).setInputFiles({ name: 'invalid-content.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(path.resolve('README.md')) });
  await dieuphoiPage.locator('button[role="radio"]:has-text("25.000")').click();
  const invalidPreviewButton = dieuphoiPage.getByRole('button', { name: 'Xem trước', exact: true });
  await expect(invalidPreviewButton).toBeEnabled();
  const invalidPreview = dieuphoiPage.waitForResponse((r) => r.url().endsWith('/weekly-menu/import/preview') && r.request().method() === 'POST', { timeout: 15_000 });
  await invalidPreviewButton.click();
  const invalidResponse = await invalidPreview;
  expect(invalidResponse.status()).toBe(200); // Preview returns a validation DTO, not a persisted import.
  const invalid = (await invalidResponse.json()).data;
  expect(invalid.validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'FILE_READ_ERROR', severity: 'error' })]));
  await expect(dieuphoiPage.getByRole('button', { name: 'Xác nhận nhập', exact: true })).toBeDisabled();
  await expect(dieuphoiPage.getByText('Có lỗi cần sửa', { exact: true })).toBeVisible();
  await expect(dieuphoiPage.getByRole('dialog')).toContainText(invalid.validation.issues.find((i: { code: string }) => i.code === 'FILE_READ_ERROR').message);
  expect(dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches;')).toEqual(beforeInvalidImport);
  await dieuphoiPage.getByRole('button', { name: 'Đóng', exact: true }).click();
  fs.writeFileSync(path.join(evidence, 'invalid-import-no-write.json'), JSON.stringify({ input: 'README.md rejected by client; same non-workbook bytes uploaded as invalid-content.xlsx to reach server parser', code: 'FILE_READ_ERROR', commitDisabled: true, sourceUnchanged: true, recovery: 'Next real valid-workbook import in this same scope' }, null, 2));
  const { batchId, menuVersionId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  await adminPage.bringToFront();
  await adminPage.goto(`/weekly-menu?view=mrx-batch&customerId=${customer.customerId}&weekStartDate=${scope.weekStartDate}`);
  const customerId = await adminPage.getByLabel('Chọn khách hàng MRX').inputValue();
  expect(customerId).toBe(customer.customerId);
  const customerHex = binaryId(customerId);
  expect(dbVerifier.query(`SELECT HEX(customerId) AS customer FROM menuversions WHERE menuVersionId=UNHEX('${binaryId(menuVersionId)}');`)).toEqual([{ customer: customerHex }]);
  expect(dbVerifier.query(`SELECT HEX(v.customerId) AS customer, HEX(b.MenuVersionId) AS version FROM reconciliationbatches b JOIN menuversions v ON v.menuVersionId=b.MenuVersionId WHERE b.BatchId=UNHEX('${binaryId(batchId)}');`)).toEqual([{ customer: customerHex, version: binaryId(menuVersionId) }]);
  expect(dbVerifier.query(`SELECT HEX(q.customerId) AS customer FROM mealquantityplanlines q JOIN menuschedules s ON s.menuScheduleId=q.menuScheduleId WHERE s.menuVersionId=UNHEX('${binaryId(menuVersionId)}') GROUP BY q.customerId;`)).toEqual([{ customer: customerHex }]);
  const readScope = () => adminPage.evaluate(async ({ customerId, week }) => {
    const r = await fetch(`/api/reconciliation/weekly-menu/edit-scope?customerId=${customerId}&weekStartDate=${week}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
    if (!r.ok) throw new Error(`Edit scope ${r.status}`);
    return (await r.json()).data as MrxEditScope;
  }, { customerId, week: scope.weekStartDate });
  const original = await readScope();
  const shift = original.days.find((day) => day.serviceDate === scope.weekStartDate)!.shifts.find((s) => s.shiftName === 'MORNING')!;
  const slots = shift.slots.filter((s) => s.menuVariant === 'savory').slice(0, 4);
  expect(slots).toHaveLength(4);
  const dishes = [...new Map(original.days.flatMap((d) => d.shifts.flatMap((s) => s.slots)).filter((s) => s.menuVariant === 'savory' && s.dishId && s.dishName && s.dishCode).map((s) => [s.dishId, s])).values()];
  expect(dishes.length).toBeGreaterThanOrEqual(4);
  const short = scope.weekStartDate.slice(5).split('-').reverse().join('/');
  async function choose(slotLabel: string, dish: typeof slots[number]) {
    const input = adminPage.getByRole('combobox', { name: `${slotLabel} ${short} Sáng` });
    await input.fill(dish.dishName!);
    await adminPage.getByRole('listbox').getByRole('option').filter({ has: adminPage.getByText(dish.dishCode!, { exact: true }) }).click();
  }
  const snapshots: object[] = [];
  const remountObservations: object[] = [];
  async function applyAndCheck(label: string, expectedIds: string[], servings: number) {
    await respectApiBudget(adminPage);
    await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
    await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} ${label}`);
    await adminPage.getByRole('button', { name: /^(?:Xem ảnh hưởng|Kiểm tra lại ảnh hưởng)$/ }).click();
    await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
    const applied = adminPage.waitForResponse((r) => r.url().endsWith('/mrx-apply') && r.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
    const applyResponse = await applied;
    expect(applyResponse.status()).toBe(200);
    await expect(adminPage.getByText('Đã áp dụng thay đổi nguồn.', { exact: true })).toBeVisible();
    const remountStarted = performance.now();
    await adminPage.reload();
    const persisted = (await readScope()).days.find((d) => d.serviceDate === scope.weekStartDate)!.shifts.find((s) => s.shiftName === 'MORNING')!;
    if (remountObservations.length < 3) {
      await expect(adminPage.getByRole('button', { name: 'Chỉnh sửa món', exact: true })).toBeEnabled();
      remountObservations.push({ label, elapsedMs: Math.round(performance.now() - remountStarted),
        boundary: 'Actual page reload through persisted scope and enabled edit control; at most three observations, not a percentile' });
      fs.writeFileSync(path.join(evidence, 'source-remount-observations.json'), JSON.stringify(remountObservations, null, 2));
    }
    expect(slots.map((slot) => persisted.slots.find((s) => s.dishSlot === slot.dishSlot)!.dishId)).toEqual(expectedIds);
    expect(persisted.savoryServings).toBe(servings);
    const customerHex = binaryId(customerId), batchHex = binaryId(batchId);
    // Independent SQL oracle over distinct source dishes and applicable real BOMs, not renderer/projection output.
    expect(customerId).toBe(customer.customerId);
    const quantities = dbVerifier.query<{ ingredient: string; qty: string }>(`WITH source AS (
      SELECT DISTINCT q.quantityPlanLineId, q.customerId, q.savoryServings, q.vegetarianServings, s.menuPrice, s.serviceDate, m.dishId,
        CASE WHEN m.dishSlot LIKE 'vegetarian-%' THEN 'vegetarian' ELSE 'savory' END AS variant
      FROM mealquantityplanlines q JOIN menuschedules s ON s.menuScheduleId=q.menuScheduleId JOIN menuitems m ON m.menuId=q.menuId
      WHERE q.customerId=UNHEX('${customerHex}') AND s.serviceDate='${scope.weekStartDate}'
    ), selected AS (
      SELECT source.*, b.ingredientId, b.unitId, b.grossQtyPerServing FROM source JOIN dishbom b ON b.dishId=source.dishId
      WHERE b.bomStatus='PUBLISHED' AND b.priceTierAmount=source.menuPrice AND b.effectiveFrom<=source.serviceDate AND (b.effectiveTo IS NULL OR b.effectiveTo>=source.serviceDate)
      AND (b.customerId=source.customerId OR (b.customerId IS NULL AND NOT EXISTS (SELECT 1 FROM dishbom preferred WHERE preferred.dishId=source.dishId AND preferred.customerId=source.customerId AND preferred.bomStatus='PUBLISHED' AND preferred.priceTierAmount=source.menuPrice AND preferred.effectiveFrom<=source.serviceDate AND (preferred.effectiveTo IS NULL OR preferred.effectiveTo>=source.serviceDate))))
    ) SELECT HEX(b.ingredientId) AS ingredient, CAST(CAST(SUM(ROUND(b.grossQtyPerServing * IF(b.variant='vegetarian',b.vegetarianServings,b.savoryServings) * IF(b.unitId=i.unitId,1,u.convertRateToBase / canonical.convertRateToBase),6)) AS DECIMAL(18,6)) AS CHAR) AS qty
    FROM selected b JOIN ingredients i ON i.ingredientId=b.ingredientId JOIN units u ON u.unitId=b.unitId JOIN units canonical ON canonical.unitId=i.unitId
    GROUP BY b.ingredientId HAVING SUM(b.grossQtyPerServing * IF(b.variant='vegetarian',b.vegetarianServings,b.savoryServings))>0 ORDER BY ingredient;`);
    expect(quantities.length).toBeGreaterThan(0);
    const frozen = dbVerifier.query<{ ingredient: string; qty: string }>(`SELECT HEX(IngredientId) AS ingredient, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') AND ServiceDate='${scope.weekStartDate}' AND RequiredQuantity>0 ORDER BY ingredient;`);
    expect(frozen).toEqual(quantities);
    expect(dbVerifier.query(`SELECT HEX(c.MealQuantityPlanLineId) AS source, HEX(c.DishBomId) AS bom FROM reconciliationbatchcontributors c JOIN reconciliationbatchdailylines d ON d.DailyLineId=c.DailyLineId WHERE d.BatchId=UNHEX('${batchHex}') AND d.ServiceDate='${scope.weekStartDate}' AND c.InvalidatedAt IS NULL GROUP BY c.MealQuantityPlanLineId,c.DishBomId HAVING COUNT(*)>1;`)).toEqual([]);
    snapshots.push({ label, expectedIds, servings, quantities });
    await adminPage.screenshot({ path: path.join(evidence, `21-source-${label}.png`) });
    console.log(`[UI/BOM] ${label}: confirmed/reloaded actual source and exact six-decimal distinct-dish oracle (${quantities.length} ingredients).`);
  }
  function editToggle() { return adminPage.getByRole('button', { name: 'Chỉnh sửa món', exact: true }); }
  await editToggle().click();
  await adminPage.getByRole('button', { name: `Tách để sửa riêng ${slots[0].slotLabel} ${short} Sáng`, exact: true }).click();
  for (const slot of slots) await choose(slot.slotLabel, slots[0]);
  await adminPage.getByRole('button', { name: 'Xem menu đã gộp', exact: true }).click();
  await expect(adminPage.getByRole('cell', { name: `${slots[0].dishName}, 1 ngày, 4 loại món`, exact: true })).toHaveAttribute('rowspan', '4');
  await adminPage.getByRole('spinbutton', { name: `Số suất Mặn ${short} Sáng`, exact: true }).fill('1200');
  await applyAndCheck('large-four-slots', slots.map(() => slots[0].dishId!), 1200);
  await editToggle().click();
  await choose(slots[0].slotLabel, dishes.find((d) => d.dishId !== slots[0].dishId)!);
  const replacement = dishes.find((d) => d.dishId !== slots[0].dishId)!;
  await applyAndCheck('replace-whole-group', slots.map(() => replacement.dishId!), 1200);
  await editToggle().click();
  await adminPage.getByRole('button', { name: `Tách để sửa riêng ${slots[0].slotLabel} ${short} Sáng`, exact: true }).click();
  for (const [index, slot] of slots.entries()) await choose(slot.slotLabel, dishes[index]);
  await adminPage.getByRole('button', { name: 'Xem menu đã gộp', exact: true }).click();
  await adminPage.getByRole('spinbutton', { name: `Số suất Mặn ${short} Sáng`, exact: true }).fill('1250');
  await applyAndCheck('four-small-dishes', dishes.slice(0,4).map((d) => d.dishId!), 1250);
  await editToggle().click();
  await choose(slots[2].slotLabel, dishes[0]);
  await applyAndCheck('nonadjacent-same-id', [dishes[0].dishId!, dishes[1].dishId!, dishes[0].dishId!, dishes[3].dishId!], 1250);
  const catalog = await adminPage.evaluate(async () => {
    const getPage = async (pageNumber: number) => {
      const r = await fetch(`/api/Dishes?pageNumber=${pageNumber}&pageSize=100`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
      if (!r.ok) throw new Error(`Actual picker catalog ${r.status}`);
      return (await r.json()).data as { totalPages: number; items: { dishId: string; dishName: string; dishCode: string; isActive: boolean }[] };
    };
    const first = await getPage(1);
    const remaining = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) => getPage(index + 2)));
    return [...first.items, ...remaining.flatMap((page) => page.items)];
  });
  async function createDish(dishCode: string, dishName: string) {
    await respectApiBudget(adminPage);
    const result = await adminPage.evaluate(async (body) => {
      const response = await fetch('/api/Dishes', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'Content-Type': 'application/json', 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, { dishCode, dishName });
    expect(result.status).toBe(201);
    const dish = result.body.data as typeof catalog[number];
    expect(dish.dishCode).toBe(dishCode);
    expect(dish.dishName).toBe(dishName);
    return dish;
  }
  async function importCustomerBom(file: string, createdRows: number) {
    await respectApiBudget(adminPage);
    const page = await adminPage.context().newPage();
    try {
      await page.goto('/admin-data?view=bom');
      await page.getByRole('button', { name: 'Nhập BOM Excel', exact: true }).click();
      await page.getByLabel('Phạm vi áp dụng BOM', { exact: true }).selectOption(customerId);
      await page.getByLabel('Chọn file Excel định mức BOM', { exact: true }).setInputFiles(file);
      const preview = page.waitForResponse((r) => r.url().endsWith('/bom-import/preview') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      const previewResponse = await preview;
      expect(previewResponse.status()).toBe(200);
      expect((await previewResponse.json()).data.canCommit).toBe(true);
      const commit = page.waitForResponse((r) => r.url().endsWith('/bom-import/commit') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true }).click();
      const committed = await commit;
      expect(committed.status()).toBe(200);
      const result = (await committed.json()).data;
      expect(result.createdRows).toBe(createdRows);
      expect(result.updatedRows).toBe(0);
    } finally { await page.close(); }
  }
  const dishCode = `UP${scope.caseId.replace(/[^a-z0-9]/gi, '')}`.toUpperCase();
  const dishName = `MÓN MỚI ĐẬU ${dishCode}`;
  const missing = await createDish(dishCode, dishName);
  expect(missing.dishCode).toBe(dishCode);
  expect(missing.dishName).toBe(dishName);
  const missingHex = binaryId(missing.dishId);
  expect(dbVerifier.query(`SELECT dishCode AS code, dishName AS name FROM dishes WHERE dishId=UNHEX('${missingHex}');`)).toEqual([{ code: dishCode, name: dishName }]);
  expect(dbVerifier.query(`SELECT HEX(bomId) AS id FROM dishbom WHERE dishId=UNHEX('${missingHex}');`)).toEqual([]);
  catalog.push(missing);
  const ingredient = dbVerifier.query<{ code: string; unit: string }>(`SELECT i.ingredientCode AS code, u.unitCode AS unit FROM dishbom b JOIN ingredients i ON i.ingredientId=b.ingredientId JOIN units u ON u.unitId=i.unitId WHERE b.dishId=UNHEX('${binaryId(dishes[3].dishId!)}') AND b.bomStatus='PUBLISHED' ORDER BY i.ingredientCode LIMIT 1;`);
  expect(ingredient).toHaveLength(1);
  const pairName = `MRX CÙNG TÊN ${dishCode}`;
  const declaredPair = [];
  for (const suffix of ['A', 'B']) declaredPair.push(await createDish(`${dishCode}${suffix}`, pairName));
  expect(new Set(declaredPair.map((dish) => dish.dishId)).size).toBe(2);
  const pairFile = path.join(evidence, 'declared-same-name-boms.xlsx');
  writeBomImportWorkbook(pairFile, declaredPair.map((dish, index) => ({ dishCode: dish.dishCode, ingredientCode: ingredient[0].code, unitCode: ingredient[0].unit, quantity: index === 0 ? '0.125000' : '0.250000', status: 'PUBLISHED', date: scope.weekStartDate, note: `${scope.reason} declared same-name pair` })));
  await importCustomerBom(pairFile, 2);
  const pairIds = declaredPair.map((dish) => `UNHEX('${binaryId(dish.dishId)}')`).join(',');
  expect(dbVerifier.query(`SELECT HEX(b.dishId) AS id,CAST(b.grossQtyPerServing AS CHAR) AS quantity FROM dishbom b WHERE b.dishId IN (${pairIds}) AND b.customerId=UNHEX('${customerHex}') AND b.bomStatus='PUBLISHED' AND b.effectiveFrom='${scope.weekStartDate}' AND b.effectiveTo='${scope.weekStartDate}' ORDER BY quantity;`)).toEqual(declaredPair.map((dish, index) => ({ id: binaryId(dish.dishId), quantity: index === 0 ? '0.125000' : '0.250000' })));
  catalog.push(...declaredPair);
  await respectApiBudget(adminPage);
  await adminPage.reload();
  fs.writeFileSync(path.join(evidence, 'declared-same-name-prerequisite.json'), JSON.stringify({ type: 'AUTHORIZED_CLONE_ONLY_CATALOGUE_FIXTURE', customerId, serviceDate: scope.weekStartDate, dishes: declaredPair, quantities: ['0.125000', '0.250000'], stockSeeded: false }, null, 2));
  const prerequisites = {
    sameNameDifferentIds: dbVerifier.query<{id:string;dishName:string;dishCode:string}>(`SELECT HEX(d.dishId) AS id, d.dishName, d.dishCode FROM dishes d WHERE d.dishId IN (${pairIds}) AND d.isActive=1 AND EXISTS (SELECT 1 FROM dishes other WHERE other.isActive=1 AND other.dishName=d.dishName AND other.dishId<>d.dishId) AND EXISTS (SELECT 1 FROM dishbom b WHERE b.dishId=d.dishId AND b.bomStatus='PUBLISHED' AND (b.customerId IS NULL OR b.customerId=UNHEX('${binaryId(customerId)}')) AND b.priceTierAmount=25000 AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}')) ORDER BY d.dishName,id LIMIT 10;`),
    nonCanonicalBoms: dbVerifier.query(`SELECT d.dishCode, b.bomStatus, HEX(b.customerId) AS customer, CAST(b.priceTierAmount AS CHAR) AS tier, bu.unitCode AS bomUnit, cu.unitCode AS canonicalUnit, bu.baseUnitCode AS bomBase, cu.baseUnitCode AS canonicalBase, CAST(bu.convertRateToBase AS CHAR) AS bomRate, CAST(cu.convertRateToBase AS CHAR) AS canonicalRate FROM dishbom b JOIN dishes d ON d.dishId=b.dishId JOIN ingredients i ON i.ingredientId=b.ingredientId JOIN units bu ON bu.unitId=b.unitId JOIN units cu ON cu.unitId=i.unitId WHERE b.unitId<>i.unitId AND b.bomStatus='PUBLISHED' AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}') ORDER BY d.dishCode LIMIT 10;`),
    retainedZeroLines: dbVerifier.query(`SELECT HEX(DailyLineId) AS id, HEX(IngredientId) AS ingredient FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${binaryId(batchId)}') AND RequiredQuantity=0 ORDER BY id;`),
  };
  const duplicatePair = prerequisites.sameNameDifferentIds
    .map((row)=>catalog.find((dish)=>binaryId(dish.dishId)===row.id))
    .filter((dish): dish is typeof catalog[number] => Boolean(dish));
  const pair = duplicatePair.slice(0,2);
  const sameNameAction = {status:'BLOCKED',reason:'Need two same-name/different-ID dishes with applicable real BOMs in the actual picker catalog.'};
  if (pair.length===2 && pair[0].dishName===pair[1].dishName && pair[0].dishId!==pair[1].dishId) {
    await editToggle().click();
    await choose(slots[0].slotLabel, {...slots[0],...pair[0]});
    await choose(slots[1].slotLabel, {...slots[1],...pair[1]});
    await applyAndCheck('same-name-different-ids', [pair[0].dishId,pair[1].dishId,dishes[0].dishId!,dishes[3].dishId!],1250);
    sameNameAction.status='PASS';
    sameNameAction.reason='Actual FE selected two existing distinct IDs with equal names; independent ID-grain BOM oracle includes both.';
  }
  fs.writeFileSync(path.join(evidence,'quantity-grain-prerequisites.json'),JSON.stringify({...prerequisites,sameNameAction},null,2));
  expect(sameNameAction.status, 'Required exact-name/different-ID FE proof must not be silently conditional. See declared clone-only prerequisite receipt.').toBe('PASS');
  const beforeMissing = await readScope();
  const batchHex = binaryId(batchId);
  const frozenState = () => dbVerifier.query(`SELECT HEX(DailyLineId) AS id, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') ORDER BY id;`);
  const beforeFrozen = frozenState();
  await editToggle().click();
  await choose(slots[0].slotLabel, { ...slots[0], ...missing });
  const rejected = adminPage.waitForResponse((r) => r.url().endsWith('/amendments/preview') && r.request().method() === 'POST');
  await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
  expect((await rejected).status()).toBe(422);
  await expect(adminPage.getByText('Món thay thế chưa có định mức cho ngày phục vụ.', { exact: true })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true })).toHaveCount(0);
  expect(await readScope()).toEqual(beforeMissing);
  expect(frozenState()).toEqual(beforeFrozen);
  await adminPage.screenshot({ path: path.join(evidence, '22-real-missing-bom-blocked.png') });
  const recoveryFile = path.join(evidence, 'new-uppercase-dish-bom.xlsx');
  writeBomImportWorkbook(recoveryFile, [{ dishCode, ingredientCode: ingredient[0].code, unitCode: ingredient[0].unit, quantity: '0.125000', status: 'PUBLISHED', date: scope.weekStartDate, note: scope.reason }]);
  await importCustomerBom(recoveryFile, 1);
  expect(dbVerifier.query(`SELECT CAST(grossQtyPerServing AS CHAR) AS quantity FROM dishbom WHERE dishId=UNHEX('${missingHex}') AND customerId=UNHEX('${customerHex}') AND bomStatus='PUBLISHED';`)).toEqual([{ quantity: '0.125000' }]);
  const sameDishIds = slots.map((slot) => beforeMissing.days.find((day) => day.serviceDate === scope.weekStartDate)!.shifts.find((s) => s.shiftName === 'MORNING')!.slots.find((s) => s.dishSlot === slot.dishSlot)!.dishId!);
  sameDishIds[0] = missing.dishId;
  await applyAndCheck('same-new-dish-bom-recovered', sameDishIds, 1250);
  expect(dbVerifier.query(`SELECT CAST(c.SourceQuantity AS CHAR) AS quantity FROM reconciliationbatchcontributors c JOIN reconciliationbatchdailylines d ON d.DailyLineId=c.DailyLineId WHERE d.BatchId=UNHEX('${batchHex}') AND d.ServiceDate='${scope.weekStartDate}' AND c.DishId=UNHEX('${missingHex}') AND c.InvalidatedAt IS NULL;`)).toEqual([{ quantity: '156.250000' }]);
  fs.writeFileSync(path.join(evidence, 'new-customer-uppercase-bom-recovery.json'), JSON.stringify({ customerId, menuVersionId, batchId, dishId: missing.dishId, dishCode, dishName, missingBomStatus: 422, bomQuantity: '0.125000', servings: 1250, sourceQuantity: '156.250000', sameDishRecovered: true }, null, 2));
  await editToggle().click();
  if (sameNameAction.status === 'PASS') await choose(slots[1].slotLabel, dishes[1]);
  await choose(slots[0].slotLabel, dishes[1]);
  await applyAndCheck('missing-bom-recovered-partial-merge', [dishes[1], dishes[1], dishes[0], dishes[3]].map((d) => d.dishId!), 1250);
  // Owner-approved prerequisite: customer/day-only BOM import, never main or stock seeds.
  const conversion = dbVerifier.query<{ingredient:string;canonical:string;compatible:string;incompatible:string;gross:string;convertedGross:string}>(`SELECT i.ingredientCode AS ingredient, cu.unitCode AS canonical, good.unitCode AS compatible, bad.unitCode AS incompatible, CAST(b.grossQtyPerServing AS CHAR) AS gross, CAST(CAST(b.grossQtyPerServing*cu.convertRateToBase/good.convertRateToBase AS DECIMAL(18,6)) AS CHAR) AS convertedGross FROM dishbom b JOIN ingredients i ON i.ingredientId=b.ingredientId JOIN units cu ON cu.unitId=i.unitId JOIN units good ON UPPER(good.baseUnitCode)=UPPER(cu.baseUnitCode) AND good.unitId<>cu.unitId AND good.convertRateToBase>0 AND good.convertRateToBase<>cu.convertRateToBase JOIN units bad ON UPPER(bad.baseUnitCode)<>UPPER(cu.baseUnitCode) AND bad.convertRateToBase>0 WHERE b.dishId=UNHEX('${binaryId(dishes[3].dishId!)}') AND b.unitId=cu.unitId AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=25000 AND (b.customerId IS NULL OR b.customerId=UNHEX('${binaryId(customerId)}')) AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}') ORDER BY cu.unitCode,good.unitCode,bad.unitCode LIMIT 1;`);
  expect(conversion, 'Prerequisite uses the declared alternate-unit fixture plus existing canonical/incompatible units.').toHaveLength(1);
  const units = conversion[0];
  const bomPage = await adminPage.context().newPage();
  await bomPage.goto('/admin-data?view=bom');
  await bomPage.getByRole('button', {name:'Nhập BOM Excel',exact:true}).click();
  await bomPage.getByLabel('Phạm vi áp dụng BOM',{exact:true}).selectOption(customerId);
  async function importConversionBom(rows: {unit:string;quantity:string;status:string}[], label:string) {
    await respectApiBudget(adminPage);
    const file=path.join(evidence,`approved-conversion-${label}.xlsx`);
    writeBomImportWorkbook(file, rows.map(row => ({ dishCode: dishes[3].dishCode!, ingredientCode: units.ingredient, unitCode: row.unit, quantity: row.quantity, status: row.status, date: scope.weekStartDate, note: `${scope.reason} điều kiện định mức đã duyệt ${label}` })));
    await bomPage.getByLabel('Chọn file Excel định mức BOM',{exact:true}).setInputFiles(file);
    const preview=bomPage.waitForResponse((r)=>r.url().endsWith('/bom-import/preview') && r.request().method()==='POST');
    await bomPage.getByRole('button',{name:'Xem trước',exact:true}).click();
    const previewResponse=await preview;
    expect(previewResponse.status(),await previewResponse.text()).toBe(200);
    expect((await previewResponse.json()).data.canCommit).toBe(true);
    const commit=bomPage.waitForResponse((r)=>r.url().endsWith('/bom-import/commit') && r.request().method()==='POST');
    await bomPage.getByRole('button',{name:'Xác nhận nhập BOM hàng loạt',exact:true}).click();
    const response=await commit;
    expect(response.status(),await response.text()).toBe(200);
    const committed=(await response.json()).data;
    expect(committed.createdRows+committed.updatedRows).toBe(rows.length);
    await expect(bomPage.getByText(`Đã nhập thành công ${committed.createdRows + committed.updatedRows} dòng BOM (${committed.createdRows} tạo mới, ${committed.updatedRows} cập nhật) cho catalog.`, { exact: true })).toBeVisible();
    await bomPage.screenshot({ path: path.join(evidence, `bom-count-${label}.png`) });
    return {file,status:response.status(),createdRows:committed.createdRows,updatedRows:committed.updatedRows,archivedRows:committed.archivedRows};
  }
  const badFixture=await importConversionBom([{unit:units.incompatible,quantity:units.gross,status:'PUBLISHED'}],'incompatible');
  const noWriteSql='CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches,reconciliationbatchdailylines,reconciliationbatchcontributors,reconciliationsourcerevisions,inventoryissues,inventoryissuelines,currentstock,currentstocklots,stockmovements,dishbom,auditlogs;';
  const afterBadPreparation=dbVerifier.query(noWriteSql);
  await adminPage.getByRole('spinbutton',{name:`Số suất Mặn ${short} Sáng`,exact:true}).fill('1251');
  const invalidConversion=adminPage.waitForResponse((r)=>r.url().endsWith('/amendments/preview') && r.request().method()==='POST');
  await adminPage.getByRole('button',{name:/Tiếp tục xem ảnh hưởng \(\d+\)/}).click();
  const invalidResult=await invalidConversion;
  expect(invalidResult.status(),await invalidResult.text()).toBe(400);
  expect((await invalidResult.json()).message).toMatch(/quy đổi/);
  expect(dbVerifier.query(noWriteSql)).toEqual(afterBadPreparation);
  await expect(adminPage.getByText('Đơn vị nguyên liệu chưa có quy đổi chuẩn hợp lệ.',{exact:true})).toBeVisible();
  await expect(adminPage.getByRole('button',{name:'Áp dụng ngay',exact:true})).toHaveCount(0);
  const goodFixture=await importConversionBom([{unit:units.incompatible,quantity:units.gross,status:'ARCHIVED'},{unit:units.compatible,quantity:units.convertedGross,status:'PUBLISHED'}],'compatible');
  await bomPage.close();
  await applyAndCheck('valid-conversion', [dishes[1],dishes[1],dishes[0],dishes[3]].map((d)=>d.dishId!),1251);
  fs.writeFileSync(path.join(evidence,'approved-conversion-prerequisites.json'),JSON.stringify({scope:'clone-only declared alternate-unit fixture plus customer/day BOM; no stock seeds; existing units unchanged',customerId,date:scope.weekStartDate,dishId:dishes[3].dishId,units,badFixture,goodFixture,invalidStatus:400,noOperationalWritesAfterBadFixture:true,validSourceApplied:true},null,2));
  const acceptedSource = await readScope();
  const zeroSql = `SELECT HEX(DailyLineId) AS id, CAST(RequiredQuantity AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}') AND RequiredQuantity=0 ORDER BY id;`;
  const retainedZeros = dbVerifier.query(zeroSql);
  expect(retainedZeros.length, 'Actual source edits must leave real zero identities; do not seed them.').toBeGreaterThan(0);
  const batchState = () => dbVerifier.query(`SELECT Status, Version FROM reconciliationbatches WHERE BatchId=UNHEX('${batchHex}');`);
  const issueCodes: string[] = [];
  for (let offset = 0; offset < 6; offset++) {
    await respectApiBudget(thukhoPage);
    const date = new Date(`${scope.weekStartDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const serviceDate = date.toISOString().slice(0,10);
    await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${serviceDate}`);
    const daily = await thukhoPage.evaluate(async (id) => {
      const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
      if (!response.ok) throw new Error(`Warehouse daily ${response.status}`);
      return (await response.json()).data as MrxWarehouseDaily;
    }, batchId);
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    const before = new Map<string, StockSnapshot>();
    await thukhoPage.route('**/api/inventory-issues', async (route) => {
      if (route.request().method() === 'POST') for (const line of route.request().postDataJSON().lines) {
        const id = binaryId(line.ingredientId);
        before.set(id, dbVerifier.captureStockSnapshot(id));
      }
      await route.continue();
    });
    const issued = thukhoPage.waitForResponse((r) => r.url().endsWith('/api/inventory-issues') && r.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    const response = await issued;
    await thukhoPage.unroute('**/api/inventory-issues');
    expect(response.status(), await response.text()).toBe(201);
    const receipt = (await response.json()).data;
    issueCodes.push(receipt.issueCode);
    const command = response.request().postDataJSON();
    const expected = daily.dates.find((day) => day.serviceDate === serviceDate)!.lines.filter((line) => line.requiredQuantity > 0);
    expect(command.lines).toHaveLength(expected.length);
    for (const line of command.lines) {
      const frozen = expected.find((item) => item.dailyLineId === line.reconciliationBatchDailyLineId);
      expect(frozen, 'Issue must retain exact frozen daily lineage').toBeDefined();
      expect(line.issuedQty).toBe(frozen!.requiredQuantity);
      const id = binaryId(line.ingredientId), stock = before.get(id)!;
      expect(dbVerifier.captureStockSnapshot(id)).toEqual(stock);
    }
    await expect(thukhoPage.getByText('Xuất kho thành công.', { exact: true })).toBeVisible();
  }
  await beptruongPage.bringToFront();
  const cookingResponse = beptruongPage.waitForResponse((r) => r.url().endsWith(`/batches/${batchId}/kitchen-cooking`));
  await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${batchId}`);
  const cooking = (await (await cookingResponse).json()).data as MrxKitchenCooking;
  await expect(beptruongPage.getByRole('heading', { name: 'Phiếu nấu theo lô', exact: true })).toBeVisible();
  const editedShift = acceptedSource.days.find((d) => d.serviceDate === scope.weekStartDate)!.shifts.find((s) => s.shiftName === 'MORNING')!;
  const savory = cooking.rows.filter((r) => r.serviceDate === scope.weekStartDate && r.shiftName === 'Ca sáng' && r.menuVariant === 'Mặn');
  expect([...new Set(savory.map((r) => r.dishCode))].sort()).toEqual([...new Set(editedShift.slots.filter((s) => s.menuVariant === 'savory' && s.dishId).map((s) => s.dishCode))].sort());
  expect(savory.every((r) => r.servings === 1251)).toBe(true);
  const beforeChef = { batch: batchState(), frozen: frozenState(), stocks: [...new Set(cooking.rows.map((r) => r.ingredientCode))].map((code) => dbVerifier.query(`SELECT CAST(cs.currentQty AS CHAR) AS qty FROM currentstock cs JOIN ingredients i ON i.ingredientId=cs.ingredientId WHERE i.ingredientCode='${code.replace(/'/g,"''")}' ORDER BY HEX(cs.warehouseId);`)) };
  const exports: Record<string, string[][]> = {};
  const weekEnd = new Date(`${scope.weekStartDate}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  for (const format of ['csv','xlsx'] as const) {
    const downloaded = beptruongPage.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    const responsePromise = beptruongPage.context().waitForEvent('response', { predicate: (r) => r.url().endsWith(`/batches/${batchId}/kitchen-cooking/${format}`), timeout: 15_000 });
    await beptruongPage.getByRole('button', { name: format === 'csv' ? 'Tải CSV cả lô' : 'Tải Excel cả lô', exact: true }).click();
    const response = await responsePromise;
    expect(response.status(), 'Chef export must authenticate the real download, not open a login/error page').toBe(200);
    const download = await downloaded;
    expect(download, 'Actual browser file download is required').not.toBeNull();
    const file = path.join(evidence, `edited-menu-${batchId}.${format}`);
    await download!.saveAs(file);
    expect(fs.statSync(file).size).toBeGreaterThan(100);
    exports[format] = parseCookingFile(file, format);
    expect(exports[format]).toHaveLength(cooking.rows.length + 1);
    expect(exports[format][0]).toEqual(['Ngày','Thứ','Ca','Thực đơn','Món','Số suất','Nguyên liệu','Đơn vị','Định lượng BOM / suất','Hao hụt (%)','Tổng lượng cần cho món','Khách hàng','Tuần bắt đầu','Tuần kết thúc']);
    const exportedEdited = exports[format].slice(1).filter((r) => r[0] === scope.weekStartDate.split('-').reverse().join('/') && r[2] === 'Ca sáng' && r[3] === 'Mặn');
    expect([...new Set(exportedEdited.map((r) => r[4]))].sort()).toEqual([...new Set(savory.map((r) => r.dishName))].sort());
    expect(exportedEdited.every((r) => r[5] === '1251')).toBe(true);
    for (const row of exports[format].slice(1)) {
      expect(row[11]).toBe(scope.customer!.label);
      expect(row[12]).toBe(scope.weekStartDate.split('-').reverse().join('/'));
      expect(row[13]).toBe(weekEnd.toISOString().slice(0,10).split('-').reverse().join('/'));
      const source = cooking.rows.find((r) => row[0] === r.serviceDate.split('-').reverse().join('/') && row[2] === r.shiftName && row[3] === r.menuVariant && row[4] === r.dishName && row[6] === r.ingredientName);
      expect(source, 'Export contains no out-of-scope source row').toBeDefined();
      expect(Number(row[10])).toBe(source!.totalRequiredQuantity);
    }
  }
  expect(exports.xlsx).toEqual(exports.csv);
  expect(batchState()).toEqual(beforeChef.batch);
  expect(frozenState()).toEqual(beforeChef.frozen);
  expect([...new Set(cooking.rows.map((r) => r.ingredientCode))].map((code) => dbVerifier.query(`SELECT CAST(cs.currentQty AS CHAR) AS qty FROM currentstock cs JOIN ingredients i ON i.ingredientId=cs.ingredientId WHERE i.ingredientCode='${code.replace(/'/g,"''")}' ORDER BY HEX(cs.warehouseId);`))).toEqual(beforeChef.stocks);
  for (const action of [/Xuất kho/, /Xác nhận nhận hàng/, /Chốt đối soát/, /Chỉnh sửa món/]) await expect(beptruongPage.getByRole('button', { name: action })).toHaveCount(0);
  await managerPage.goto(`/reconciliation?batchId=${batchId}`);
  await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
  const completed = managerPage.waitForResponse((r) => r.url().endsWith(`/batches/${batchId}/complete`) && r.request().method() === 'POST');
  await managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }).click();
  expect((await completed).status()).toBe(200);
  await managerPage.reload();
  expect(batchState()[0].Status).toBe('COMPLETED');
  expect(dbVerifier.query(zeroSql)).toEqual(retainedZeros);
  expect(dbVerifier.query(`SELECT HEX(l.issueLineId) AS id FROM inventoryissuelines l JOIN reconciliationbatchdailylines d ON d.DailyLineId=l.reconciliationBatchDailyLineId WHERE d.BatchId=UNHEX('${batchHex}') AND d.RequiredQuantity=0;`)).toEqual([]);
  fs.writeFileSync(path.join(evidence,'retained-zero-terminal.json'),JSON.stringify({batchId,retainedZeros,terminal:'COMPLETED',zeroIssueLines:0,origin:'Actual source dish edits; no seeded zero rows',positiveIssueStockOracle:'Every actual positive line checked independently above'},null,2));
  await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toHaveCount(0);
  await managerPage.goto(`/reconciliation?view=transactions&batchId=${batchId}`);
  const visibleIssueCodes = new Set<string>();
  for (let pageNumber = 1; pageNumber <= 10; pageNumber++) {
    await expect(managerPage.getByRole('table')).toBeVisible();
    for (const code of await managerPage.getByRole('table').getByRole('button', { name: /^ISS-/ }).allTextContents()) visibleIssueCodes.add(code.trim());
    const next = managerPage.getByRole('button', { name: 'Trang sau', exact: true });
    if (!(await next.isEnabled())) break;
    expect(pageNumber, 'History pagination must terminate within the declared scope').toBeLessThan(10);
    const loaded = managerPage.waitForResponse((r) => r.url().includes('/transactions-history?') && r.request().method() === 'GET');
    await next.click();
    expect((await loaded).status()).toBe(200);
    await managerPage.waitForLoadState('networkidle');
  }
  expect([...visibleIssueCodes].sort()).toEqual([...issueCodes].sort());
  const historyDownload = managerPage.waitForEvent('download');
  await managerPage.getByRole('button', { name: 'Tải Excel Lịch sử kho', exact: true }).click();
  const historyFile = path.join(evidence, `edited-history-${batchId}.xlsx`);
  await (await historyDownload).saveAs(historyFile);
  const historyText = parseCookingFile(historyFile, 'xlsx').flat().join('\n');
  expect([...new Set(historyText.match(/ISS-[A-Z0-9-]+/g))].sort()).toEqual([...issueCodes].sort());
  fs.writeFileSync(path.join(evidence, 'merged-dish-customer.json'), JSON.stringify({ customerId: customer.customerId, sourceCustomerId: customerId, customerCode: code, batchId, menuVersionId, acceptedSource, sourceVersionAtChef: cooking.sourceVersion, issueCodes, terminal: batchState(), chefExports: { csvRows: exports.csv.length-1, xlsxRows: exports.xlsx.length-1, noMutations: true, standaloneCustomerWeek: true }, missingBomStatus: 422, snapshots, limitation: 'Declared clone-only alternate-unit/customer-day BOM prerequisites exercised through real FE and six-decimal canonical/stock oracles; same-name/different-ID still requires its separate prerequisite verdict. No production conversion-metadata certification; normalized-name import ambiguity and complete C01–C07 policy matrix remain separate, unqualified cases.' }, null, 2));
});

function binaryId(value: string) {
  const [a,b,c,d,e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}

test('@G6-Menu-Reimport-Ingredient catalog ingredient create is visible after reload and rejects a case variant', async ({ adminPage, dbVerifier }) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const code = `MRXCAT${suffix}`;
  const name = `Nguyên liệu MRX ${suffix}`;
  const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  await adminPage.goto('/admin-data?view=ingredients');
  await expect(adminPage.getByRole('button', { name: 'Thêm nguyên liệu', exact: true })).toBeVisible();
  await adminPage.screenshot({ path: path.join(evidence, 'catalog-ingredient-list-before.png') });
  await adminPage.getByRole('button', { name: 'Thêm nguyên liệu', exact: true }).click();
  const dialog = adminPage.getByRole('dialog', { name: 'Thêm nguyên liệu', exact: true });
  const unitSelector = dialog.getByRole('combobox', { name: 'Đơn vị tính nguyên liệu' });
  const unitId = await unitSelector.locator('option:not([value=""])').first().getAttribute('value');
  expect(unitId).toBeTruthy();
  await dialog.getByRole('textbox', { name: 'Mã nguyên liệu', exact: true }).fill(code);
  await dialog.getByRole('textbox', { name: 'Tên nguyên liệu', exact: true }).fill(name);
  await unitSelector.selectOption(unitId!);
  await adminPage.screenshot({ path: path.join(evidence, 'catalog-ingredient-create-form.png') });
  const createResponse = adminPage.waitForResponse(response => response.url().toLowerCase().endsWith('/api/ingredients') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Lưu nguyên liệu', exact: true }).click();
  expect((await createResponse).status()).toBe(201);
  await expect(dialog).toHaveCount(0);
  await expect(adminPage.getByRole('row', { name: new RegExp(code) })).toBeVisible();
  await adminPage.reload();
  await expect(adminPage.getByRole('row', { name: new RegExp(code) })).toBeVisible();
  await adminPage.screenshot({ path: path.join(evidence, 'catalog-ingredient-after-reload.png') });

  const duplicate = await adminPage.evaluate(async ({ name, unitId, code }) => {
    const response = await fetch('/api/Ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      body: JSON.stringify({ ingredientCode: `${code}B`, ingredientName: name.toUpperCase(), unitId, referencePrice: 0 }),
    });
    return response.status;
  }, { name, unitId, code });
  expect(duplicate).toBe(400);
  const rows = dbVerifier.query<{ code: string }>(`SELECT ingredientCode AS code FROM ingredients WHERE ingredientCode IN ('${code}','${code}B') ORDER BY ingredientCode;`);
  expect(rows).toEqual([{ code }]);
  fs.writeFileSync(path.join(evidence, 'catalog-ingredient-create.json'), JSON.stringify({ code, createdStatus: 201, duplicateStatus: duplicate, persistedCodes: rows.map(row => row.code), reloaded: true, screenshots: ['catalog-ingredient-list-before.png', 'catalog-ingredient-create-form.png', 'catalog-ingredient-after-reload.png'] }, null, 2));
});

test('@G6-Menu-Reimport-Ingredient concurrent ingredient creates retain one active name and unit', async ({ adminPage, dbVerifier }) => {
  const unitId = await adminPage.evaluate(async () => {
    const response = await fetch('/api/Units', { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } });
    if (!response.ok) throw new Error(`Units returned ${response.status}`);
    const body = await response.json();
    return body.data?.[0]?.unitId as string | undefined;
  });
  expect(unitId).toBeTruthy();
  const attempts: Array<{ statuses: number[]; codes: string[] }> = [];
  for (let index = 0; index < 5; index += 1) {
    const suffix = `${Date.now().toString(36).toUpperCase()}${index}`;
    const name = `MRX Race ${suffix}`;
    const statuses = await adminPage.evaluate(async ({ unitId, name, suffix }) => Promise.all(['A', 'B'].map(async letter => {
      const response = await fetch('/api/Ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
        body: JSON.stringify({ ingredientCode: `MRXR${suffix}${letter}`, ingredientName: letter === 'A' ? name : name.toUpperCase(), unitId, referencePrice: 0 }),
      });
      return response.status;
    })), { unitId, name, suffix });
    const rows = dbVerifier.query<{ code: string }>(`SELECT ingredientCode AS code FROM ingredients WHERE ingredientCode IN ('MRXR${suffix}A','MRXR${suffix}B') AND isActive=1 ORDER BY ingredientCode;`);
    attempts.push({ statuses, codes: rows.map(row => row.code) });
  }
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'ingredient-concurrent-create.json'), JSON.stringify({ unitId, attempts }, null, 2));
  for (const attempt of attempts) {
    expect(attempt.statuses.filter(status => status === 201)).toHaveLength(1);
    expect(attempt.codes).toHaveLength(1);
  }
});

test('@G6-Menu-Reimport-BOM manual BOM editor creates ingredient without an accidental BOM write', async ({ adminPage, dbVerifier }) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const code = `MRXBOM${suffix}`;
  const name = `Nguyên liệu BOM ${suffix}`;
  const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  const beforeBom = dbVerifier.query('CHECKSUM TABLE dishbom;');
  await adminPage.goto('/admin-data?view=bom');
  await adminPage.getByRole('button', { name: 'Chỉnh sửa BOM', exact: true }).first().click();
  const dialog = adminPage.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Tạo nguyên liệu mới', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Tạo nguyên liệu mới', exact: true }).click();
  await dialog.getByLabel('Mã nguyên liệu mới', { exact: true }).fill(code);
  await dialog.getByLabel('Tên nguyên liệu mới', { exact: true }).fill(name);
  const unit = dialog.getByLabel('Đơn vị nguyên liệu mới', { exact: true });
  const unitId = await unit.locator('option:not([value=""])').first().getAttribute('value');
  expect(unitId).toBeTruthy();
  await unit.selectOption(unitId!);
  await adminPage.screenshot({ path: path.join(evidence, 'bom-editor-ingredient-create-form.png') });
  const createResponse = adminPage.waitForResponse(response => response.url().toLowerCase().endsWith('/api/ingredients') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Lưu nguyên liệu', exact: true }).click();
  expect((await createResponse).status()).toBe(201);
  await expect(dialog.getByText('Đã tạo nguyên liệu. Nhập định mức/suất và bấm Thêm vào BOM để hoàn tất.', { exact: true })).toBeVisible();
  expect(dbVerifier.query('CHECKSUM TABLE dishbom;')).toEqual(beforeBom);
  expect(dbVerifier.query<{ code: string }>(`SELECT ingredientCode AS code FROM ingredients WHERE ingredientCode='${code}';`)).toEqual([{ code }]);
  await adminPage.screenshot({ path: path.join(evidence, 'bom-editor-ingredient-selected.png') });
  await adminPage.goto('/admin-data?view=ingredients');
  await adminPage.getByPlaceholder('Tìm mã, tên nguyên liệu...').fill(code);
  await expect(adminPage.getByRole('row', { name: new RegExp(code) })).toBeVisible();
  await adminPage.screenshot({ path: path.join(evidence, 'bom-editor-ingredient-catalog-reload.png') });
  fs.writeFileSync(path.join(evidence, 'bom-editor-ingredient-create.json'), JSON.stringify({ code, status: 201, persisted: true, bomUnchangedUntilAdd: true, catalogReloaded: true }, null, 2));
});

test('@G6-Menu-Reimport-BOM bulk missing BOM preview, correction, commit and case-variant reimport', async ({ adminPage, dbVerifier }) => {
  const scope = scenarioScope(dbVerifier, 42);
  const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  const suffix = Date.now().toString(36).toUpperCase();
  const ingredientName = `Nguyên liệu Excel ${suffix}`;
  const unit = dbVerifier.query<{ code: string; id: string }>("SELECT unitCode AS code, HEX(unitId) AS id FROM units WHERE unitCode='kg' LIMIT 1;");
  expect(unit).toHaveLength(1);
  const dishes = dbVerifier.query<{ code: string }>(`SELECT d.dishCode AS code FROM dishes d WHERE d.isActive=1 AND NOT EXISTS (SELECT 1 FROM dishbom b WHERE b.dishId=d.dishId AND b.customerId IS NULL AND b.priceTierAmount=25000 AND b.bomStatus='PUBLISHED' AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}')) ORDER BY d.dishCode LIMIT 3;`);
  expect(dishes, 'Clone requires three actual missing-BOM dishes; no production or fake seed is allowed.').toHaveLength(3);
  const rows = dishes.map((dish, index) => ({ dishCode: dish.code, ingredientCode: '', ingredientName, unitCode: unit[0].code, quantity: String((index + 1) / 10), status: 'PUBLISHED', date: scope.weekStartDate, note: scope.reason }));
  const invalidFile = path.join(evidence, 'missing-bom-invalid-unit.xlsx');
  const validFile = path.join(evidence, 'missing-bom-corrected.xlsx');
  writeBomImportWorkbook(invalidFile, rows.map((row, index) => index === 2 ? { ...row, unitCode: 'INVALID_UNIT' } : row));
  writeBomImportWorkbook(validFile, rows);
  const beforeBom = dbVerifier.query('CHECKSUM TABLE dishbom,ingredients;');
  await adminPage.goto('/admin-data?view=bom');
  await adminPage.getByRole('button', { name: 'Nhập BOM Excel', exact: true }).click();
  const input = adminPage.getByLabel('Chọn file Excel định mức BOM', { exact: true });
  await input.setInputFiles(invalidFile);
  const invalidPreview = adminPage.waitForResponse(response => response.url().endsWith('/bom-import/preview') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xem trước', exact: true }).click();
  const invalidResponse = await invalidPreview;
  expect(invalidResponse.status()).toBe(200);
  expect((await invalidResponse.json()).data.canCommit).toBe(false);
  await expect(adminPage.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true })).toBeDisabled();
  expect(dbVerifier.query('CHECKSUM TABLE dishbom,ingredients;')).toEqual(beforeBom);
  await adminPage.screenshot({ path: path.join(evidence, 'missing-bom-invalid-preview.png') });
  await input.setInputFiles(validFile);
  const validPreview = adminPage.waitForResponse(response => response.url().endsWith('/bom-import/preview') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xem trước', exact: true }).click();
  const validResponse = await validPreview;
  expect(validResponse.status()).toBe(200);
  expect((await validResponse.json()).data.canCommit).toBe(true);
  const codeCell = adminPage.getByTestId('bom-preview-viewport').locator('tbody tr').first().locator('td').nth(3);
  const codeGeometry = async () => codeCell.evaluate(cell => ({ cellRight: cell.getBoundingClientRect().right, codeRight: cell.querySelector('button')!.getBoundingClientRect().right }));
  expect((await codeGeometry()).codeRight).toBeLessThanOrEqual((await codeGeometry()).cellRight + 1);
  await adminPage.screenshot({ path: path.join(evidence, 'missing-bom-corrected-preview.png') });
  await adminPage.setViewportSize({ width: 1024, height: 768 });
  expect((await codeGeometry()).codeRight).toBeLessThanOrEqual((await codeGeometry()).cellRight + 1);
  await adminPage.screenshot({ path: path.join(evidence, 'missing-bom-corrected-preview-1024.png') });
  await adminPage.setViewportSize({ width: 1440, height: 900 });
  const commit = adminPage.waitForResponse(response => response.url().endsWith('/bom-import/commit') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true }).click();
  const committed = await commit;
  expect(committed.status(), await committed.text()).toBe(200);
  expect((await committed.json()).data.createdRows).toBe(3);
  const ingredients = dbVerifier.query<{ id: string; code: string }>(`SELECT HEX(ingredientId) AS id, ingredientCode AS code FROM ingredients WHERE ingredientName='${ingredientName}';`);
  expect(ingredients).toHaveLength(1);
  const bomRows = dbVerifier.query<{ code: string }>(`SELECT d.dishCode AS code FROM dishbom b JOIN dishes d ON d.dishId=b.dishId WHERE b.ingredientId=UNHEX('${ingredients[0].id}') AND b.effectiveFrom='${scope.weekStartDate}' AND b.bomStatus='PUBLISHED' ORDER BY d.dishCode;`);
  expect(bomRows.map(row => row.code)).toEqual(dishes.map(dish => dish.code));
  await adminPage.screenshot({ path: path.join(evidence, 'missing-bom-committed.png') });
  await adminPage.reload();
  await adminPage.getByRole('searchbox', { name: 'Tìm kiếm món ăn' }).fill(dishes[0].code);
  await adminPage.getByRole('button', { name: 'Chỉnh sửa BOM', exact: true }).click();
  await expect(adminPage.getByRole('dialog').getByText(ingredientName, { exact: true })).toBeVisible();
  await adminPage.screenshot({ path: path.join(evidence, 'missing-bom-after-reload.png') });
  const beforeRepeat = dbVerifier.query('CHECKSUM TABLE dishbom,ingredients;');
  const repeatFile = path.join(evidence, 'missing-bom-case-variant-repeat.xlsx');
  writeBomImportWorkbook(repeatFile, rows.map(row => ({ ...row, ingredientName: ingredientName.toUpperCase() })));
  await adminPage.goto('/admin-data?view=bom');
  await adminPage.getByRole('button', { name: 'Nhập BOM Excel', exact: true }).click();
  await adminPage.getByLabel('Chọn file Excel định mức BOM', { exact: true }).setInputFiles(repeatFile);
  const repeatPreview = adminPage.waitForResponse(response => response.url().endsWith('/bom-import/preview') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xem trước', exact: true }).click();
  expect((await (await repeatPreview).json()).data.canCommit).toBe(true);
  const repeatCommit = adminPage.waitForResponse(response => response.url().endsWith('/bom-import/commit') && response.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true }).click();
  const repeatResult = await repeatCommit;
  expect(repeatResult.status(), await repeatResult.text()).toBe(200);
  expect((await repeatResult.json()).data.createdRows).toBe(0);
  expect(dbVerifier.query('CHECKSUM TABLE dishbom,ingredients;')).toEqual(beforeRepeat);
  fs.writeFileSync(path.join(evidence, 'missing-bom-bulk-recovery.json'), JSON.stringify({ week: scope.weekStartDate, dishes: dishes.map(dish => dish.code), invalidPreview: 200, invalidCanCommit: false, commit: 200, ingredientCode: ingredients[0].code, ingredientRows: 1, bomRows: 3, reloaded: true, repeatStatus: 200, repeatCreatedRows: 0, repeatedDataUnchanged: true }, null, 2));
});
