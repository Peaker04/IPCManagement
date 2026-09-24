import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function normalizeRoutePathname(route) {
  return new URL(route, 'http://ipc.local').pathname;
}

export function performanceBudgetForRoute(route) {
  const pathname = normalizeRoutePathname(route);
  return {
    pathname,
    cls: pathname === '/warehouse' || pathname === '/approvals' ? 0.1 : null,
    longTask: 50,
  };
}

export function classifyPerformanceThresholds(samples) {
  return samples.flatMap((sample) => {
    const budget = performanceBudgetForRoute(sample.route);
    const failures = [];
    if (budget.cls != null && sample.cls > budget.cls) {
      failures.push({ viewport: sample.viewport, route: sample.route, pathname: budget.pathname, metric: 'cls', actual: sample.cls, budget: budget.cls });
    }
    for (const task of sample.longTasks.filter((entry) => entry.duration > budget.longTask)) {
      failures.push({ viewport: sample.viewport, route: sample.route, pathname: budget.pathname, metric: 'longtask', actual: task.duration, budget: budget.longTask, startTime: task.startTime, action: task.action });
    }
    return failures;
  });
}

export function buildRunConfiguration({ assertPerformance, attributionEnabled, geometryEnabled, auditProfile, routes, viewports }) {
  return {
    assertPerformance,
    attributionEnabled,
    geometryEnabled,
    auditProfile,
    selectedRoutes: routes.map(({ name, path }) => ({ name, path, pathname: normalizeRoutePathname(path) })),
    selectedViewports: viewports.map(({ name, width, height }) => ({ name, width, height })),
  };
}

export function buildRunOutcome({ assertPerformance, performanceThresholdFailures }) {
  const assertionFailed = assertPerformance && performanceThresholdFailures.length > 0;
  return {
    captureStatus: 'completed',
    performanceAssertion: {
      enabled: assertPerformance,
      verdict: !assertPerformance ? 'not-requested' : assertionFailed ? 'failed' : 'passed',
    },
    status: assertionFailed ? 'failed' : 'passed',
  };
}

export function buildSourceIdentity({ status, headCommit, trackedDiff, untrackedFiles, publishedCommit }) {
  const sortedUntrackedFiles = [...untrackedFiles]
    .map(({ path, content }) => ({ path, sha256: sha256(content) }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return {
    worktreeStatusFingerprint: sha256(status),
    headCommit,
    trackedDiffSha256: sha256(trackedDiff),
    untrackedFiles: sortedUntrackedFiles,
    untrackedFilesSha256: sha256(sortedUntrackedFiles.map(({ path, sha256: hash }) => `${path}\0${hash}`).join('\n')),
    ...(publishedCommit ? { publishedCommit } : {}),
  };
}
