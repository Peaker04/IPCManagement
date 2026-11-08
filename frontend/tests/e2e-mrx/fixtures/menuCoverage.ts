import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { MrxScenarioScope } from './mrxWorkflow';

export type CoverageVariant = 'savory' | 'vegetarian';
export type CoverageShift = 'MORNING' | 'AFTERNOON';
export interface CoverageDish {
  code: string;
  name: string;
  variant: CoverageVariant;
  materials: { ingredientCode: string; canonicalUnitCode: string; grossQtyPerServing: string; sourceRate: string; targetRate: string }[];
}
export interface CoverageSource {
  date: string; shift: CoverageShift; variant: CoverageVariant; slot: string; dishCode: string;
}
export interface CoverageServings {
  date: string; shift: CoverageShift; savory: number; vegetarian: number;
}
export interface ServingInputFact {
  date: string; shift: CoverageShift; scheduleId: string; quantityPlanLineId: string | null;
  savory: number | null; vegetarian: number | null; final: number | null;
}

export function assertServingInputs(expected: CoverageServings[], actual: ServingInputFact[]): void {
  const fail = (detail: string): never => { throw new Error(`Serving input mismatch: ${detail}; actual=${JSON.stringify(actual)}`); };
  if (actual.length !== expected.length) fail(`expected ${expected.length} rows, got ${actual.length}`);
  const schedules = new Set<string>(), lines = new Set<string>(), keys = new Set<string>();
  for (const row of expected) {
    const key = `${row.date}/${row.shift}`;
    if (keys.has(key)) fail(`duplicate authored key ${key}`);
    keys.add(key);
    const matches = actual.filter((fact) => fact.date === row.date && fact.shift === row.shift);
    if (matches.length !== 1) fail(`${key}: expected one schedule/line, got ${matches.length}`);
    const fact = matches[0];
    if (!fact.scheduleId || !fact.quantityPlanLineId || schedules.has(fact.scheduleId) || lines.has(fact.quantityPlanLineId)) {
      fail(`${key}: missing or repeated schedule/quantity-line identity`);
    }
    schedules.add(fact.scheduleId);
    lines.add(fact.quantityPlanLineId!);
    if (fact.savory !== row.savory || fact.vegetarian !== row.vegetarian || fact.final !== row.savory + row.vegetarian) {
      fail(`${key}: expected savory=${row.savory}, vegetarian=${row.vegetarian}, final=${row.savory + row.vegetarian}`);
    }
  }
}

export interface MenuCoverageManifest {
  workbook: string;
  rectangularWorkbook: string;
  changedWorkbook: string;
  manifestPath: string;
  templateSha256: string;
  workbookSha256: string;
  source: CoverageSource[];
  servings: CoverageServings[];
  dishes: CoverageDish[];
  merges: string[];
  beforeMaterials: ReturnType<typeof materialTotals>;
}

function rational(value: string): [bigint, bigint] {
  if (!/^\d+(?:\.\d{1,18})?$/.test(value)) throw new Error('Invalid nonnegative decimal in independent oracle.');
  const [whole, fraction = ''] = value.split('.');
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
function micros(rate: string, count: number, sourceRate: string, targetRate: string): bigint {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid servings in independent oracle.');
  const [r, rd] = rational(rate), [s, sd] = rational(sourceRate), [t, td] = rational(targetRate);
  if (s === 0n || t === 0n) throw new Error('Missing positive unit conversion.');
  const n = r * BigInt(count) * s * td * 1_000_000n, d = rd * sd * t;
  return (n * 2n + d) / (2n * d);
}
function decimal(value: bigint): string { return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, '0')}`; }

// Independent arithmetic over recorded master facts; never calls application projection/parser code.
export function materialTotals(source: CoverageSource[], dishes: CoverageDish[], servings: CoverageServings[]) {
  const totals = new Map<string, { date: string; ingredientCode: string; canonicalUnitCode: string; micros: bigint }>();
  const seen = new Set<string>();
  for (const row of source) {
    const key = `${row.date}/${row.shift}/${row.variant}/${row.dishCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = dishes.filter((dish) => dish.code === row.dishCode && dish.variant === row.variant);
    if (matches.length !== 1 || matches[0].materials.length === 0) throw new Error(`Missing/ambiguous BOM for ${row.dishCode}.`);
    const counts = servings.filter((item) => item.date === row.date && item.shift === row.shift);
    if (counts.length !== 1) throw new Error(`Missing/ambiguous servings for ${row.date}/${row.shift}.`);
    const count = counts[0][row.variant];
    for (const item of matches[0].materials) {
      const quantity = micros(item.grossQtyPerServing, count, item.sourceRate, item.targetRate);
      if (count > 0 && rational(item.grossQtyPerServing)[0] > 0n && quantity === 0n) throw new Error('Submicro material cannot be persisted.');
      if (quantity === 0n) continue;
      const materialKey = `${row.date}/${item.ingredientCode}/${item.canonicalUnitCode}`;
      const total = totals.get(materialKey) ?? { date: row.date, ingredientCode: item.ingredientCode, canonicalUnitCode: item.canonicalUnitCode, micros: 0n };
      total.micros += quantity;
      totals.set(materialKey, total);
    }
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => ({
    date: item.date, ingredientCode: item.ingredientCode, canonicalUnitCode: item.canonicalUnitCode, quantity: decimal(item.micros),
  }));
}

