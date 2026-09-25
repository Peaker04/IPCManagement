import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const ledger = JSON.parse(fs.readFileSync(path.join(root, '.artifacts/ui-ux-process-inventory/phase35-denominators/phase35-geometry-denominator-v2.json'), 'utf8')) as {
  count: number;
  rows: Array<{ key: string; path: string; line: number; axis: string; value: string; disposition: string }>;
};
const allowed = new Set(['PURPOSEFUL_CONSTRAINT', 'ARTIFICIAL_RESERVATION', 'RESPONSIVE_WORKAROUND', 'SHARED_OWNER_DEFECT', 'NOT_APPLICABLE', 'NEEDS_BROWSER']);

describe('Phase 35 geometry denominator', () => {
  it('has one classified stable-key row for every current production arbitrary minimum', () => {
    const current: string[] = [];
    const visit = (directory: string) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return visit(target);
      if (!/\.tsx?$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) return;
      const relative = path.relative(root, target).replaceAll('\\', '/');
      fs.readFileSync(target, 'utf8').split(/\r?\n/).forEach((line, index) => {
        for (const match of line.matchAll(/min-([hw])-\[([^\]]+)\]/g)) current.push(`${relative}:${index + 1}:${match[0]}`);
      });
    });
    visit(path.join(root, 'frontend/src'));

    expect(ledger.rows).toHaveLength(ledger.count);
    expect(new Set(ledger.rows.map((row) => row.key)).size).toBe(ledger.count);
    expect(ledger.rows.every((row) => allowed.has(row.disposition))).toBe(true);
    expect(ledger.rows.map((row) => `${row.path}:${row.line}:${row.axis === 'min-height' ? 'min-h' : 'min-w'}-[${row.value}]`).sort()).toEqual(current.sort());
  });
});
