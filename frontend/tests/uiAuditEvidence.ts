import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_SCHEMA_VERSION, validateUiAuditRecord, type UiAuditManifest, type UiAuditRecord, type UiAuditVerdict } from './uiAuditContract';
import { UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { regionFixtureRegistry, ruleFixtureRegistry } from './uiAuditFixtureRegistry';
import { uiAuditOracleRegistry, UI_AUDIT_RULE_IDS } from './uiAuditOracleRegistry';

export const PHASE28_BASELINE_DIR = resolve(process.cwd(), 'test-results/ui-audit-phase28-baseline');
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`; return JSON.stringify(value); }
export function computeRunFingerprint(sourceCommit: string) { return sha256(stable({ schemaVersion:UI_AUDIT_SCHEMA_VERSION, fixtureDataVersion:'phase28-fixtures/v1', sourceCommit, identities:regionFixtureRegistry.map(({ key }) => key).sort(), fixtureKeys:ruleFixtureRegistry.map(({ key }) => key).sort(), rules:UI_AUDIT_RULE_IDS.map((id) => ({ id, expected:uiAuditOracleRegistry[id].expected })), viewports:UI_AUDIT_VIEWPORTS })); }
export function isLedgerRequest(url: string, method: string, resourceType: string, origin = 'http://phase28.local') {
  const parsed = new URL(url, origin); const sameOrigin = parsed.origin === origin; const staticType = ['document','script','stylesheet','font','image'].includes(resourceType); const staticPath = /(?:favicon|source-map|\.map$)/.test(parsed.pathname);
  return parsed.pathname.startsWith('/api/') || !sameOrigin || (!staticType && !staticPath) || !['GET','HEAD'].includes(method);
}
export function writeBaseline(records: UiAuditRecord[], sourceCommit: string): UiAuditManifest {
  records.forEach(validateUiAuditRecord); mkdirSync(resolve(PHASE28_BASELINE_DIR,'records'), { recursive:true });
  const priorPath = resolve(PHASE28_BASELINE_DIR,'manifest.prior.json'); const manifestPath = resolve(PHASE28_BASELINE_DIR,'manifest.json');
  if (existsSync(manifestPath)) writeFileSync(priorPath, readFileSync(manifestPath));
  const recordHashes: Record<string,string> = {}; const totals = Object.fromEntries(['PASS','FAIL','NOT_APPLICABLE','NEEDS_EVIDENCE','UNRESOLVED'].map((v) => [v,0])) as Record<UiAuditVerdict,number>;
  for (const record of records) { const body = `${JSON.stringify(record,null,2)}\n`; const path = resolve(PHASE28_BASELINE_DIR,'records',`${sha256(record.identity)}.json`); mkdirSync(dirname(path),{recursive:true}); const temp=`${path}.tmp`; writeFileSync(temp,body); renameSync(temp,path); validateUiAuditRecord(JSON.parse(readFileSync(path,'utf8'))); recordHashes[record.identity]=sha256(body); record.findings.forEach(({ verdict }) => totals[verdict]++); }
  const identities=records.map(({identity})=>identity); const expected=new Set(regionFixtureRegistry.map(({key})=>key)); const actual=new Set(identities); const fingerprint=computeRunFingerprint(sourceCommit); const prior = existsSync(priorPath) ? (JSON.parse(readFileSync(priorPath,'utf8')) as UiAuditManifest) : undefined;
  const mismatch = prior ? prior.runFingerprint !== fingerprint || prior.identityCount !== records.length || Object.keys(prior.recordHashes).sort().join('|') !== [...actual].sort().join('|') || JSON.stringify(prior.verdictTotals)!==JSON.stringify(totals) : false;
  const manifest: UiAuditManifest = { schemaVersion:UI_AUDIT_SCHEMA_VERSION, sealStatus: prior && !mismatch ? 'SEALED':'OPEN', runFingerprint:fingerprint, ...(prior?{priorManifestHash:sha256(readFileSync(priorPath))}:{}), identityCount:records.length, missingIdentityCount:[...expected].filter((id)=>!actual.has(id)).length, duplicateIdentityCount:identities.length-actual.size, extraIdentityCount:[...actual].filter((id)=>!expected.has(id)).length, regionFixtureMismatchCount:0, invalidRecordCount:0, nonGetObservedRequestCount:records.flatMap(({network})=>network).filter(({method})=>method!=='GET').length, ownerlessFailCount:records.flatMap(({findings})=>findings).filter((f)=>f.verdict==='FAIL'&&!f.lowestOwner).length, guessedPassCount:records.flatMap(({findings})=>findings).filter((f)=>f.verdict==='PASS'&&Object.keys(f.measured).length===0).length, verdictTotals:totals, recordHashes };
  if (manifest.missingIdentityCount||manifest.duplicateIdentityCount||manifest.extraIdentityCount||manifest.nonGetObservedRequestCount||manifest.ownerlessFailCount||manifest.guessedPassCount||mismatch) manifest.sealStatus='OPEN';
  const temp=`${manifestPath}.tmp`; writeFileSync(temp,`${JSON.stringify(manifest,null,2)}\n`); renameSync(temp,manifestPath); return manifest;
}
