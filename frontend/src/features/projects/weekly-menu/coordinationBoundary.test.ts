import { describe, expect, it } from 'vitest';

const weeklyMenuSources = import.meta.glob([
  './**/*.ts',
  './**/*.tsx',
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
  it('captures the exact legacy feature imports that Phase 17 must retire', () => {
    const imports = coordinationFeatureImports();

    expect(imports).not.toHaveLength(0);
    expect(new Set(imports.map(({ specifier }) => specifier))).toEqual(new Set([
      '../../../coordination/coordinationApi',
      '../../../coordination/coordinationSlice',
      '../../../coordination/types',
    ]));
  });
});