export function writeMenuCoverage(scope: MrxScenarioScope, dishes: CoverageDish[]): MenuCoverageManifest {
  const monday = new Date(`${scope.weekStartDate}T00:00:00Z`);
  if (Number.isNaN(monday.valueOf()) || monday.getUTCDay() !== 1 || monday.toISOString().slice(0, 10) !== scope.weekStartDate) throw new Error('Coverage requires a valid Monday.');
  if (!/^[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$/.test(scope.runId) || !scope.caseId.startsWith(`${scope.attemptId}_`)) throw new Error('Coverage requires owned run/case identity.');
  if (new Set(dishes.map((dish) => dish.code)).size !== dishes.length) throw new Error('Duplicate coverage dish codes.');
  for (const variant of ['savory', 'vegetarian'] as const) {
    const group = dishes.filter((dish) => dish.variant === variant);
    if (group.length < 2 || new Set(group.map((dish) => dish.name)).size !== group.length || group.some((dish) => !dish.code || !dish.name || dish.materials.length === 0)) {
      throw new Error(`Coverage requires at least two uniquely resolved ${variant} dishes with BOMs.`);
    }
  }
  const root = fs.existsSync('backend/tests') ? process.cwd() : path.resolve('..');
  const template = path.join(root, 'backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx');
  const workbook = scope.workbook.replace(/\.xlsx$/, '-coverage.xlsx');
  if (workbook === scope.workbook || path.dirname(workbook) !== path.dirname(scope.workbook)) throw new Error('Coverage needs an XLSX scope path.');
  const manifestPath = workbook.replace(/\.xlsx$/, '.json');
  const rectangularWorkbook = workbook.replace(/\.xlsx$/, '-rectangular.xlsx');
  const changedWorkbook = workbook.replace(/\.xlsx$/, '-changed.xlsx');
  for (const file of [workbook, manifestPath, rectangularWorkbook, changedWorkbook]) if (fs.existsSync(file)) throw new Error('Coverage output exists; refusing overwrite.');
  const date = (offset: number) => new Date(monday.valueOf() + offset * 86_400_000).toISOString().slice(0, 10);
  const source: CoverageSource[] = [], servings: CoverageServings[] = [], merges: string[] = [];
  const cells: Record<string, string> = {
    C4: `Từ ngày ${date(0).split('-').reverse().join('/')} đến ngày ${date(5).split('-').reverse().join('/')}`,
  };
  const sections = [
    { row: 9, shift: 'MORNING', variant: 'savory', rotate: 0 },
    { row: 15, shift: 'MORNING', variant: 'vegetarian', rotate: 0 },
    { row: 21, shift: 'AFTERNOON', variant: 'savory', rotate: 2 },
    { row: 27, shift: 'AFTERNOON', variant: 'vegetarian', rotate: 2 },
  ] as const;
  const slots = ['main', 'sub1', 'rau', 'canh', 'dessert'];
  for (let day = 0; day < 6; day++) {
    cells[`${String.fromCharCode(68 + day)}7`] = date(day).split('-').reverse().join('/');
    servings.push({ date: date(day), shift: 'MORNING', savory: 1000 + day, vegetarian: 51 + day });
    servings.push({ date: date(day), shift: 'AFTERNOON', savory: 803 + day, vegetarian: 37 + day });
  }
  for (const section of sections) {
    const group = dishes.filter((dish) => dish.variant === section.variant);
    merges.push(`D${section.row}:E${section.row}`, `F${section.row}:F${section.row + 1}`);
    for (let slot = 0; slot < 5; slot++) for (let day = 0; day < 6; day++) {
      const index = (slot === 0 && day < 2 ? section.rotate
        : day === 2 && slot < 2 ? section.rotate + 1 : day + slot + section.rotate) % group.length;
      const dish = group[index];
      source.push({ date: date(day), shift: section.shift, variant: section.variant, slot: slots[slot], dishCode: dish.code });
      cells[`${String.fromCharCode(68 + day)}${section.row + slot}`] = (slot === 0 && day === 1) || (day === 2 && slot === 1) ? '' : dish.name;
    }
  }
  const payload = Buffer.from(JSON.stringify({ cells, merges, outputs: { workbook, rectangularWorkbook, changedWorkbook },
    changedName: dishes.filter((d) => d.variant === 'savory').at(-1)!.name }), 'utf8').toString('base64');
  const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
  // Preserve template labels/styles/other tier sheets; replace only authored data cells and merges.
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem;
$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;
foreach($kind in @('workbook','rectangularWorkbook','changedWorkbook')) {
 $out=[string]$p.outputs.$kind; [IO.File]::Copy(${quote(template)},$out,$false);
 $z=[IO.Compression.ZipFile]::Open($out,[IO.Compression.ZipArchiveMode]::Update);
 try {
  $e=$z.GetEntry('xl/worksheets/sheet1.xml');$r=[IO.StreamReader]::new($e.Open());try{[xml]$x=$r.ReadToEnd()}finally{$r.Dispose()};
  $ns=[Xml.XmlNamespaceManager]::new($x.NameTable);$ns.AddNamespace('s','http://schemas.openxmlformats.org/spreadsheetml/2006/main');
  foreach($prop in $p.cells.PSObject.Properties) {
   $c=$x.SelectSingleNode('//s:c[@r="'+$prop.Name+'"]',$ns);if(!$c){throw ('Missing canonical cell '+$prop.Name)};
   while($c.HasChildNodes){[void]$c.RemoveChild($c.FirstChild)};$c.SetAttribute('t','inlineStr');
   $is=$x.CreateElement('is',$ns.LookupNamespace('s'));$t=$x.CreateElement('t',$ns.LookupNamespace('s'));$t.InnerText=[string]$prop.Value;[void]$is.AppendChild($t);[void]$c.AppendChild($is);
  }
  $mc=$x.SelectSingleNode('//s:mergeCells',$ns);foreach($m in @($mc.ChildNodes)){if($m.ref -match '^[D-I]'){[void]$mc.RemoveChild($m)}};
  foreach($range in $p.merges){$m=$x.CreateElement('mergeCell',$ns.LookupNamespace('s'));$m.SetAttribute('ref',[string]$range);[void]$mc.AppendChild($m)};
  if($kind -eq 'rectangularWorkbook'){
   $m=$x.CreateElement('mergeCell',$ns.LookupNamespace('s'));$m.SetAttribute('ref','G11:H12');[void]$mc.AppendChild($m);
   foreach($ref in @('H11','G12','H12')){$x.SelectSingleNode('//s:c[@r="'+$ref+'"]//s:t',$ns).InnerText=''}
  }
  if($kind -eq 'changedWorkbook'){$x.SelectSingleNode('//s:c[@r="D9"]//s:t',$ns).InnerText=[string]$p.changedName};
  $mc.SetAttribute('count',[string]$mc.ChildNodes.Count);
  $e.Delete();$w=[IO.StreamWriter]::new($z.CreateEntry('xl/worksheets/sheet1.xml').Open(),[Text.UTF8Encoding]::new($false));try{$x.Save($w)}finally{$w.Dispose()};
 } finally {$z.Dispose()}
}`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { stdio: 'pipe' });
  const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const manifest: MenuCoverageManifest = { workbook, rectangularWorkbook, changedWorkbook, manifestPath, templateSha256: hash(template), workbookSha256: hash(workbook), source, servings, dishes, merges, beforeMaterials: materialTotals(source, dishes, servings) };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}
