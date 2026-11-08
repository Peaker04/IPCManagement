import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assertServingInputs, materialTotals, writeMenuCoverage, type CoverageDish, type ServingInputFact } from '../menuCoverage';

const inputRows: ServingInputFact[] = [
  { date: '2026-11-09', shift: 'MORNING', scheduleId: 'schedule-a', quantityPlanLineId: 'line-a', savory: 101, vegetarian: 17, final: 118 },
  { date: '2026-11-10', shift: 'MORNING', scheduleId: 'schedule-b', quantityPlanLineId: 'line-b', savory: 203, vegetarian: 29, final: 232 },
];
const inputExpected = [
  { date: '2026-11-09', shift: 'MORNING' as const, savory: 101, vegetarian: 17 },
  { date: '2026-11-10', shift: 'MORNING' as const, savory: 203, vegetarian: 29 },
];
it.each([
  { name: 'exact raw inputs', rows: inputRows, valid: true },
  { name: 'duplicate quantity line', rows: [...inputRows, { ...inputRows[0], quantityPlanLineId: 'line-extra' }], valid: false },
  { name: 'missing schedule', rows: inputRows.slice(1), valid: false },
  { name: 'missing outer-joined quantity line', rows: [{ ...inputRows[0], quantityPlanLineId: null, savory: null, vegetarian: null, final: null }, inputRows[1]], valid: false },
  { name: 'wrong split with correct total', rows: [{ ...inputRows[0], savory: 102, vegetarian: 16 }, inputRows[1]], valid: false },
  { name: 'offsetting date errors', rows: [{ ...inputRows[0], savory: 102, final: 119 }, { ...inputRows[1], savory: 202, final: 231 }], valid: false },
  { name: 'duplicate schedule for one date and shift', rows: [...inputRows, { ...inputRows[0], scheduleId: 'schedule-extra', quantityPlanLineId: 'line-extra' }], valid: false },
  { name: 'unexpected shift', rows: [inputRows[0], { ...inputRows[1], shift: 'AFTERNOON' as const }], valid: false },
  { name: 'wrong final with correct split', rows: [{ ...inputRows[0], final: 119 }, inputRows[1]], valid: false },
])('serving input gate: $name', ({ rows, valid }) => {
  if (valid) expect(() => assertServingInputs(inputExpected, rows)).not.toThrow();
  else expect(() => assertServingInputs(inputExpected, rows)).toThrow(/Serving input/);
});

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const dishes: CoverageDish[] = ['savory', 'vegetarian'].flatMap((variant) => [0, 1, 2, 3].map((index) => ({
  code: `${variant}-${index}`, name: `${variant} món ${index} & đậu`, variant: variant as 'savory' | 'vegetarian',
  materials: [{ ingredientCode: `I-${index}`, canonicalUnitCode: 'KG', grossQtyPerServing: `0.00${index + 1}`, sourceRate: '1', targetRate: '1' }],
})));
const scopeFor = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-menu-coverage-')); roots.push(root);
  return { runId: '20261105t120000z_aaaaaa', attemptId: '20261105t120000z_aaaaaa', caseId: '20261105t120000z_aaaaaa_12', weekStartDate: '2026-11-09', reason: 'Test only', workbook: path.join(root, 'scope.xlsx') };
};

