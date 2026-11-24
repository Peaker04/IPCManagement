import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { parseCookingFile, scenarioScope } from '../fixtures/mrxWorkflow';
import { respectApiBudget } from '../fixtures/authHelpers';

function editDownloadedRow(source: string, destination: string, rowNumber: number, ingredient: string, unit: string, quantity: number) {
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  const input = Buffer.from(JSON.stringify({ destination, rowNumber, ingredient, unit, quantity })).toString('base64');
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${input}')) | ConvertFrom-Json
    $zip = [IO.Compression.ZipFile]::Open($p.destination, 'Update')
    try {
      $entry = $zip.GetEntry('xl/worksheets/sheet1.xml')
      $reader = [IO.StreamReader]::new($entry.Open())
      try { [xml]$sheet = $reader.ReadToEnd() } finally { $reader.Dispose() }
      $rows = $sheet.worksheet.sheetData
      $target = @($rows.row | Where-Object { [int]$_.r -eq $p.rowNumber })
      if ($target.Count -ne 1) { throw 'Downloaded row missing' }
      foreach ($row in @($rows.row)) {
        if ([int]$row.r -gt 4 -and [int]$row.r -ne $p.rowNumber) { [void]$rows.RemoveChild($row) }
      }
      $values = @{ B = $p.ingredient; C = $p.unit; D = $p.quantity.ToString([Globalization.CultureInfo]::InvariantCulture) }
      foreach ($col in 'B','C','D') {
        $cell = @($target[0].c | Where-Object { $_.r -eq "$col$($p.rowNumber)" })
        if ($cell.Count -ne 1) { throw "Downloaded cell missing: $col" }
        $cell = $cell[0]
        while ($cell.HasChildNodes) { [void]$cell.RemoveChild($cell.FirstChild) }
        $cell.SetAttribute('t','inlineStr')
        $inline = $sheet.CreateElement('is',$cell.NamespaceURI)
        $text = $sheet.CreateElement('t',$cell.NamespaceURI)
        $text.InnerText = $values[$col]
        [void]$inline.AppendChild($text)
        [void]$cell.AppendChild($inline)
      }
      $entry.Delete()
      $writer = [IO.StreamWriter]::new($zip.CreateEntry('xl/worksheets/sheet1.xml').Open(),[Text.UTF8Encoding]::new($false))
      try { $sheet.Save($writer) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20_000 });
}

