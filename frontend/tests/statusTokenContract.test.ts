import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Status Token Contract Test (Rule 0.3.7, 3.6)', () => {
  it('ensures no status label exceeds the generated --cell-status-min-w token', () => {
    const root = process.cwd();
    const workflowPath = resolve(root, 'src/lib/workflowConfig.ts');
    const cssPath = resolve(root, 'src/styles/index.css');

    const workflowContent = readFileSync(workflowPath, 'utf8');
    const cssContent = readFileSync(cssPath, 'utf8');

    // Extract all status labels
    const matches = [...workflowContent.matchAll(/\{\s*label:\s*['"]([^'"]+)['"],\s*tone:/g)].map(
      (m) => m[1]
    );

    expect(matches.length).toBeGreaterThan(0);

    // Extract token value from CSS
    const tokenMatch = cssContent.match(/--cell-status-min-w:\s*([0-9.]+)\s*rem/i);
    expect(tokenMatch).not.toBeNull();
    const tokenRem = parseFloat(tokenMatch![1]);
    expect(tokenRem).toBeGreaterThanOrEqual(7.75);

    const uniqueLabels = new Set(matches);
    expect(uniqueLabels.size, `Status label inventory drifted; review token sizing for all ${uniqueLabels.size} labels`).toBe(18);

    for (const label of matches) {
      // Each character in standard Vietnamese UI takes <= 0.45rem + 1.8rem fixed padding & dot
      const estimatedRem = label.length * 0.45 + 1.8;
      expect(
        estimatedRem,
        `Label "${label}" (len ${label.length}, est ${estimatedRem.toFixed(2)}rem) exceeds token ${tokenRem}rem`
      ).toBeLessThanOrEqual(tokenRem);
      // Ensure under 15 characters (Rule S1.2, S1.7)
      expect(label.length).toBeLessThanOrEqual(15);
    }
  });
});
