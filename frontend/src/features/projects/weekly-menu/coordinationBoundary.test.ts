import { describe, expect, it } from 'vitest';

const weeklyMenuSources = import.meta.glob([
  '../**/*.ts',
  '../**/*.tsx',
], {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const coordinationFeatureImports = () => Object.entries(weeklyMenuSources)
  .flatMap(([file, source]) => [...source.matchAll(/from\s+['"]([^'"]*features\/coordination|\.\.\/\.\.\/coordination|\.\.\/\.\.\/\.\.\/coordination)([^'"]*)['"]/g)]
    .map((match) => ({ file, specifier: `${match[1]}${match[2]}` })))
  .sort((left, right) => left.file.localeCompare(right.file));

describe('projects to coordination ownership boundary', () => {
  it('contains no import from coordination feature internals', () => {
    const imports = coordinationFeatureImports();

    expect(imports).toEqual([]);
  });

  it('uses only lower API, type and action contracts', () => {
    const source = Object.values(weeklyMenuSources).join('\n');

    expect(source).toContain("from '@/api/coordinationApi'");
    expect(source).toContain("from '@/types/coordination'");
    expect(source).toContain("from '@/lib/coordinationActions'");
  });
});
