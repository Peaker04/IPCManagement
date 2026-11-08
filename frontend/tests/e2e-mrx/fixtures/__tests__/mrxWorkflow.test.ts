import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MySQLVerifier } from '../../core/mysqlVerifier';
import { scenarioScope, writeBomImportWorkbook, parseCookingFile } from '../mrxWorkflow';
import { execFileSync } from 'node:child_process';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

it('writes real Vietnamese BOM XLSX with numeric quantities and literal leading-zero codes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-bom-workbook-contract-'));
  roots.push(root);
  const file = path.join(root, 'dinh-luong.xlsx');
  writeBomImportWorkbook(file, [{ dishCode: '00017', ingredientCode: '0012', unitCode: 'KG', quantity: '0.123456', status: 'PUBLISHED', date: '2026-09-14', note: '=1+1' }]);
  expect(fs.readFileSync(file).subarray(0, 2).toString()).toBe('PK');
  const literal = `'${file.replace(/'/g, "''")}'`;
  const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead(${literal}); try { $r=[IO.StreamReader]::new($z.GetEntry('xl/worksheets/sheet1.xml').Open()); try {[xml]$x=$r.ReadToEnd()} finally {$r.Dispose()}; @($x.worksheet.sheetData.row[1].c | ForEach-Object { @{r=$_.r;t=$_.t;v=$(if($_.t -eq 'inlineStr'){[string]$_.is.t}else{[string]$_.v});formula=[bool]$_.f} }) | ConvertTo-Json -Compress } finally {$z.Dispose()}`;
  const cells = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8' })) as { r: string; t: string; v: string; formula: boolean }[];
  expect(cells.find(c => c.r === 'A2')).toMatchObject({ t: 'inlineStr', v: '00017' });
  expect(cells.find(c => c.r === 'M2')).toMatchObject({ t: 'inlineStr', v: '0012' });
  expect(cells.find(c => c.r === 'G2')).toMatchObject({ t: 'n', v: '0.123456' });
  expect(cells.find(c => c.r === 'L2')).toMatchObject({ t: 'inlineStr', v: '=1+1' });
  expect(cells.every(c => !c.formula)).toBe(true);
  const parsed = parseCookingFile(file, 'xlsx');
  expect(parsed[0][6]).toBe('Định lượng/suất');
  expect(parsed[1][0]).toBe('00017');
  expect(parsed[1][6]).toBe('0.123456');
  // Report exporters preserve whitespace on text nodes; PowerShell exposes those as XmlElement, not string.
  const preserveScript = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::Open(${literal},[IO.Compression.ZipArchiveMode]::Update); try { $entry=$z.GetEntry('xl/worksheets/sheet1.xml'); $reader=[IO.StreamReader]::new($entry.Open()); try {$text=$reader.ReadToEnd()} finally {$reader.Dispose()}; $entry.Delete(); $writer=[IO.StreamWriter]::new($z.CreateEntry('xl/worksheets/sheet1.xml').Open(),[Text.UTF8Encoding]::new($false)); try {$writer.Write($text.Replace('<t>','<t xml:space="preserve">'))} finally {$writer.Dispose()} } finally {$z.Dispose()}`;
  execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(preserveScript, 'utf16le').toString('base64')], { stdio: 'pipe' });
  const preserved = parseCookingFile(file, 'xlsx');
  expect(preserved[0][0]).toBe('Mã món');
  expect(preserved[1][0]).toBe('00017');
  expect(preserved[1][1]).toBe('');
  expect(preserved[1][6]).toBe('0.123456');
  expect(preserved[1][11]).toBe('=1+1');
});

it('isolates repeated campaign cases by attempt without changing the guarded database identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-scope-contract-'));
  roots.push(root);
  const runId = '20261101t120000z_a1b2c3';
  for (const [key, value] of Object.entries({
    MRX_EVIDENCE_RUN_ID: runId, MRX_E2E_CAMPAIGN_ID: runId, MRX_EVIDENCE_ATTEMPT_ID: '20261103t120001z_aaaaaa',
    MRX_E2E_PROFILE: 'qualification', MRX_E2E_PREPARED_DATABASE: '1', MRX_E2E_PHASE: 'functional',
    MRX_E2E_DATABASE: `ipc_mrx_evidence_${runId}`, MRX_E2E_ARTIFACT_DIRECTORY: root,
  })) vi.stubEnv(key, value);
  const defaults = path.join(root, 'fixture.defaults');
  fs.writeFileSync(defaults, '[client]');
  const verifier = new MySQLVerifier(`ipc_mrx_evidence_${runId}`, 5263, 'never-executed', defaults);
  const query = vi.spyOn(verifier, 'query').mockReturnValue([{ count: '0' }]);
  vi.stubEnv('MRX_EVIDENCE_ATTEMPT_ID', '20261103t120001z_aaaaaa');
  const first = scenarioScope(verifier, 6);
  vi.stubEnv('MRX_EVIDENCE_ATTEMPT_ID', '20261103t120002z_bbbbbb');
  const second = scenarioScope(verifier, 6);
  expect(first.runId).toBe(runId);
  expect(second.runId).toBe(runId);
  expect(first.caseId).not.toBe(second.caseId);
  expect(first.reason).not.toBe(second.reason);
  expect(first.workbook).not.toBe(second.workbook);
  expect(fs.statSync(first.workbook).size).toBeGreaterThan(0);
  expect(fs.statSync(second.workbook).size).toBeGreaterThan(0);
  expect(() => scenarioScope(verifier, -1)).toThrow(/ordinal/);
  vi.stubEnv('MRX_EVIDENCE_ATTEMPT_ID', '');
  expect(() => scenarioScope(verifier, 6)).toThrow(/attempt/i);
  vi.stubEnv('MRX_EVIDENCE_ATTEMPT_ID', '20261103t120002z_bbbbbb');
  query.mockReturnValue([{ count: '1' }]);
  expect(() => scenarioScope(verifier, 6)).toThrow(/bounded search/i);
});
