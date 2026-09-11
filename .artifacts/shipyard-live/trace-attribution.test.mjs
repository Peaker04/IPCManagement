import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTrace } from './trace-attribution.mjs';

const event = (name, ts, dur, data = {}) => ({ ph: 'X', pid: 1, tid: 1, name, ts, dur, args: { data } });
const route = { path: '/warehouse' };
const viewport = { name: '1920x1080' };

test('preserves the direct owner and records the deepest nested script stack', () => {
  const trace = summarizeTrace([
    event('RunTask', 0, 100_000),
    event('FireAnimationFrame', 1_000, 90_000),
    event('FunctionCall', 2_000, 70_000, { stackTrace: [{ functionName: 'render', url: 'app.tsx' }] }),
    event('ProfileCall', 3_000, 20_000, { stackTrace: [
      { functionName: 'leaf', url: 'leaf.ts' },
      { functionName: 'middle', url: 'middle.ts' },
      { functionName: 'root', url: 'root.ts' },
    ] }),
  ], route, viewport);

  const [task] = trace.longTasks;
  assert.equal(task.owner.name, 'FireAnimationFrame');
  assert.equal(task.scriptOwner.name, 'ProfileCall');
  assert.equal(task.scriptOwner.traceDepth, 3);
  assert.deepEqual(task.scriptOwner.stack.map((frame) => frame.url), ['leaf.ts', 'middle.ts', 'root.ts']);
});

test('handles absent trace stacks without changing the captured task shape', () => {
  const trace = summarizeTrace([event('RunTask', 0, 60_000), event('Layout', 1_000, 30_000)], route, viewport);
  assert.equal(trace.longTasks[0].owner.name, 'Layout');
  assert.equal(trace.longTasks[0].scriptOwner, null);
});