it('writes_four_sections_without_overwriting_template', () => {
  const scope = scopeFor();
  const template = path.resolve('../backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx');
  const hash = () => createHash('sha256').update(fs.readFileSync(template)).digest('hex');
  const before = hash();
  const manifest = writeMenuCoverage(scope, dishes);
  expect(hash()).toBe(before);
  expect(manifest.source).toHaveLength(120);
  expect([...new Set(manifest.source.map((row) => `${row.shift}/${row.variant}`))].sort()).toEqual([
    'AFTERNOON/savory', 'AFTERNOON/vegetarian', 'MORNING/savory', 'MORNING/vegetarian',
  ]);
  expect(manifest.source.every((row) => row.date >= '2026-11-09' && row.date <= '2026-11-14')).toBe(true);
  // Read the actual ZIP/XML with an independent platform reader, not generator metadata.
  const literal = `'${manifest.workbook.replace(/'/g, "''")}'`;
  const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead(${literal}); try {$r=[IO.StreamReader]::new($z.GetEntry('xl/worksheets/sheet1.xml').Open()); try{[xml]$x=$r.ReadToEnd()}finally{$r.Dispose()}; @{merges=@($x.worksheet.mergeCells.mergeCell|%{[string]$_.ref});cells=@($x.worksheet.sheetData.row.c|?{$_.t -eq 'inlineStr'}|%{@{ref=[string]$_.r;text=[string]$_.is.t}})}|ConvertTo-Json -Depth 4 -Compress}finally{$z.Dispose()}`;
  const actual = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8' }));
  expect(actual.merges).toEqual(expect.arrayContaining(['D9:E9', 'F9:F10', 'D15:E15', 'F15:F16', 'D21:E21', 'F21:F22', 'D27:E27', 'F27:F28']));
  expect(actual.cells).toContainEqual({ ref: 'D9', text: 'savory món 0 & đậu' });
  expect(actual.cells).toContainEqual({ ref: 'D15', text: 'vegetarian món 0 & đậu' });
  expect(actual.cells).toContainEqual({ ref: 'D7', text: '09/11/2026' });
  expect(actual.cells).toContainEqual({ ref: 'C4', text: 'Từ ngày 09/11/2026 đến ngày 14/11/2026' });
  expect(() => writeMenuCoverage(scope, dishes)).toThrow(/exists|overwrite/i);
});

it('expands_horizontal_and_vertical_members_without_cross_section_leak', () => {
  const manifest = writeMenuCoverage(scopeFor(), dishes);
  const select = (date: string, slot: string, variant = 'savory', shift = 'MORNING') => manifest.source.find((r) => r.date === date && r.slot === slot && r.variant === variant && r.shift === shift)?.dishCode;
  expect(select('2026-11-09', 'main')).toBe('savory-0');
  expect(select('2026-11-10', 'main')).toBe('savory-0');
  expect(select('2026-11-11', 'main')).toBe('savory-1');
  expect(select('2026-11-11', 'sub1')).toBe('savory-1');
  expect(select('2026-11-09', 'main', 'vegetarian')).toBe('vegetarian-0');
  expect(select('2026-11-09', 'main', 'savory', 'AFTERNOON')).toBe('savory-2');
});

it('computes_changed_servings_from_authored_decimal_rates', () => {
  const recipe: CoverageDish[] = [{ code: 'A', name: 'A', variant: 'savory', materials: [
    { ingredientCode: 'FINE', canonicalUnitCode: 'KG', grossQtyPerServing: '0.00000049', sourceRate: '1', targetRate: '1' },
    { ingredientCode: 'GRAM', canonicalUnitCode: 'KG', grossQtyPerServing: '1.234567', sourceRate: '0.001', targetRate: '1' },
  ] }];
  const source = [
    { date: '2026-11-09', shift: 'MORNING' as const, variant: 'savory' as const, slot: 'main', dishCode: 'A' },
    { date: '2026-11-09', shift: 'MORNING' as const, variant: 'savory' as const, slot: 'sub1', dishCode: 'A' },
  ];
  expect(materialTotals(source, recipe, [{ date: '2026-11-09', shift: 'MORNING', savory: 1000, vegetarian: 51 }])).toEqual([
    { date: '2026-11-09', ingredientCode: 'FINE', canonicalUnitCode: 'KG', quantity: '0.000490' },
    { date: '2026-11-09', ingredientCode: 'GRAM', canonicalUnitCode: 'KG', quantity: '1.234567' },
  ]);
  expect(materialTotals(source, recipe, [{ date: '2026-11-09', shift: 'MORNING', savory: 1017, vegetarian: 51 }])).toEqual([
    { date: '2026-11-09', ingredientCode: 'FINE', canonicalUnitCode: 'KG', quantity: '0.000498' },
    { date: '2026-11-09', ingredientCode: 'GRAM', canonicalUnitCode: 'KG', quantity: '1.255555' },
  ]);
  expect(() => materialTotals(source, recipe, [])).toThrow(/servings/i);
  expect(() => writeMenuCoverage(scopeFor(), [...dishes, dishes[0]])).toThrow(/duplicate/i);
});
