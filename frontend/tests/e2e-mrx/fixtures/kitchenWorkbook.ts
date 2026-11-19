import { execFileSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { materialQuantityMicros, type CoverageDish, type CoverageSource, type MenuCoverageManifest } from './menuCoverage';
import { parseCookingFile } from './mrxWorkflow';

type Recipe = Omit<CoverageDish, 'materials'> & {
  materials: (CoverageDish['materials'][number] & { ingredientName: string; unitName: string })[];
};

function unitLabel(name: string): string {
  return ({ kilogram: 'kg', kilograms: 'kg', gram: 'g', grams: 'g', liter: 'lít',
    litre: 'lít', liters: 'lít', litres: 'lít', milliliter: 'ml', millilitre: 'ml',
    milliliters: 'ml', millilitres: 'ml' } as Record<string, string>)[name.trim().toLowerCase()] ?? name.trim();
}

export function assertKitchenWorkbook(
  file: string,
  orders: { customer: { code: string }; manifest: MenuCoverageManifest }[],
  recipes: Recipe[],
  scope?: Pick<CoverageSource, 'date' | 'shift'>,
) {
  const worksheet = parseCookingFile(file, 'xlsx');
  const literal = "'" + file.replace(/'/g, "''") + "'";
  const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem;
  $zip=[IO.Compression.ZipFile]::OpenRead(${literal});
  try{$reader=[IO.StreamReader]::new($zip.GetEntry('xl/worksheets/sheet1.xml').Open());
  try{[xml]$sheet=$reader.ReadToEnd()}finally{$reader.Dispose()};
  ConvertTo-Json -Compress -InputObject @{merges=@($sheet.worksheet.mergeCells.mergeCell | ForEach-Object {$_.ref});
  breaks=@($sheet.worksheet.rowBreaks.brk | ForEach-Object {[int]$_.id})}}finally{$zip.Dispose()}`;
  const layout = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' })) as {
    merges: string[]; breaks: number[];
  };
  const headers = worksheet[1].slice(5, 8);
  expect(headers).toEqual(orders.map(order => order.customer.code).sort());
  const pending = new Map<string, { counts: number[]; recipe: Recipe }>();
  for (const { customer, manifest } of orders) {
    for (const source of manifest.source) {
      const { date, shift, variant, dishCode } = source;
      if (scope && (date !== scope.date || shift !== scope.shift)) continue;
      const recipe = recipes.find(dish => dish.code === dishCode)!;
      const weekday = new Date(date).getUTCDay() + 1;
      const heading = `Thứ ${weekday} · ${date.split('-').reverse().join('/')} · ${shift === 'MORNING' ? 'Ca sáng' : 'Ca chiều'} · ${variant === 'savory' ? 'Mặn' : 'Chay'}`;
      const key = `${heading}/${recipe.name}`;
      const block = pending.get(key) ?? { counts: [0, 0, 0], recipe };
      block.counts[headers.indexOf(customer.code)] = manifest.servings.find(row => row.date === date && row.shift === shift)![variant];
      pending.set(key, block);
    }
  }
  const participation = [0, 0, 0];
  const sections = new Set<string>();
  const days = new Set<string>();
  const expectedMerges = new Set(['A1:A2', 'B1:B2', 'C1:C2', 'D1:D2', 'E1:E2', 'I1:I2', 'F1:H1']);
  let day = '';
  let heading = '';
  let block: { name: string; ingredients: string[][]; totals: number[]; recipe: Recipe } | undefined;
  const verifyIngredients = () => {
    if (!block) return;
    const counts = block.totals;
    const expected = block.recipe.materials.map(material => {
      const rate = Number(material.grossQtyPerServing) * Number(material.sourceRate) / Number(material.targetRate);
      const total = counts.reduce((sum, count) => sum + materialQuantityMicros(material.grossQtyPerServing,
        count, material.sourceRate, material.targetRate), 0n);
      return JSON.stringify([`${material.ingredientName} (${unitLabel(material.unitName)})`, rate.toPrecision(13), total.toString()]);
    }).sort();
    const actual = block.ingredients.map(([name, rate, total]) =>
      JSON.stringify([name, Number(rate).toPrecision(13), materialQuantityMicros(total, 1, '1', '1').toString()])).sort();
    expect(actual, `${heading} / ${block.name} ingredients`).toEqual(expected);
    block = undefined;
  };
  for (let index = 2; index < worksheet.length; index++) {
    const row = worksheet[index];
    const rowNumber = index + 1;
    if (row[0] && !row[1] && !row[2]) {
      verifyIngredients();
      if (row[0].startsWith('Thứ ')) {
        expect(row[0]).toMatch(/^Thứ [2-7] · \d{2}\/\d{2}\/\d{4}$/);
        expect(days.has(row[0]), 'The day banner must appear once').toBe(false);
        day = row[0];
        days.add(day);
        heading = '';
      } else {
        expect(day).not.toBe('');
        expect(row[0]).toMatch(/^Ca (sáng|chiều) · (Chay|Mặn)$/);
        heading = `${day} · ${row[0]}`;
        expect(sections.has(heading), 'The shift/variant heading must appear once per day').toBe(false);
        sections.add(heading);
      }
      expect(row.slice(1).every(value => value === '')).toBe(true);
      expectedMerges.add(`A${rowNumber}:I${rowNumber}`);
      continue;
    }
    if (row[1]) {
      verifyIngredients();
      const key = `${heading}/${row[0]}`;
      const expected = pending.get(key);
      expect(expected, `Unexpected or duplicate dish ${key}`).toBeDefined();
      const { counts, recipe } = expected!;
      expect(row.slice(5, 8)).toEqual(counts.map(count => count ? String(count) : '–'));
      expect(Number(row[1])).toBe(counts.reduce((total, count) => total + count, 0));
      expect(row[8]).toBe('–');
      participation[counts.filter(Boolean).length - 1]++;
      pending.delete(key);
      block = { name: row[0], ingredients: [], totals: counts, recipe };
    } else expect(row[0], 'A dish must have one uninterrupted block').toBe('');
    expect(block, `Ingredient row ${rowNumber} must belong to a dish`).toBeDefined();
    block!.ingredients.push(row.slice(2, 5));
    if (!row[0]) continue;
    let last = index;
    while (last + 1 < worksheet.length && !worksheet[last + 1][0]) last++;
    if (last > index) {
      for (const column of ['A', 'B', 'F', 'G', 'H', 'I']) expectedMerges.add(`${column}${rowNumber}:${column}${last + 1}`);
      for (const child of worksheet.slice(index + 1, last + 1)) {
        expect([child[0], child[1], ...child.slice(5)]).toEqual(['', '', '', '', '', '']);
        expect(child[2]).not.toBe('');
      }
    }
  }
  verifyIngredients();
  expect([...pending.keys()], 'Menu dishes missing from the download').toEqual([]);
  expect(days.size).toBe(scope ? 1 : 6);
  expect(sections.size).toBe(scope ? 2 : 24);
  if (!scope) expect([...sections]).toEqual([...days].flatMap(date =>
    ['Ca sáng · Chay', 'Ca sáng · Mặn', 'Ca chiều · Chay', 'Ca chiều · Mặn'].map(label => `${date} · ${label}`)));
  for (const count of participation) expect(count, 'Each of one, two and three recipients is exercised').toBeGreaterThan(0);
  expect(layout.merges.sort()).toEqual([...expectedMerges].sort());
  for (const row of layout.breaks) expect(worksheet[row][0], 'Manual breaks must fall between dishes').not.toBe('');
  return { days: days.size, sections: sections.size, participation, sourceSlots: orders.map(order => order.manifest.source.length),
    inputMerges: orders.map(order => order.manifest.merges), outputMerges: layout.merges.length, manualPageBreaks: layout.breaks.length };
}
