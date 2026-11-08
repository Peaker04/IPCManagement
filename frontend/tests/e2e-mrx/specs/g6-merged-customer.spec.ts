import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope, parseCookingFile, writeBomImportWorkbook } from '../fixtures/mrxWorkflow';
import type { StockSnapshot } from '../core/mysqlVerifier';
import type { MrxEditScope, MrxKitchenCooking, MrxWarehouseDaily } from '../../../src/api/mrxApi';

test.setTimeout(360_000);
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
  await dialog.getByRole('button', { name: 'Tạo khách hàng & Hợp đồng', exact: true }).click();
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
  await dieuphoiPage.getByLabel('Chọn khách hàng MRX').selectOption({ label: 'ANV - AMANN' });
  await beptruongPage.goto('/admin-data?view=customers');
  await expect(beptruongPage.getByRole('button', { name: 'Thêm khách hàng mới', exact: true })).toHaveCount(0);
  const denied = await beptruongPage.evaluate(async () => (await fetch('/api/coordination/customer-contracts', { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' } })).status);
  expect(denied).toBe(403);
  console.log('[UI] Manager created/reloaded shared customer; Coordinator selected it in MRX; Chef denied.');

  const beforeInvalidImport = dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches;');
  await dieuphoiPage.getByRole('button', { name: 'Nhập thực đơn Excel', exact: true }).first().click();
  await dieuphoiPage.locator('select#import-customer-select').selectOption({ label: 'ANV - AMANN' });
  await dieuphoiPage.getByLabel('Tuần bắt đầu nhập', { exact: true }).fill(scope.weekStartDate.split('-').reverse().join('/'));
  await dieuphoiPage.getByLabel('Tuần bắt đầu nhập', { exact: true }).press('Enter');
  await dieuphoiPage.setInputFiles('input[type="file"]', path.resolve('README.md'));
  const invalidPreview = dieuphoiPage.waitForResponse((r) => r.url().endsWith('/weekly-menu/import/preview') && r.request().method() === 'POST');
  await dieuphoiPage.getByRole('button', { name: 'Xem trước', exact: true }).click();
  const invalidResponse = await invalidPreview;
  expect(invalidResponse.status()).toBe(200); // Preview returns a validation DTO, not a persisted import.
  const invalid = (await invalidResponse.json()).data;
  expect(invalid.validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'FILE_READ_ERROR', severity: 'error' })]));
  await expect(dieuphoiPage.getByRole('button', { name: 'Xác nhận nhập', exact: true })).toBeDisabled();
  await expect(dieuphoiPage.getByRole('status')).toContainText('Có lỗi cần sửa');
  await expect(dieuphoiPage.getByRole('dialog')).toContainText(invalid.validation.issues.find((i: { code: string }) => i.code === 'FILE_READ_ERROR').message);
  expect(dbVerifier.query('CHECKSUM TABLE menuversions,menuschedules,menuitems,mealquantityplanlines,reconciliationbatches;')).toEqual(beforeInvalidImport);
  await dieuphoiPage.getByRole('button', { name: 'Đóng', exact: true }).click();
  fs.writeFileSync(path.join(evidence, 'invalid-import-no-write.json'), JSON.stringify({ input: 'existing README.md (not a workbook)', code: 'FILE_READ_ERROR', commitDisabled: true, sourceUnchanged: true, recovery: 'Next real valid-workbook import in this same scope' }, null, 2));
  const { batchId, menuVersionId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  await adminPage.bringToFront();
  await adminPage.goto(`/weekly-menu?view=mrx-batch&weekStartDate=${scope.weekStartDate}`);
  const customerId = await adminPage.getByLabel('Chọn khách hàng MRX').inputValue();
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
    const input = adminPage.getByRole('combobox', { name: `${slotLabel} ${short} MORNING`, exact: true });
    await input.fill(dish.dishName!);
    await adminPage.getByRole('listbox').getByRole('option').filter({ has: adminPage.getByText(dish.dishCode!, { exact: true }) }).click();
  }
  const snapshots: object[] = [];
  const remountObservations: object[] = [];
  async function applyAndCheck(label: string, expectedIds: string[], servings: number) {
    await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
    await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} ${label}`);
    await adminPage.getByRole('button', { name: 'Xem ảnh hưởng', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true }).click();
    const applied = adminPage.waitForResponse((r) => r.url().endsWith('/mrx-apply') && r.request().method() === 'POST');
    const refreshed = adminPage.waitForResponse((r) => r.url().endsWith('/reconciliation/batches/quantity-import/preview') && r.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Xác nhận áp dụng', exact: true }).click();
    const [applyResponse, refreshResponse] = await Promise.all([applied, refreshed]);
    expect(applyResponse.status()).toBe(200);
    expect(refreshResponse.status()).toBe(200);
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
  await adminPage.getByRole('button', { name: `Sửa từng dòng ${slots[0].slotLabel} ${short} MORNING`, exact: true }).click();
  for (const slot of slots) await choose(slot.slotLabel, slots[0]);
  await adminPage.getByRole('button', { name: 'Hoàn tất sửa từng dòng', exact: true }).click();
  await expect(adminPage.getByRole('combobox', { name: `${slots[0].slotLabel} ${short} MORNING`, exact: true }).locator('xpath=ancestor::td')).toHaveAttribute('rowspan', '4');
  await adminPage.getByRole('spinbutton', { name: `Số suất Mặn ${short} MORNING`, exact: true }).fill('1200');
  await applyAndCheck('large-four-slots', slots.map(() => slots[0].dishId!), 1200);
  await editToggle().click();
  await choose(slots[0].slotLabel, dishes.find((d) => d.dishId !== slots[0].dishId)!);
  const replacement = dishes.find((d) => d.dishId !== slots[0].dishId)!;
  await applyAndCheck('replace-whole-group', slots.map(() => replacement.dishId!), 1200);
  await editToggle().click();
  await adminPage.getByRole('button', { name: `Sửa từng dòng ${slots[0].slotLabel} ${short} MORNING`, exact: true }).click();
  for (const [index, slot] of slots.entries()) await choose(slot.slotLabel, dishes[index]);
  await adminPage.getByRole('button', { name: 'Hoàn tất sửa từng dòng', exact: true }).click();
  await adminPage.getByRole('spinbutton', { name: `Số suất Mặn ${short} MORNING`, exact: true }).fill('1250');
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
  const candidateIds = catalog.filter((d) => d.isActive).map((d) => `UNHEX('${binaryId(d.dishId)}')`);
  expect(candidateIds.length).toBeGreaterThan(0);
  const missingRows = dbVerifier.query<{ id: string }>(`SELECT HEX(d.dishId) AS id FROM dishes d WHERE d.dishId IN (${candidateIds.join(',')}) AND NOT EXISTS (SELECT 1 FROM dishbom b WHERE b.dishId=d.dishId AND (b.customerId IS NULL OR b.customerId=UNHEX('${binaryId(customerId)}')) AND b.bomStatus='PUBLISHED' AND b.priceTierAmount=25000 AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}')) ORDER BY id LIMIT 1;`);
  expect(missingRows, 'Missing-BOM proof requires a real uncovered catalog dish, not invented fixtures.').toHaveLength(1);
  const missing = catalog.find((d) => binaryId(d.dishId) === missingRows[0].id)!;
  const prerequisites = {
    sameNameDifferentIds: dbVerifier.query<{id:string;dishName:string;dishCode:string}>(`SELECT HEX(d.dishId) AS id, d.dishName, d.dishCode FROM dishes d WHERE d.isActive=1 AND EXISTS (SELECT 1 FROM dishes other WHERE other.isActive=1 AND other.dishName=d.dishName AND other.dishId<>d.dishId) AND EXISTS (SELECT 1 FROM dishbom b WHERE b.dishId=d.dishId AND b.bomStatus='PUBLISHED' AND (b.customerId IS NULL OR b.customerId=UNHEX('${binaryId(customerId)}')) AND b.priceTierAmount=25000 AND b.effectiveFrom<='${scope.weekStartDate}' AND (b.effectiveTo IS NULL OR b.effectiveTo>='${scope.weekStartDate}')) ORDER BY d.dishName,id LIMIT 10;`),
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
  await adminPage.getByRole('button', { name: /Tiếp tục xem ảnh hưởng \(\d+\)/ }).click();
  await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} genuine missing BOM`);
  const rejected = adminPage.waitForResponse((r) => r.url().endsWith('/amendments/preview') && r.request().method() === 'POST');
  await adminPage.getByRole('button', { name: 'Xem ảnh hưởng', exact: true }).click();
  expect((await rejected).status()).toBe(422);
  await expect(adminPage.getByText('Món thay thế chưa có định mức cho ngày phục vụ.', { exact: true })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Áp dụng ngay', exact: true })).toBeDisabled();
  expect(await readScope()).toEqual(beforeMissing);
  expect(frozenState()).toEqual(beforeFrozen);
  await adminPage.screenshot({ path: path.join(evidence, '22-real-missing-bom-blocked.png') });
  await adminPage.getByRole('button', { name: 'Quay lại thực đơn', exact: true }).click();
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
  await adminPage.getByRole('spinbutton',{name:`Số suất Mặn ${short} MORNING`,exact:true}).fill('1251');
  await adminPage.getByRole('button',{name:/Tiếp tục xem ảnh hưởng \(\d+\)/}).click();
  await adminPage.getByLabel('Lý do thay đổi nguồn').fill(`${scope.reason} invalid conversion rejection`);
  const invalidConversion=adminPage.waitForResponse((r)=>r.url().endsWith('/amendments/preview') && r.request().method()==='POST');
  await adminPage.getByRole('button',{name:'Xem ảnh hưởng',exact:true}).click();
  const invalidResult=await invalidConversion;
  expect(invalidResult.status(),await invalidResult.text()).toBe(400);
  expect((await invalidResult.json()).message).toMatch(/quy đổi/);
  expect(dbVerifier.query(noWriteSql)).toEqual(afterBadPreparation);
  await expect(adminPage.getByText('Đơn vị nguyên liệu chưa có quy đổi chuẩn hợp lệ.',{exact:true})).toBeVisible();
  await expect(adminPage.getByRole('button',{name:'Áp dụng ngay',exact:true})).toBeDisabled();
  await adminPage.getByRole('button',{name:'Quay lại thực đơn',exact:true}).click();
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
      expect(row[11]).toBe('ANV - AMANN');
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
  fs.writeFileSync(path.join(evidence, 'merged-dish-customer.json'), JSON.stringify({ customerId: customer.customerId, sourceCustomerId: customerId, customerCode: code, batchId, menuVersionId, acceptedSource, sourceVersionAtChef: cooking.sourceVersion, issueCodes, terminal: batchState(), chefExports: { csvRows: exports.csv.length-1, xlsxRows: exports.xlsx.length-1, noMutations: true, standaloneCustomerWeek: true }, missingBomStatus: 422, snapshots, limitation: 'Declared clone-only alternate-unit/customer-day BOM prerequisites exercised through real FE and six-decimal canonical/stock oracles; same-name/different-ID still requires its separate prerequisite verdict. No production conversion-metadata certification or new-customer BOM onboarding claim.' }, null, 2));
});

function binaryId(value: string) {
  const [a,b,c,d,e] = value.split('-');
  const reverse = (part: string) => part.match(/../g)!.reverse().join('');
  return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
}