test('@MRX-ModalAcceptance both BOM downloads round-trip independently across all price tiers', async ({ adminPage, dbVerifier }) => {
  test.setTimeout(300_000);
  const scope = scenarioScope(dbVerifier, 37);
  const start = scope.weekStartDate;
  const second = new Date(`${start}T00:00:00Z`);
  second.setUTCDate(second.getUTCDate() + 1);
  const revisedDate = second.toISOString().slice(0, 10);
  const directory = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
  const [dish] = dbVerifier.query<{ id: string; code: string }>(`
    SELECT HEX(d.dishId) AS id,d.dishCode AS code FROM dishes d
    WHERE d.isActive=1 AND NOT EXISTS (SELECT 1 FROM dishbom b WHERE b.dishId=d.dishId) ORDER BY d.dishCode LIMIT 1;`);
  expect(dish?.id, 'Existing active catalog dish without any BOM').toMatch(/^[A-F0-9]{32}$/);
  type Line = { tier: string; qty: string; starts: string; ends: string; status: string; scope: string };
  const readDish = () => dbVerifier.query<Line>(`
    SELECT CAST(priceTierAmount AS CHAR) AS tier, CAST(grossQtyPerServing AS CHAR) AS qty,
      CAST(effectiveFrom AS CHAR) AS starts, COALESCE(CAST(effectiveTo AS CHAR),'open') AS ends,
      bomStatus AS status, IF(customerId IS NULL,'shared','customer') AS scope
    FROM dishbom WHERE dishId=UNHEX('${dish.id}') ORDER BY priceTierAmount,effectiveFrom;`)
    .map(row => ({ ...row, tier: Number(row.tier), qty: Number(row.qty) }));
  const untouched = () => dbVerifier.query(`
    SELECT CAST(priceTierAmount AS CHAR) AS tier,COUNT(*) AS rowCount,
      BIT_XOR(CRC32(CONCAT_WS('|',HEX(bomId),HEX(dishId),HEX(ingredientId),HEX(unitId),COALESCE(HEX(customerId),'-'),
        grossQtyPerServing,wasteRatePercent,bomStatus,effectiveFrom,COALESCE(CAST(effectiveTo AS CHAR),'-')))) AS digest
    FROM dishbom WHERE dishId<>UNHEX('${dish.id}') GROUP BY priceTierAmount ORDER BY priceTierAmount;`);
  const untouchedBefore = untouched();
  const expected: ReturnType<typeof readDish> = [];
  const report = [];
  const tiers = [25000, 30000, 34000] as const;
  const day = (value: string) => value.split('-').reverse().join('/');
  const dialog = adminPage.getByRole('dialog');
  async function open(date: string) {
    await adminPage.goto('/admin-data?view=bom');
    const dateField = adminPage.getByLabel('Ngày xét BOM', { exact: true });
    await dateField.fill(day(date));
    await dateField.press('Tab');
    await adminPage.getByRole('button', { name: 'Nhập BOM Excel', exact: true }).click();
    await expect(dialog.getByText(`Ngày xét BOM của mẫu · ${day(date)}`)).toBeVisible();
  }
  async function selectTier(tier: number) {
    const radio = dialog.getByRole('radio', { name: `${tier.toLocaleString('vi-VN')} ₫`, exact: true });
    await radio.click();
    await expect(radio).toBeChecked();
  }
  async function download(tier: number, type: 'all' | 'missing', date: string, label: string) {
    await respectApiBudget(adminPage);
    const response = adminPage.waitForResponse(item => new URL(item.url()).pathname.endsWith('/Dishes/mrx/bom-template'));
    const event = adminPage.waitForEvent('download');
    await dialog.getByRole('button', { name: type === 'all' ? 'Tải toàn bộ BOM' : 'Tải mẫu BOM còn thiếu', exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    const query = new URL(result.url()).searchParams;
    expect([query.get('TemplateType'), query.get('PriceTier'), query.get('EffectiveDate'), query.get('CustomerId')])
      .toEqual([type, String(tier), date, null]);
    const file = path.join(directory, `bom-${tier}-${label}-${type}.xlsx`);
    await (await event).saveAs(file);
    const rows = parseCookingFile(file, 'xlsx').slice(4);
    expect(rows.every(row => Number(row[7]) === tier && row[8] === '')).toBe(true);
    if (type === 'missing') expect(rows.every(row => row[1] === '' && row[3] === '')).toBe(true);
    const matching = rows.flatMap((row, index) => row[6] === dish.code ? [{ row, number: index + 5 }] : []);
    return { file, rows, matching };
  }
  async function preview(file: string, date: string, action: 'create' | 'version' | 'skip' | 'blocked') {
    await respectApiBudget(adminPage);
    const input = dialog.getByRole('textbox', { name: 'Ngày áp dụng bản chỉnh sửa' });
    await input.fill(day(date));
    await input.press('Tab');
    await dialog.getByLabel('Chọn file Excel định mức BOM', { exact: true }).setInputFiles(file);
    const response = adminPage.waitForResponse(item => new URL(item.url()).pathname.endsWith('/mrx/bom-import/preview'));
    await dialog.getByRole('button', { name: 'Xem trước', exact: true }).click();
    const result = await response;
    expect(result.status(), await result.text()).toBe(200);
    const { data } = await result.json();
    expect(data.canCommit).toBe(action !== 'blocked');
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].action).toBe(action);
    if (action === 'blocked') expect(data.rows[0].errors).toContain('Mức giá trong file không khớp với mức giá đang nhập.');
  }
  async function commit(created: number) {
    await respectApiBudget(adminPage);
    const response = adminPage.waitForResponse(item => new URL(item.url()).pathname.endsWith('/mrx/bom-import/commit'));
    await dialog.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true }).click();
    const result = await response;
    expect(result.status(), await result.text()).toBe(200);
    expect((await result.json()).data.createdRows).toBe(created);
    expect(readDish()).toEqual(expected);
    expect(untouched()).toEqual(untouchedBefore);
  }

  await open(start);
  for (const [index, tier] of tiers.entries()) {
    await selectTier(tier);
    const full = await download(tier, 'all', start, 'before');
    const missing = await download(tier, 'missing', start, 'before');
    expect(full.matching).toHaveLength(1);
    expect(missing.matching).toHaveLength(1);
    const blank = missing.matching[0];
    expect(full.matching[0].row).toEqual(blank.row);
    expect(missing.rows.map(row => row[6]).sort()).toEqual(full.rows.filter(row => !row[1]).map(row => row[6]).sort());
    const sample = full.rows.find(row => row[1] && Number(row[3]) > 0)!;
    expect(sample, 'At least one current recipe in the cloned catalog at this tier').toBeDefined();
    const createFile = path.join(directory, `bom-${tier}-add.xlsx`);
    const initial = (index + 1) / 10;
    editDownloadedRow(missing.file, createFile, blank.number, sample[1], sample[2], initial);
    if (index === 0) {
      await selectTier(30000);
      await preview(createFile, start, 'blocked');
      await expect(dialog.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true })).toBeDisabled();
      expect(readDish()).toEqual([]);
      expect(untouched()).toEqual(untouchedBefore);
      await selectTier(tier);
    }
    await preview(createFile, start, 'create');
    const old = { tier, qty: initial, starts: start, ends: 'open', status: 'PUBLISHED', scope: 'shared' };
    expected.push(old);
    await commit(1);
    const afterAdd = await download(tier, 'all', start, 'after-add');
    expect(afterAdd.matching).toHaveLength(1);
    const current = afterAdd.matching[0];
    expect(Number(current.row[3])).toBe(initial);
    expect((await download(tier, 'missing', start, 'after-add')).matching).toEqual([]);
    const editFile = path.join(directory, `bom-${tier}-edit.xlsx`);
    const changed = (index + 7) / 10;
    editDownloadedRow(afterAdd.file, editFile, current.number, current.row[1], current.row[2], changed);
    await preview(editFile, revisedDate, 'version');
    old.ends = start;
    expected.push({ ...old, qty: changed, starts: revisedDate, ends: 'open' });
    await commit(1);
    await preview(editFile, revisedDate, 'skip');
    await commit(0);
    report.push({ tier, initial, changed, beforeRows: full.rows.length, beforeMissing: missing.rows.length });
  }
  await open(revisedDate);
  for (const row of report) {
    await selectTier(row.tier);
    const final = await download(row.tier, 'all', revisedDate, 'after-edit');
    expect(final.matching).toHaveLength(1);
    expect(Number(final.matching[0].row[3])).toBe(row.changed);
    expect((await download(row.tier, 'missing', revisedDate, 'after-edit')).matching).toEqual([]);
  }
  fs.writeFileSync(path.join(directory, 'bom-tier-roundtrip.json'), JSON.stringify({ dishCode: dish.code, start, revisedDate,
    wrongTierRejected: true, replayNoDuplicate: true, tiers: report, history: readDish(), otherBomRowsUnchanged: true }, null, 2));
});
