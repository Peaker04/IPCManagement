import { existsSync, readFileSync } from 'node:fs';
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
});
