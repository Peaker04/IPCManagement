import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRunConfiguration,
  buildRunOutcome,
  buildSourceIdentity,
  classifyPerformanceThresholds,
  performanceBudgetForRoute,
} from './live-visual-audit-contract.mjs';

test('query-string routes receive their pathname CLS budgets', () => {
  assert.deepEqual(performanceBudgetForRoute('/warehouse?view=exceptions'), { pathname: '/warehouse', cls: 0.1, longTask: 50 });
  assert.deepEqual(performanceBudgetForRoute('/approvals?view=queue'), { pathname: '/approvals', cls: 0.1, longTask: 50 });
  const failures = classifyPerformanceThresholds([
    { viewport: '1366x768', route: '/warehouse?view=exceptions', cls: 0.16, longTasks: [] },
    { viewport: '1366x768', route: '/approvals?view=queue', cls: 0.11, longTasks: [] },
  ]);
  assert.equal(failures.length, 2);
  assert.deepEqual(failures.map(({ pathname }) => pathname), ['/warehouse', '/approvals']);
});

test('content identity changes when tracked or untracked bytes change', () => {
  const base = { status: ' M tracked.txt\n?? new.txt\n', headCommit: 'abc', trackedDiff: 'old', untrackedFiles: [{ path: 'new.txt', content: 'one' }] };
  const first = buildSourceIdentity(base);
  const trackedChanged = buildSourceIdentity({ ...base, trackedDiff: 'new' });
  const untrackedChanged = buildSourceIdentity({ ...base, untrackedFiles: [{ path: 'new.txt', content: 'two' }] });
  assert.notEqual(first.trackedDiffSha256, trackedChanged.trackedDiffSha256);
  assert.notEqual(first.untrackedFilesSha256, untrackedChanged.untrackedFilesSha256);
  assert.equal(first.worktreeStatusFingerprint, trackedChanged.worktreeStatusFingerprint);
});

test('manifest configuration and capture/assertion outcomes are exact', () => {
  assert.deepEqual(buildRunConfiguration({
    assertPerformance: true,
    attributionEnabled: true,
    geometryEnabled: false,
    auditProfile: 'standard',
    routes: [{ name: 'warehouse-exceptions', path: '/warehouse?view=exceptions' }],
    viewports: [{ name: '1366x768', width: 1366, height: 768 }],
  }), {
    assertPerformance: true,
    attributionEnabled: true,
    geometryEnabled: false,
    auditProfile: 'standard',
    selectedRoutes: [{ name: 'warehouse-exceptions', path: '/warehouse?view=exceptions', pathname: '/warehouse' }],
    selectedViewports: [{ name: '1366x768', width: 1366, height: 768 }],
  });
  assert.deepEqual(buildRunOutcome({ assertPerformance: false, performanceThresholdFailures: [{}] }), {
    captureStatus: 'completed', performanceAssertion: { enabled: false, verdict: 'not-requested' }, status: 'passed',
  });
  assert.deepEqual(buildRunOutcome({ assertPerformance: true, performanceThresholdFailures: [] }), {
    captureStatus: 'completed', performanceAssertion: { enabled: true, verdict: 'passed' }, status: 'passed',
  });
  assert.deepEqual(buildRunOutcome({ assertPerformance: true, performanceThresholdFailures: [{}] }), {
    captureStatus: 'completed', performanceAssertion: { enabled: true, verdict: 'failed' }, status: 'failed',
  });
});

test('untracked aggregate is stable under locale-sensitive path shapes and discovery order', () => {
  const input = { status: '', headCommit: 'abc', trackedDiff: '', untrackedFiles: [
    { path: 'é.txt', content: '4' }, { path: 'Z.txt', content: '3' }, { path: 'a.txt', content: '2' }, { path: '_x.txt', content: '1' },
  ] };
  assert.equal(
    buildSourceIdentity(input).untrackedFilesSha256,
    buildSourceIdentity({ ...input, untrackedFiles: [...input.untrackedFiles].reverse() }).untrackedFilesSha256,
  );
  assert.deepEqual(buildSourceIdentity(input).untrackedFiles.map(({ path }) => path), ['Z.txt', '_x.txt', 'a.txt', 'é.txt']);
});
