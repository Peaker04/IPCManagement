import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type TableContract = {
  id: string;
  file: string;
  grain: string;
  rowKey: string;
  owner: string;
  pagination: string;
  primaryStatus: string;
};

const contractPath = resolve(process.cwd(), '..', 'docs', 'table-contracts.json');

describe('table contracts', () => {
  it('keeps every declared production table contract structurally complete and source-backed', () => {
    expect(existsSync(contractPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(contractPath, 'utf8')) as { version: number; contracts: TableContract[] };
    expect(parsed.version).toBe(1);
    expect(parsed.contracts.length).toBeGreaterThanOrEqual(30);
    const ids = parsed.contracts.map((contract) => contract.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const contract of parsed.contracts) {
      expect(contract.id).toMatch(/^[a-z0-9-]+$/);
      expect(contract.grain).not.toBe('');
      expect(contract.rowKey).not.toBe('');
      expect(contract.owner).not.toBe('');
      expect(contract.pagination).not.toBe('');
      expect(contract.primaryStatus).not.toBe('');
      expect(existsSync(resolve(process.cwd(), '..', contract.file))).toBe(true);
    }
  });

  it('does not stabilize pagination with synthetic blank capacity or utility-literal CSS ownership', () => {
    const tableViewport = readFileSync(resolve(process.cwd(), 'src/components/common/TableViewport.tsx'), 'utf8');
    const paginatedFrame = readFileSync(resolve(process.cwd(), 'src/components/common/PaginatedTableFrame.tsx'), 'utf8');
    const tableCss = readFileSync(resolve(process.cwd(), 'src/styles/components/tables.css'), 'utf8');
    const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/redesign/responsive.css'), 'utf8');

    expect(tableViewport).not.toContain('rowCapacity');
    expect(paginatedFrame).not.toContain('rowCapacity');
    expect(tableCss).not.toContain('data-row-capacity');
    expect(responsiveCss).not.toMatch(/\[class~=["'][^"']*(?:max-h|h-)\[/);
  });

  it('keeps the frozen identifier cell inside row hover and selected-state presentation', () => {
    const tableCss = readFileSync(resolve(process.cwd(), 'src/styles/components/tables.css'), 'utf8');
    expect(tableCss).toContain('tbody tr:hover > td:first-child');
    expect(tableCss).toContain('tr[aria-current="true"] > td');
    expect(tableCss).toContain('background: var(--ipc-color-surface-selected)');
  });

  it('does not introduce direct production tables outside the canonical viewport primitives', () => {
    const sourceRoot = resolve(process.cwd(), 'src');
    const directTables: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) { visit(path); continue; }
        if (!entry.name.endsWith('.tsx') || path.replaceAll('\\', '/').endsWith('components/ui/table.tsx')) continue;
        const source = readFileSync(path, 'utf8');
        if (/<table\b/.test(source) && !/TableViewport|DataTableShell|PaginatedTableFrame|CursorPaginationBar/.test(source)) {
          directTables.push(path.replace(`${resolve(process.cwd(), '..')}\\`, ''));
        }
      }
    };
    visit(sourceRoot);
    expect(directTables).toEqual([]);
  });
});
