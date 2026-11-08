import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope, parseCookingFile, captureStationUI } from '../fixtures/mrxWorkflow';
import type { MrxWarehouseDaily, MrxBatch, MrxCompletedRegisterReport, MrxTransactionHistoryReport } from '../../../src/api/mrxApi';

test.describe('@G3-Alt Alternative Business Flows', () => {
  test('BOM import dialog exposes the two supported template downloads (discovery only)', async ({ adminPage }) => {
    await adminPage.goto('/admin-data?view=bom');
    await adminPage.waitForSelector('button:has-text("Nhập BOM Excel")', { timeout: 15000 });

    await adminPage.click('button:has-text("Nhập BOM Excel")');
    await adminPage.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    // Assert both missing BOM and full catalog template download buttons exist
    const missingBtn = adminPage.locator('div[role="dialog"] button:has-text("Tải file Excel các món thiếu BOM")');
    const fullBtn = adminPage.locator('div[role="dialog"] button:has-text("Tải file mẫu toàn bộ")');

    await expect(missingBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();

    await adminPage.click('div[role="dialog"] button:has-text("Đóng")');
  });

  test.describe('Submitted lifecycle', () => {
  test.setTimeout(300_000);
  test('@G3-Submitted Xuất thiếu → bổ sung → xử lý thừa → Manager chốt tuần và lịch sử, không trả hàng', async ({ dieuphoiPage, adminPage, thukhoPage, managerPage, beptruongPage, dbVerifier }) => {
    const scope = scenarioScope(dbVerifier, 1);
    const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope, true);
    await thukhoPage.bringToFront();
    const url = `/warehouse?view=mrx-daily&batchId=${batchId}&date=${scope.weekStartDate}`;
    await thukhoPage.goto(url);
    const readDaily = () => thukhoPage.evaluate(async (id) => {
      const token = localStorage.getItem('ipc_v3_token');
      const response = await fetch(`/api/reconciliation/batches/${id}/warehouse-daily`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
      });
      if (!response.ok) throw new Error('Actual warehouse projection failed.');
      return (await response.json()).data;
    }, batchId) as Promise<MrxWarehouseDaily>;
    const daily = await readDaily();
    const day = daily.dates.find((item) => item.serviceDate === scope.weekStartDate)!;
    expect(day).toBeTruthy();
    const line = day.lines.find((item) => item.requiredQuantity > 1)!;
    expect(line).toBeTruthy();
    await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
    await captureStationUI(thukhoPage, 'daily-issue', 1280, 720, thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }));
    await thukhoPage.getByLabel(`Số lượng thực xuất ${line.ingredientName}`, { exact: true }).fill(String(line.requiredQuantity - 1));
    const initial = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click();
    expect((await initial).ok()).toBe(true);
    await expect(thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeVisible();
    const short = (await readDaily()).dates.find((item) => item.serviceDate === scope.weekStartDate)!.lines.find((item) => item.dailyLineId === line.dailyLineId)!;
    expect(short.remainingQuantity).toBe(1);
    const [a, b, c, d, e] = line.ingredientId.split('-');
    const reverse = (value: string) => value.match(/../g)!.reverse().join('');
    const ingredientHex = `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();
    const before = dbVerifier.captureStockSnapshot(ingredientHex);
    const dailyHex = (() => { const [a,b,c,d,e] = line.dailyLineId.split('-'); return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase(); })();
    const decisions = () => dbVerifier.query(`SELECT HEX(DispositionId) AS id, Version AS version FROM reconciliationdailydispositions WHERE DailyLineId=UNHEX('${dailyHex}');`);
    const beforeDecisions = decisions();
    const denied = await managerPage.evaluate(async ({ id, reason }) => {
      const response = await fetch(`/api/reconciliation/daily-lines/${id}/disposition`, { method: 'PUT', headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'Content-Type': 'application/json', 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' }, body: JSON.stringify({ category: 'ACCEPTED_VARIANCE', reason }) });
      return { status: response.status, body: await response.json() };
    }, { id: line.dailyLineId, reason: `${scope.reason} cannot waive missing1` });
    expect(denied.status, denied.body.message).toBe(400);
    expect(denied.body.message).toContain('xuất thiếu phải được xuất bổ sung');
    expect(decisions()).toEqual(beforeDecisions);
    expect(dbVerifier.captureStockSnapshot(ingredientHex)).toEqual(before);
    expect((await readDaily()).dates.find((item) => item.serviceDate === scope.weekStartDate)!.lines.find((item) => item.dailyLineId === line.dailyLineId)!.remainingQuantity).toBe(1);
    console.log('[BUSINESS] Genuine initial shortage1 cannot be waived by Manager; no stock/decision effects.');
    await thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
    const dialog = thukhoPage.getByRole('dialog', { name: 'Xuất kho bổ sung trong ca' });
    await expect(dialog).toBeVisible();
    await thukhoPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true })).toBeFocused();
    await thukhoPage.getByRole('button', { name: 'Xuất bổ sung ca', exact: true }).click();
    await dialog.getByLabel('Chọn nguyên liệu bổ sung', { exact: true }).selectOption(line.dailyLineId);
    await dialog.getByLabel('Số lượng xuất thêm', { exact: true }).fill('1');
    await expect(dialog.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true })).toBeDisabled();
    await dialog.getByLabel('Lý do xuất bổ sung', { exact: true }).fill(scope.reason);
    const supplementalControl = dialog.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true });
    await captureStationUI(thukhoPage, 'supplemental-dialog', 1280, 720, supplementalControl);
    await captureStationUI(thukhoPage, 'supplemental-dialog', 960, 720, supplementalControl);
    await thukhoPage.setViewportSize({ width: 1280, height: 720 });
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
    await thukhoPage.screenshot({ path: path.join(evidence, '10-supplemental-filled.png') });
    console.log('[UI] Thủ kho: đã bấm Xuất bổ sung ca, chọn dòng thiếu, nhập 1 và lý do; bấm Xác nhận xuất bổ sung.');
    const supplemental = thukhoPage.waitForResponse((response) => response.url().endsWith('/api/inventory-issues') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Xác nhận xuất bổ sung', exact: true }).click();
    const response = await supplemental;
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON().isSupplemental).toBe(true);
    const created = (await response.json()).data;
    await expect(dialog).toHaveCount(0);
    expect(dbVerifier.captureStockSnapshot(ingredientHex)).toEqual(before);
    expect(created.provisions).toEqual([]);
    await thukhoPage.reload();
    const reloaded = (await readDaily()).dates.find((item) => item.serviceDate === scope.weekStartDate)!.lines.find((item) => item.dailyLineId === line.dailyLineId)!;
    expect(reloaded.remainingQuantity).toBe(0);
    expect(reloaded.issuedQuantity).toBe(line.requiredQuantity);
    expect(created.issueCode).toMatch(/^[A-Za-z0-9-]+$/);
    const persisted = dbVerifier.query<{ Reason: string; IssuedQty: string }>(`SELECT a.Reason, l.IssuedQty FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId JOIN auditlogs a ON a.EntityId=l.issueLineId AND a.EntityName='InventoryIssueLine' WHERE i.issueCode='${created.issueCode}';`);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].Reason).toBe(scope.reason);
    expect(Number(persisted[0].IssuedQty)).toBe(1);
    await thukhoPage.screenshot({ path: path.join(evidence, '11-supplemental-reloaded.png') });
    console.log('[UI] Xuất bổ sung thành công; reload hết thiếu, tồn vật lý không đổi và audit đúng phiếu/dòng/lý do.');
    const issueCodes = [created.issueCode];
    let overLine: MrxWarehouseDaily['dates'][number]['lines'][number] | undefined;
    for (let offset=1; offset<6; offset++) {
      const date = new Date(`${scope.weekStartDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+offset);
      const serviceDate=date.toISOString().slice(0,10);
      await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${batchId}&date=${serviceDate}`);
      await thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      if (offset===1) {
        overLine=(await readDaily()).dates.find((day)=>day.serviceDate===serviceDate)!.lines.find((item)=>item.requiredQuantity>0)!;
        expect(overLine).toBeTruthy();
        await thukhoPage.getByLabel(`Số lượng thực xuất ${overLine.ingredientName}`, { exact:true }).fill(String(overLine.requiredQuantity+2));
        await thukhoPage.getByLabel(`Lý do chênh lệch ${overLine.ingredientName}`, { exact:true }).fill(`${scope.reason} over2`);
      }
      const posted=thukhoPage.waitForResponse((response)=>response.url().endsWith('/api/inventory-issues') && response.request().method()==='POST');
      await thukhoPage.getByRole('button', { name:'Xác nhận xuất kho', exact:true }).click();
      const response=await posted; expect(response.status()).toBe(201);
      issueCodes.push((await response.json()).data.issueCode);
    }
    const managerBatch = async () => managerPage.evaluate(async (id) => {
      const response=await fetch(`/api/reconciliation/batches/${id}`, { headers:{Authorization:`Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode':'MATERIAL_RECONCILIATION'} });
      if(!response.ok) throw new Error(`Batch read failed ${response.status}`);
      return (await response.json()).data as MrxBatch;
    }, batchId);
    expect((await managerBatch()).dailyReview!.weeklyStatus).not.toBe('WEEK_COMPLETE');
    const dispositionUrl=`/api/reconciliation/daily-lines/${overLine!.dailyLineId}/disposition`;
    await managerPage.bringToFront();
    const overDate = new Date(`${scope.weekStartDate}T00:00:00Z`); overDate.setUTCDate(overDate.getUTCDate() + 1);
    await managerPage.goto(`/reconciliation?batchId=${batchId}&date=${overDate.toISOString().slice(0,10)}`);
    for(const version of [1,2]) {
      await managerPage.getByRole('toolbar', { name: 'Lọc trạng thái dòng' }).getByRole('button', { name: /^Tất cả/ }).click();
      const action = version === 1 ? 'Xử lý chênh lệch' : 'Xem hướng xử lý';
      await managerPage.getByRole('button', { name: `${action} ${overLine!.ingredientName}`, exact: true }).click();
      const dialog = managerPage.getByRole('dialog', { name: 'Xử lý chênh lệch theo ngày', exact: true });
      await expect(dialog).toBeVisible();
      if (version === 2) await expect(dialog.getByText(`${scope.reason} overage decision1`, { exact: true })).toBeVisible();
      await dialog.getByLabel('Lý do xử lý chênh lệch', { exact: true }).fill(`${scope.reason} overage decision${version}`);
      const saved = managerPage.waitForResponse((response) => response.url().endsWith(dispositionUrl) && response.request().method() === 'PUT');
      await dialog.getByRole('button', { name: 'Lưu hướng xử lý', exact: true }).click();
      expect((await saved).status()).toBe(204);
      await expect(dialog).toHaveCount(0);
      await managerPage.reload();
    }
    await managerPage.screenshot({ path: path.join(evidence, '12-manager-disposition-corrected.png') });
    const [oa,ob,oc,od,oe]=overLine!.dailyLineId.split('-');
    const overHex=`${reverse(oa)}${reverse(ob)}${reverse(oc)}${od}${oe}`.toUpperCase();
    expect(dbVerifier.query(`SELECT CAST(Version AS CHAR) AS version, (InvalidatedAt IS NULL) AS active, Reason AS reason FROM reconciliationdailydispositions WHERE DailyLineId=UNHEX('${overHex}') ORDER BY Version;`)).toEqual([
      {version:'1',active:'0',reason:`${scope.reason} overage decision1`}, {version:'2',active:'1',reason:`${scope.reason} overage decision2`},
    ]);
    const ready=await managerBatch();
    expect(ready.dailyReview!.weeklyStatus).toBe('WEEK_COMPLETE');
    const accepted=ready.dailyReview!.lines.find((item)=>item.dailyLineId===overLine!.dailyLineId)!;
    expect(accepted.issuedRequiredDifference).toBe(2);
    expect(accepted.disposition!.reason).toBe(`${scope.reason} overage decision2`);
    await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${batchId}`);
    await expect(beptruongPage.getByRole('heading',{name:'Phiếu nấu theo lô',exact:true})).toBeVisible();
    await captureStationUI(beptruongPage, 'chef-cooking', 1920, 1080, beptruongPage.getByRole('button', { name: 'Tải Excel cả lô', exact: true }));
    await managerPage.goto(`/reconciliation?batchId=${batchId}`);
    await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toBeEnabled();
    await managerPage.getByRole('button',{name:'Chốt đối soát tuần',exact:true}).click();
    await captureStationUI(managerPage, 'completion-dialog', 1920, 1080, managerPage.getByRole('button', { name: 'Xác nhận khóa chốt tuần', exact: true }));
    await managerPage.keyboard.press('Escape');
    await expect(managerPage.getByRole('dialog')).toHaveCount(0);
    await expect(managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true })).toBeFocused();
    await managerPage.getByRole('button', { name: 'Chốt đối soát tuần', exact: true }).click();
    const completed=managerPage.waitForResponse((response)=>response.url().endsWith(`/api/reconciliation/batches/${batchId}/complete`) && response.request().method()==='POST');
    await managerPage.getByRole('button',{name:'Xác nhận khóa chốt tuần',exact:true}).click();
    expect((await completed).status()).toBe(200);
    await managerPage.reload();
    expect((await managerBatch()).status).toBe('COMPLETED');
    await expect(managerPage.getByRole('button',{name:'Chốt đối soát tuần',exact:true})).toHaveCount(0);
    const reports=await managerPage.evaluate(async (id)=>{
      const headers={Authorization:`Bearer ${localStorage.getItem('ipc_v3_token')}`,'X-Operational-Mode':'MATERIAL_RECONCILIATION'};
      const register=await fetch('/api/reconciliation/reports/completed-register?pageSize=100',{headers});
      if(!register.ok) throw new Error(`Completed register ${register.status}`);
      const completed=(await register.json()).data as MrxCompletedRegisterReport;
      const documents: string[]=[];
      for(let page=1;page<=20;page++) {
        const response=await fetch(`/api/reconciliation/reports/transactions-history?batchId=${id}&pageSize=100&pageNumber=${page}`,{headers});
        if(!response.ok) throw new Error(`History ${response.status}`);
        const history=(await response.json()).data as MrxTransactionHistoryReport;
        if(history.items.some((row)=>row.batchId!==id)) throw new Error('Cross-batch history leakage');
        documents.push(...history.items.map((row)=>row.documentCode));
        if(!history.hasNext) return { completed:completed.rows.find((row)=>row.batchId===id), documents:[...new Set(documents)] };
      }
      throw new Error('History exceeded declared20page bound');
    },batchId);
    expect(reports.completed).toBeTruthy();
    expect(reports.completed!.totalVariance).toBe(2);
    for(const code of issueCodes) expect(reports.documents).toContain(code);
    const batchHex=(()=>{const [a,b,c,d,e]=batchId.split('-');return `${reverse(a)}${reverse(b)}${reverse(c)}${d}${e}`.toUpperCase();})();
    const actualCodes=dbVerifier.query<{code:string}>(`SELECT issueCode AS code FROM inventoryissues WHERE reconciliationBatchId=UNHEX('${batchHex}') ORDER BY issueCode;`).map((row)=>row.code);
    expect(reports.documents.sort()).toEqual(actualCodes);
    await managerPage.goto(`/reconciliation?view=completed&batchId=${batchId}`);
    const completedRow = managerPage.getByRole('row').filter({ has: managerPage.getByText(batchId, { exact: true }) });
    await expect(completedRow).toContainText(scope.weekStartDate.split('-').reverse().join('/'));
    expect(new Set(daily.dates.flatMap(day => day.lines.map(item => item.canonicalUnitId))).size).toBeGreaterThan(1);
    expect(reports.completed!.quantityUnitName).toBeNull();
    await expect(completedRow.getByRole('cell', { name: 'Xem chi tiết theo đơn vị', exact: true })).toHaveCount(3);
    await expect(completedRow).not.toContainText(/\+2\s*kg/);
    await captureStationUI(managerPage, 'completed-report', 1920, 1080, managerPage.getByRole('button', { name: 'Tải Excel Danh bạ hoàn tất', exact: true }));
    const downloaded = managerPage.waitForEvent('download');
    await managerPage.getByRole('button', { name: 'Tải Excel Danh bạ hoàn tất', exact: true }).click();
    const file = path.join(evidence, `completed-overage-${batchId}.xlsx`);
    await (await downloaded).saveAs(file);
    const workbookRows = parseCookingFile(file, 'xlsx');
    expect(workbookRows[0][0]).toBe('Mã lô');
    const exported = workbookRows.slice(1).map(row => ({ MaLo: row[0], NgayBatDau: row[2], TongNhuCau: row[8], TongThucXuat: row[9], TongChenhLech: row[10], DonViCuaTong: row[11] }));
    const target = exported.filter((row)=>row.MaLo===batchId);
    expect(target).toHaveLength(1);
    expect(target[0].NgayBatDau).toBe(scope.weekStartDate.split('-').reverse().join('/'));
    expect([target[0].TongNhuCau, target[0].TongThucXuat, target[0].TongChenhLech]).toEqual(['', '', '']);
    expect(target[0].DonViCuaTong).toBe('Xem chi tiết theo đơn vị');
    const required=dbVerifier.query<{qty:string}>(`SELECT CAST(SUM(RequiredQuantity) AS CHAR) AS qty FROM reconciliationbatchdailylines WHERE BatchId=UNHEX('${batchHex}');`)[0].qty;
    const issued=dbVerifier.query<{qty:string}>(`SELECT CAST(SUM(l.issuedQty) AS CHAR) AS qty FROM inventoryissuelines l JOIN inventoryissues i ON i.issueId=l.issueId WHERE i.reconciliationBatchId=UNHEX('${batchHex}');`)[0].qty;
    // Legacy JSON totals stay compatible; business XLSX must not label mixed-unit sums as quantities.
    expect(reports.completed!.totalRequired.toFixed(6)).toBe(Number(required).toFixed(6));
    expect(reports.completed!.totalIssued!.toFixed(6)).toBe(Number(issued).toFixed(6));
    for (const report of [
      { view: 'variances', button: 'Tải Excel Sổ chênh lệch', header: 'Mã lô' },
      { view: 'audit', button: 'Tải Excel Nhật ký', header: 'Mã nhật ký' },
    ]) {
      await managerPage.goto(`/reconciliation?view=${report.view}&batchId=${batchId}`);
      const control = managerPage.getByRole('button', { name: report.button, exact: true });
      await expect(control).toBeEnabled();
      const download = managerPage.waitForEvent('download');
      await control.click();
      const reportFile = path.join(evidence, `${report.view}-${batchId}.xlsx`);
      await (await download).saveAs(reportFile);
      const rows = parseCookingFile(reportFile, 'xlsx');
      expect(rows[0][0]).toBe(report.header);
      expect(rows.length).toBeGreaterThan(1);
      expect(rows.flat()).toContain(`${scope.reason} overage decision2`);
      if (report.view === 'variances') {
        expect(rows.slice(1).every(row => row[0] === batchId)).toBe(true);
        const overage = rows.slice(1).find(row => row[12] === `${scope.reason} overage decision2`);
        expect(overage).toBeTruthy();
        expect(Number(overage![9])).toBe(2);
      }
    }
    fs.writeFileSync(path.join(evidence,'no-return-lifecycle.json'),JSON.stringify({batchId,shortageDeniedStatus:denied.status,supplementalQty:1,overageQty:2,decisionVersions:[1,2],finalStatus:'COMPLETED',totalVariance:reports.completed!.totalVariance,documents:reports.documents,completedUiAndFileVerified:true,exported:target[0],limitation:'Negative shortage and corroborating report reads use authenticated public HTTP; completed register UI and parsed XLSX export are real FE actions. No return or kitchen-ack commands.'},null,2));
    console.log('[BUSINESS]6dates + supplementary issue, overage2 retained honestly, decision correction append-only, Chef view, distinct Manager completion/reload and exact scoped report documents verified.');
  });
  });

});
