import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

const root = resolve(process.cwd(), 'src');
const spacingProperties = new Set(['margin','margin-top','margin-right','margin-bottom','margin-left','padding','padding-top','padding-right','padding-bottom','padding-left','gap','row-gap','column-gap']);
const approvedSpacing = new Set([0,4,8,16,24,32,48,64]);
export type SourceLiteralFinding = { file: string; line: number; property: string; token: string; owner: string; disposition: 'baseline-production-fact' };
function files(path: string): string[] { return readdirSync(path).flatMap((name) => { const item = resolve(path,name); return statSync(item).isDirectory() ? files(item) : ['.css','.ts','.tsx'].includes(extname(item)) ? [item] : []; }); }
export function scanUiSourceLiterals(): SourceLiteralFinding[] {
  const findings: SourceLiteralFinding[] = [];
  for (const file of files(root)) readFileSync(file,'utf8').split(/\r?\n/).forEach((line,index) => {
    const css = line.match(/^\s*([a-z-]+)\s*:\s*([^;]+)/); const property = css?.[1]; const value = css?.[2] ?? '';
    if (property && spacingProperties.has(property)) for (const match of value.matchAll(/(-?\d+(?:\.\d+)?)px\b/g)) if (!approvedSpacing.has(Number(match[1]))) findings.push({ file: relative(process.cwd(),file).replaceAll('\\','/'), line:index+1, property, token:match[0], owner:'production-source', disposition:'baseline-production-fact' });
    if (property && /color|background|border|outline|fill|stroke/.test(property) && !/var\(--/.test(value)) for (const match of value.matchAll(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi)) findings.push({ file: relative(process.cwd(),file).replaceAll('\\','/'), line:index+1, property, token:match[0], owner:'production-source', disposition:'baseline-production-fact' });
  });
  return findings;
}
describe('Phase 28 read-only production source literal census', () => {
  it('reports contextual production facts without claiming rendered PASS', () => {
    const findings = scanUiSourceLiterals();
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((finding) => finding.file.startsWith('src/') && finding.line > 0 && finding.property && finding.token && finding.disposition === 'baseline-production-fact')).toBe(true);
  });
});
