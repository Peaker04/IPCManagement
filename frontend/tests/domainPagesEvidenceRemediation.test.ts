import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const readSource = (relativeUrl: string) => readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), 'utf8');

const columnWidths = (css: string, tableClass: string) => {
  const widths = new Map<number, number>();
  const blockPattern = new RegExp(`([^{}]*\\.${tableClass}[^{}]*)\\{[^{}]*width:\\s*([0-9.]+)%`, 'g');

  for (const match of css.matchAll(blockPattern)) {
    const width = Number(match[2]);
    for (const column of match[1].matchAll(/nth-child\((\d+)\)/g)) {
      widths.set(Number(column[1]), width);
    }
  }

  return widths;
};

describe('evidence-backed table presentation contracts', () => {
  const css = readSource('../src/styles/components/domain-pages.css');

  it('allocates exactly 100% across all ten report price columns', () => {
    const widths = columnWidths(css, 'ipc-report-table');

    expect([...widths.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...widths.values()].reduce((sum, width) => sum + width, 0)).toBe(100);
  });

  it('allocates exactly 100% across all seven audit columns', () => {
    const widths = columnWidths(css, 'ipc-admin-audit-table');

    expect([...widths.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...widths.values()].reduce((sum, width) => sum + width, 0)).toBe(100);
    expect(css).toContain('.ipc-admin-audit-value');
  });

  it('uses the canonical quantity formatter for Admin current stock', () => {
    const source = readSource('../src/app/pages/admin-data/AdminStatisticsPanel.tsx');

    expect(source).toContain("formatQuantityWithUnit(row.currentQty, row.unit, { maximumFractionDigits: 3 })");
    expect(source).not.toContain('{row.currentQty} {row.unit}');
  });
});
