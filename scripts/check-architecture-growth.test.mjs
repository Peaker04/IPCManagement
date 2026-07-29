import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scanner = path.resolve('scripts/check-architecture-growth.mjs');
const thresholds = {
  controllerLines: 250,
  controllerActions: 12,
  controllerPlanLines: 400,
  controllerPlanActions: 20,
  serviceLines: 600,
  servicePlanLines: 1000,
  frontendLines: 600,
  testLines: 1500,
};

const createRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-architecture-growth-'));
const sourceLines = (count) => Array.from({ length: count }, (_, index) => `// line ${index + 1}`).join('\n');

const writeFile = (root, relativePath, content) => {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const writeBaseline = (root, findings) => {
  writeFile(root, 'scripts/architecture-growth-baseline.json', `${JSON.stringify({ version: 1, thresholds, findings }, null, 2)}\n`);
};

const runGate = (root, ...args) => spawnSync(
  process.execPath,
  [scanner, '--strict', '--root', root, ...args],
  { encoding: 'utf8' },
);

const frontendFinding = (relativePath, lines) => ({
  id: `frontend:${relativePath}`,
  kind: 'frontend',
  name: relativePath,
  files: [relativePath],
  lines,
  level: 'WARNING',
});

test('strict gate accepts an exact production baseline', (context) => {
  const root = createRoot();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = 'frontend/src/features/example/ExamplePage.tsx';
  writeFile(root, file, sourceLines(601));
  writeBaseline(root, [frontendFinding(file, 601)]);

  const result = runGate(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Strict architecture growth gate passed/);
});

test('strict gate rejects test debt above 1500 lines', (context) => {
  const root = createRoot();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFile(root, 'backend/tests/HugeTests.cs', sourceLines(1501));
  writeBaseline(root, []);

  const result = runGate(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /TEST_DEBT backend\/tests\/HugeTests\.cs/);
});

test('strict gate rejects new production debt', (context) => {
  const root = createRoot();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = 'frontend/src/features/new/NewPage.tsx';
  writeFile(root, file, sourceLines(601));
  writeBaseline(root, []);

  const result = runGate(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /NEW_DEBT frontend:frontend\/src\/features\/new\/NewPage\.tsx/);
});

test('strict gate rejects worsened production debt', (context) => {
  const root = createRoot();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = 'frontend/src/features/example/ExamplePage.tsx';
  writeFile(root, file, sourceLines(602));
  writeBaseline(root, [frontendFinding(file, 601)]);

  const result = runGate(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /WORSENED_DEBT frontend:frontend\/src\/features\/example\/ExamplePage\.tsx/);
});

test('strict gate requires the baseline to shrink after improvement or resolution', async (context) => {
  const improvedRoot = createRoot();
  const resolvedRoot = createRoot();
  context.after(() => fs.rmSync(improvedRoot, { recursive: true, force: true }));
  context.after(() => fs.rmSync(resolvedRoot, { recursive: true, force: true }));
  const file = 'frontend/src/features/example/ExamplePage.tsx';

  writeFile(improvedRoot, file, sourceLines(601));
  writeBaseline(improvedRoot, [frontendFinding(file, 602)]);
  const improved = runGate(improvedRoot);

  writeBaseline(resolvedRoot, [frontendFinding(file, 601)]);
  const resolved = runGate(resolvedRoot);

  assert.equal(improved.status, 1);
  assert.match(improved.stderr, /BASELINE_SHRINK_REQUIRED/);
  assert.equal(resolved.status, 1);
  assert.match(resolved.stderr, /finding resolved but baseline entry remains/);
});

test('base-ref comparison rejects baseline expansion', (context) => {
  const root = createRoot();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = 'frontend/src/features/example/ExamplePage.tsx';
  writeFile(root, file, sourceLines(601));
  writeBaseline(root, [frontendFinding(file, 601)]);

  for (const args of [
    ['init', '-b', 'main'],
    ['config', 'user.email', 'architecture-growth@example.invalid'],
    ['config', 'user.name', 'Architecture Growth Test'],
    ['add', '.'],
    ['commit', '-m', 'baseline'],
  ]) {
    const git = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
  }

  writeFile(root, file, sourceLines(602));
  writeBaseline(root, [frontendFinding(file, 602)]);
  const result = runGate(root, '--base-ref', 'HEAD');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /BASELINE_EXPANSION_METRIC/);
});
