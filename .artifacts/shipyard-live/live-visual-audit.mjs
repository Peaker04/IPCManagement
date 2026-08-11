import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../../node_modules/@playwright/test/index.mjs';

const baseUrl = process.env.IPC_VISUAL_BASE_URL ?? 'http://127.0.0.1:3001';
const apiUrl = process.env.IPC_VISUAL_API_URL ?? 'http://127.0.0.1:8001';
const database = process.env.IPC_VISUAL_DATABASE ?? 'ipc_lane1';
const auditProfile = process.env.IPC_VISUAL_AUDIT_PROFILE ?? 'standard';
const assertPerformance = process.env.IPC_VISUAL_ASSERT_PERFORMANCE === 'true';
const attributionEnabled = process.env.IPC_VISUAL_ATTRIBUTION === 'true';
const dashboardUiRulesProfile = auditProfile === 'dashboard-ui-rules';
if (database === 'ipc_lane1') throw new Error('Protected ipc_lane1 is prohibited for this visual audit.');
const password = process.env.K6_PASSWORD;
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.');

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirtySourceFingerprint = createHash('sha256')
  .update(execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }))
  .digest('hex');
const root = path.resolve(
  '.artifacts/shipyard-live',
  process.env.IPC_VISUAL_AUDIT_RUN ?? 'phase25-p8-pf-20260802',
);
const screenshotsRoot = path.join(root, 'screenshots');
const apiRoot = path.join(root, 'api');
const browserRoot = path.join(root, 'browser');
const performanceRoot = path.join(root, 'performance');
const profile = path.resolve('.artifacts/browser-use-visual-audit');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const requestedViewports = new Set((process.env.IPC_VISUAL_VIEWPORTS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const allViewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1365x900', width: 1365, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
];
const viewports = requestedViewports.size > 0
  ? allViewports.filter((viewport) => requestedViewports.has(viewport.name))
  : allViewports;
const requestedRoutes = new Set((process.env.IPC_VISUAL_ROUTES ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const allRoutes = dashboardUiRulesProfile ? [
  { name: 'service-run-report', path: '/reports' },
  { name: 'admin-audit', path: '/admin-data' },
] : [
  { name: 'dashboard', path: '/' },
  { name: 'weekly-menu', path: '/weekly-menu' },
  { name: 'meal-orders', path: '/meal-orders' },
  { name: 'chef-dashboard', path: '/chef-dashboard' },
  { name: 'approvals', path: '/approvals' },
  { name: 'purchasing', path: '/purchasing' },
  { name: 'warehouse', path: '/warehouse' },
  { name: 'reports', path: '/reports' },
  { name: 'admin-data', path: '/admin-data' },
];
const routes = requestedRoutes.size > 0
  ? allRoutes.filter((route) => requestedRoutes.has(route.name))
  : allRoutes;
if (viewports.length === 0 || routes.length === 0) throw new Error('IPC_VISUAL_VIEWPORTS or IPC_VISUAL_ROUTES selected no audit samples.');

await Promise.all([
  fs.mkdir(screenshotsRoot, { recursive: true }),
  fs.mkdir(apiRoot, { recursive: true }),
  fs.mkdir(browserRoot, { recursive: true }),
  fs.mkdir(performanceRoot, { recursive: true }),
]);
const evidence = {
  startedAt: new Date().toISOString(),
  sourceCommit,
  dirtySourceFingerprint,
  baseUrl,
  apiUrl,
  database,
  credentialSource: 'K6_PASSWORD',
  browser: 'Google Chrome',
  headed: true,
  viewports,
  routes: [],
  apiResponses: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  escapedMutations: [],
  fontResponses: [],
  reflowChecks: [],
  preferenceFlows: [],
  attributionTraces: [],
};

const context = await chromium.launchPersistentContext(profile, {
  executablePath: chrome,
  headless: false,
  viewport: { width: viewports[0].width, height: viewports[0].height },
  args: [`--window-size=${viewports[0].width},${viewports[0].height}`, '--force-device-scale-factor=1'],
});
const page = context.pages()[0] ?? await context.newPage();
let activeProbe = 'startup';
let actionStartedAt = 0;

page.on('console', (message) => {
  if (message.type() === 'error') evidence.consoleErrors.push({ probe: activeProbe, text: message.text() });
});
page.on('pageerror', (error) => evidence.pageErrors.push({ probe: activeProbe, message: error.message }));
page.on('requestfailed', (request) => {
  if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
    evidence.requestFailures.push({ probe: activeProbe, method: request.method(), url: request.url(), failure: request.failure()?.errorText ?? 'unknown' });
  }
});
page.on('response', (response) => {
  if (/\.woff2(?:\?|$)|fonts\.(?:googleapis|gstatic)\.com/.test(response.url())) {
    evidence.fontResponses.push({ status: response.status(), url: response.url() });
  }
  if (response.url().includes('/api/')) {
    evidence.apiResponses.push({
      probe: activeProbe,
      afterAction: Date.now() >= actionStartedAt,
      method: response.request().method(),
      status: response.status(),
      url: new URL(response.url()).pathname,
    });
  }
});

await context.route('**/api/**', async (route) => {
  const request = route.request();
  const method = request.method().toUpperCase();
  const pathname = new URL(request.url()).pathname;
  const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const isLogin = method === 'POST' && pathname === '/api/auth/login';
  if (!isRead && !isLogin) {
    evidence.escapedMutations.push({ probe: activeProbe, method, pathname });
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
});

await page.addInitScript((diagnosticEnabled) => {
  const selectorFor = (node) => {
    if (!(node instanceof Element)) return null;
    const id = node.id ? `#${node.id}` : '';
    const className = [...node.classList].slice(0, 3).join('.');
    return `${node.tagName.toLowerCase()}${id}${className ? `.${className}` : ''}`;
  };
  const describeNode = (node) => {
    if (!(node instanceof Element)) return { selector: null, ariaLabel: null, heading: null };
    const labelledBy = node.getAttribute('aria-labelledby');
    const labelledByText = labelledBy
      ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
      : null;
    return {
      selector: selectorFor(node),
      ariaLabel: node.getAttribute('aria-label') ?? labelledByText,
      heading: node.querySelector('h1, h2, h3, [role="heading"]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
    };
  };
  window.__ipcPhase25Perf = {
    longTasks: [],
    shifts: [],
    actions: [{ name: 'document-navigation', startTime: performance.now() }],
    geometry: diagnosticEnabled && location.pathname === '/warehouse'
      ? { enabled: true, startedAt: performance.now(), frames: [], resizeEvents: [] }
      : null,
  };
  try {
    new PerformanceObserver((list) => window.__ipcPhase25Perf.longTasks.push(
      ...list.getEntries().map((entry) => ({ startTime: entry.startTime, duration: entry.duration })),
    )).observe({ entryTypes: ['longtask'] });
    new PerformanceObserver((list) => window.__ipcPhase25Perf.shifts.push(
      ...list.getEntries().filter((entry) => !entry.hadRecentInput).map((entry) => ({
        value: entry.value,
        startTime: entry.startTime,
        sources: entry.sources.map((source) => ({
          ...describeNode(source.node),
          previousRect: source.previousRect,
          currentRect: source.currentRect,
        })),
      })),
    )).observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Unsupported performance entry types remain an explicit empty sample.
  }

  if (window.__ipcPhase25Perf.geometry) {
    const geometry = window.__ipcPhase25Perf.geometry;
    const frameLimit = 96;
    const sectionWithTitle = (title) => [...document.querySelectorAll('section.ipc-section-panel')]
      .find((section) => section.querySelector('.ipc-section-title')?.textContent?.replace(/\s+/g, ' ').trim() === title) ?? null;
    const targets = [
      { name: 'ContextStrip', get: () => document.querySelector('.ipc-context-strip') },
      { name: 'purchase-order-panel', get: () => sectionWithTitle('Đơn mua chờ nhập kho') },
      { name: 'receipt-lifecycle-panel', get: () => document.getElementById('receipt-lifecycle-title')?.closest('section') ?? null },
      { name: 'ViewSwitcher', get: () => document.querySelector('[role="tablist"][aria-label="Chọn góc nhìn kho"]') },
    ];
    const observed = new WeakSet();
    const snapshot = (node) => {
      if (!(node instanceof Element)) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const capture = (reason, changedTarget = null) => {
      if (geometry.frames.length >= frameLimit) return;
      geometry.frames.push({
        reason,
        changedTarget,
        time: performance.now(),
        targets: targets.map((target) => ({ name: target.name, rect: snapshot(target.get()) })),
      });
    };
    const observeTargets = () => {
      for (const target of targets) {
        const node = target.get();
        if (!(node instanceof Element) || observed.has(node)) continue;
        observed.add(node);
        new ResizeObserver((entries) => {
          geometry.resizeEvents.push({ target: target.name, time: performance.now(), count: entries.length });
          scheduleFrame(`resize-observer:${target.name}`);
        }).observe(node);
      }
    };
    let rAFPending = false;
    const scheduleFrame = (reason) => {
      if (rAFPending) return;
      rAFPending = true;
      requestAnimationFrame(() => {
        rAFPending = false;
        observeTargets();
        capture(reason);
      });
    };
    new MutationObserver(() => scheduleFrame('mutation-frame')).observe(document, { childList: true, subtree: true });
    scheduleFrame('initial-request-animation-frame');
  }
}, attributionEnabled);

const settle = async () => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(500);
};

const resetPerformance = async () => page.evaluate(() => {
  performance.clearResourceTimings();
  window.__ipcPhase25Perf.longTasks.length = 0;
  window.__ipcPhase25Perf.shifts.length = 0;
});

const recordAction = async (name, action) => {
  const actionIndex = await page.evaluate((actionName) => {
    window.__ipcPhase25Perf.actions.push({ name: actionName, startTime: performance.now() });
    return window.__ipcPhase25Perf.actions.length - 1;
  }, name);
  try {
    return await action();
  } finally {
    await page.evaluate((index) => {
      window.__ipcPhase25Perf.actions[index].endTime = performance.now();
    }, actionIndex);
  }
};

const traceEventOwner = (event) => {
  const data = event.args?.data ?? event.args?.beginData ?? {};
  const stackFrame = Array.isArray(data.stackTrace) ? data.stackTrace[0] : null;
  return {
    name: event.name,
    duration: Number((event.dur / 1_000).toFixed(3)),
    functionName: data.functionName ?? data.function ?? stackFrame?.functionName ?? null,
    url: data.url ?? data.scriptName ?? stackFrame?.url ?? null,
  };
};

const summarizeTrace = (traceEvents, route, viewport) => {
  const completeEvents = traceEvents.filter((event) => event.ph === 'X' && typeof event.ts === 'number' && typeof event.dur === 'number');
  const longTasks = completeEvents
    .filter((event) => event.name === 'RunTask' && event.dur > 50_000)
    .map((task) => {
      const taskEnd = task.ts + task.dur;
      const nested = completeEvents
        .filter((event) => event.pid === task.pid && event.tid === task.tid && event.name !== 'RunTask'
          && event.ts >= task.ts && event.ts + event.dur <= taskEnd)
        .sort((left, right) => right.dur - left.dur);
      return { ...traceEventOwner(task), owner: nested[0] ? traceEventOwner(nested[0]) : null };
    });
  return {
    route: route.path,
    viewport: viewport.name,
    status: 'captured',
    eventCount: traceEvents.length,
    longTasks,
  };
};

const captureNavigationTrace = async ({ route, viewport, navigate }) => {
  const needsTrace = attributionEnabled && (route.path === '/warehouse' || route.path === '/admin-data');
  if (!needsTrace) {
    await navigate();
    return null;
  }

  let cdp;
  try {
    cdp = await context.newCDPSession(page);
    const completed = new Promise((resolve) => cdp.on('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.start', {
      categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,disabled-by-default-v8.cpu_profiler',
      options: 'record-as-much-as-possible',
      transferMode: 'ReturnAsStream',
    });
    try {
      await navigate();
    } finally {
      await cdp.send('Tracing.end');
    }
    const completedTrace = await Promise.race([
      completed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('CDP trace did not complete within 30 seconds.')), 30_000)),
    ]);
    const chunks = [];
    let eof = false;
    while (!eof) {
      const chunk = await cdp.send('IO.read', { handle: completedTrace.stream });
      chunks.push(chunk.data);
      eof = chunk.eof;
    }
    await cdp.send('IO.close', { handle: completedTrace.stream });
    const trace = JSON.parse(chunks.join(''));
    return summarizeTrace(trace.traceEvents ?? [], route, viewport);
  } catch (error) {
    return { route: route.path, viewport: viewport.name, status: 'unavailable', error: String(error?.message ?? error) };
  } finally {
    if (cdp) await cdp.detach().catch(() => {});
  }
};

const runTablePreferenceFlow = async ({ viewport, owner, tableName, hiddenColumn, reorderedColumn, preservedLabels, activate }) => {
  await activate();
  await settle();
  const region = page.getByRole('region', { name: tableName, exact: true });
  await region.waitFor({ state: 'visible', timeout: 15_000 });
  await region.getByRole('button', { name: 'Khôi phục mặc định', exact: true }).click();
  await settle();
  const firstRow = region.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 15_000 });
  const defaultRow = await firstRow.innerText();
  const identifyingCell = (await firstRow.locator('td').first().innerText()).trim();
  const defaultHeaders = await region.locator('table thead th').allTextContents();
  const defaultColumnIndex = defaultHeaders.indexOf(reorderedColumn);
  if (!identifyingCell || defaultColumnIndex < 0 || !preservedLabels.every((label) => defaultRow.includes(label))) throw new Error(`${owner} did not render representative row content.`);

  activeProbe = `${viewport.name}:${owner}:change`;
  actionStartedAt = Date.now();
  const hiddenColumnToggle = region.getByRole('checkbox', { name: hiddenColumn, exact: true });
  await hiddenColumnToggle.click();
  for (let attempt = 0; attempt < 20 && await hiddenColumnToggle.isChecked(); attempt += 1) {
    await page.waitForTimeout(50);
  }
  if (await hiddenColumnToggle.isChecked()) throw new Error(`${owner} did not apply hidden column state before reorder.`);
  const reorderedColumnIndexBeforeMove = (await region.locator('table thead th').allTextContents()).indexOf(reorderedColumn);
  if (reorderedColumnIndexBeforeMove < 0) throw new Error(`${owner} hid the reordered column.`);
  await region.getByRole('button', { name: `Đưa ${reorderedColumn} xuống`, exact: true }).click();
  await settle();
  const reorderedHeaders = await region.locator('table thead th').allTextContents();
  if (reorderedHeaders.indexOf(reorderedColumn) <= reorderedColumnIndexBeforeMove) throw new Error(`${owner} did not apply changed column order before density.`);
  await region.getByRole('button', { name: 'Gọn (40px)', exact: true }).click();
  await settle();
  await page.screenshot({ path: path.join(screenshotsRoot, `${viewport.name}-${owner}-persisted.png`), fullPage: true });
  const persistedRow = await firstRow.innerText();
  const persistedHeaders = await region.locator('table thead th').allTextContents();
  if (persistedHeaders.indexOf(reorderedColumn) <= reorderedColumnIndexBeforeMove || !persistedRow.includes(identifyingCell) || !preservedLabels.every((label) => persistedRow.includes(label))) throw new Error(`${owner} did not preserve the changed column order or representative row content.`);

  activeProbe = `${viewport.name}:${owner}:reload`;
  actionStartedAt = Date.now();
  await page.reload();
  await settle();
  await activate();
  await settle();
  const reloadedRegion = page.getByRole('region', { name: tableName, exact: true });
  if (await reloadedRegion.getByRole('checkbox', { name: hiddenColumn, exact: true }).isChecked()) throw new Error(`${owner} did not persist hidden column state.`);
  if (!await reloadedRegion.getByRole('button', { name: 'Gọn (40px)', exact: true }).getAttribute('aria-pressed').then((value) => value === 'true')) throw new Error(`${owner} did not persist density.`);
  if (JSON.stringify(await reloadedRegion.locator('table thead th').allTextContents()) !== JSON.stringify(persistedHeaders)) throw new Error(`${owner} did not persist changed column order.`);
  await reloadedRegion.getByRole('button', { name: 'Khôi phục mặc định', exact: true }).click();
  await settle();
  await page.screenshot({ path: path.join(screenshotsRoot, `${viewport.name}-${owner}-reset.png`), fullPage: true });
  const resetRow = await reloadedRegion.locator('tbody tr').first().innerText();
  if (JSON.stringify(await reloadedRegion.locator('table thead th').allTextContents()) !== JSON.stringify(defaultHeaders) || !resetRow.includes(identifyingCell) || !preservedLabels.every((label) => resetRow.includes(label))) throw new Error(`${owner} did not restore default order or representative row content.`);
  evidence.preferenceFlows.push({ viewport: viewport.name, owner, tableName, hiddenColumn, reorderedColumn, representativeRowPreserved: true, columnOrderPreserved: true });
};

try {
  activeProbe = 'login';
  await page.goto(`${baseUrl}/login`);
  await settle();
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill(password);
    actionStartedAt = Date.now();
    await Promise.all([
      page.waitForURL((url) => url.pathname !== '/login', { timeout: 20_000 }),
      page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
    ]);
    await settle();
  }

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const measuredViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    if (measuredViewport.width !== viewport.width || measuredViewport.height !== viewport.height) {
      throw new Error(`Configured viewport ${viewport.name} measured ${measuredViewport.width}x${measuredViewport.height}.`);
    }
    for (const route of routes) {
      activeProbe = `${viewport.name}:${route.name}`;
      await resetPerformance();
      actionStartedAt = Date.now();
      const attribution = await captureNavigationTrace({
        route,
        viewport,
        navigate: async () => {
          await page.goto(`${baseUrl}${route.path}`);
          await settle();
          await page.evaluate(() => document.fonts.ready);
        },
      });
      if (attribution) evidence.attributionTraces.push(attribution);

      if (route.name === 'admin-data') {
        const statisticsTab = page.getByRole('tab', { name: 'Thống kê', exact: true });
        if (await statisticsTab.isVisible().catch(() => false)) {
          actionStartedAt = Date.now();
          await recordAction('admin-statistics-tab', async () => {
            await statisticsTab.click();
            await settle();
          });
        }
      }

      if (dashboardUiRulesProfile && route.name === 'service-run-report') {
        await runTablePreferenceFlow({
          viewport,
          owner: 'service-run',
          tableName: 'Bảng Ca phục vụ',
          hiddenColumn: 'Bổ sung',
          reorderedColumn: 'Chi phí',
          preservedLabels: ['Chi phí mua ước tính', 'Chi phí mua thực nhận'],
          activate: async () => {
            const auditTab = page.getByRole('tab', { name: 'Nhật ký thay đổi', exact: true });
            if (await auditTab.isVisible().catch(() => false)) await auditTab.click();
          },
        });
      }

      if (dashboardUiRulesProfile && route.name === 'admin-audit') {
        await runTablePreferenceFlow({
          viewport,
          owner: 'admin-audit',
          tableName: 'Bảng nhật ký thay đổi hệ thống',
          hiddenColumn: 'Giá trị cũ',
          reorderedColumn: 'Người thực hiện',
          preservedLabels: [],
          activate: async () => {
            const auditTab = page.getByRole('tab', { name: 'Audit', exact: true });
            if (await auditTab.isVisible().catch(() => false)) await auditTab.click();
          },
        });
      }

      const state = await page.evaluate(() => {
        const observedAt = performance.now();
        const actions = window.__ipcPhase25Perf.actions.map((action) => ({ ...action, endTime: action.endTime ?? observedAt }));
        const actionFor = (startTime) => actions.find((action) => startTime >= action.startTime && startTime <= action.endTime)?.name ?? 'outside-recorded-action';
        return {
          pathname: window.location.pathname,
          textLength: document.body.innerText.trim().length,
          errorOverlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay')),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          domNodes: document.getElementsByTagName('*').length,
          rows: document.querySelectorAll('tbody tr').length,
          cls: window.__ipcPhase25Perf.shifts.reduce((sum, shift) => sum + shift.value, 0),
          shifts: [...window.__ipcPhase25Perf.shifts],
          longTasks: window.__ipcPhase25Perf.longTasks.map((task) => ({ ...task, action: actionFor(task.startTime) })),
          geometry: window.__ipcPhase25Perf.geometry
            ? { ...window.__ipcPhase25Perf.geometry, frames: [...window.__ipcPhase25Perf.geometry.frames], resizeEvents: [...window.__ipcPhase25Perf.geometry.resizeEvents] }
            : null,
          actions,
          fontStatus: document.fonts.status,
          bodyFontFamily: getComputedStyle(document.body).fontFamily,
          pageTitleFontFamily: document.querySelector('.ipc-page-title') ? getComputedStyle(document.querySelector('.ipc-page-title')).fontFamily : null,
          sectionTitleFontFamily: document.querySelector('.ipc-section-title') ? getComputedStyle(document.querySelector('.ipc-section-title')).fontFamily : null,
        };
      });
      evidence.routes.push({ viewport: viewport.name, route: route.path, ...state });
    }

    if (!dashboardUiRulesProfile) {
      const screenshot = `${viewport.name}-admin-statistics-final.png`;
      await page.screenshot({ path: path.join(screenshotsRoot, screenshot), fullPage: true });
    }
    const routeSamples = evidence.routes.filter((sample) => sample.viewport === viewport.name);
    const apiAfterAction = evidence.apiResponses.filter((sample) => sample.probe.startsWith(`${viewport.name}:`) && sample.afterAction);
    if (routeSamples.some((sample) => sample.errorOverlay || sample.horizontalOverflow || sample.textLength === 0)) {
      throw new Error(`Viewport ${viewport.name} has an error overlay, overflow or empty render.`);
    }
    if (apiAfterAction.length === 0) throw new Error(`Viewport ${viewport.name} has no API response after action.`);
  }

  if (!dashboardUiRulesProfile) {
    await page.setViewportSize({ width: 640, height: 450 });
    for (const route of [
    { name: 'purchasing', path: '/purchasing' },
    { name: 'admin-data', path: '/admin-data' },
    ]) {
    activeProbe = `zoom-200:${route.name}`;
    await page.goto(`${baseUrl}${route.path}`);
    await settle();
    await page.evaluate(() => document.fonts.ready);
    const reflow = await page.evaluate(() => ({
      pathname: window.location.pathname,
      textLength: document.body.innerText.trim().length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      fontStatus: document.fonts.status,
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
    }));
    evidence.reflowChecks.push({ route: route.path, equivalentZoom: '200%', ...reflow });
    await page.screenshot({ path: path.join(screenshotsRoot, `zoom-200-${route.name}-final.png`), fullPage: true });
    }
  }

  if (evidence.consoleErrors.length || evidence.pageErrors.length || evidence.requestFailures.length || evidence.escapedMutations.length) {
    throw new Error('Browser errors, request failures or escaped mutations were observed.');
  }
  const nonSuccessApi = evidence.apiResponses.filter((response) => response.status < 200 || response.status >= 400);
  if (nonSuccessApi.length > 0) throw new Error(`Observed ${nonSuccessApi.length} non-success API responses.`);
  if (evidence.fontResponses.length === 0 || evidence.fontResponses.some((response) => response.status < 200 || response.status >= 400)) {
    throw new Error('Local font responses are missing or unsuccessful.');
  }
  if (evidence.fontResponses.some((response) => /fonts\.(?:googleapis|gstatic)\.com/.test(response.url))) {
    throw new Error('Remote Google font request observed.');
  }
  if (evidence.routes.some((sample) => sample.fontStatus !== 'loaded' || !sample.bodyFontFamily.includes('Inter Variable'))) {
    throw new Error('Computed typography did not resolve to loaded Inter Variable.');
  }
  if (evidence.reflowChecks.some((sample) => sample.horizontalOverflow || sample.textLength === 0 || sample.fontStatus !== 'loaded')) {
    throw new Error('200% equivalent reflow check failed.');
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.summary = {
    viewportCount: viewports.length,
    routeProbeCount: evidence.routes.length,
    screenshotCount: dashboardUiRulesProfile ? viewports.length * 4 : viewports.length + evidence.reflowChecks.length,
    fontResponseCount: evidence.fontResponses.length,
    reflowCheckCount: evidence.reflowChecks.length,
    apiResponseCount: evidence.apiResponses.length,
    apiAfterActionCount: evidence.apiResponses.filter((response) => response.afterAction).length,
    consoleErrorCount: evidence.consoleErrors.length,
    pageErrorCount: evidence.pageErrors.length,
    requestFailureCount: evidence.requestFailures.length,
    escapedMutationCount: evidence.escapedMutations.length,
    overflowCount: evidence.routes.filter((sample) => sample.horizontalOverflow).length,
    longTaskCount: evidence.routes.reduce((sum, sample) => sum + sample.longTasks.length, 0),
    attributionTraceCount: evidence.attributionTraces.length,
    maxCls: Math.max(...evidence.routes.map((sample) => sample.cls)),
  };
  evidence.performanceThresholdFailures = evidence.routes.flatMap((sample) => {
    const failures = [];
    if ((sample.route === '/warehouse' || sample.route === '/approvals') && sample.cls > 0.1) {
      failures.push({ viewport: sample.viewport, route: sample.route, metric: 'cls', actual: sample.cls, budget: 0.1 });
    }
    for (const task of sample.longTasks.filter((entry) => entry.duration > 50)) {
      failures.push({ viewport: sample.viewport, route: sample.route, metric: 'longtask', actual: task.duration, budget: 50, startTime: task.startTime, action: task.action });
    }
    return failures;
  });
  evidence.summary.performanceThresholdFailureCount = evidence.performanceThresholdFailures.length;
  await Promise.all([
    fs.writeFile(path.join(apiRoot, 'responses.json'), JSON.stringify(evidence.apiResponses, null, 2)),
    fs.writeFile(path.join(browserRoot, 'errors.json'), JSON.stringify({ consoleErrors: evidence.consoleErrors, pageErrors: evidence.pageErrors, requestFailures: evidence.requestFailures, escapedMutations: evidence.escapedMutations }, null, 2)),
    fs.writeFile(path.join(performanceRoot, 'metrics.json'), JSON.stringify(evidence.routes.map(({ viewport, route, cls, shifts, longTasks, geometry, actions }) => ({ viewport, route, cls, shifts, longTasks, geometry, actions })), null, 2)),
    fs.writeFile(path.join(performanceRoot, 'attribution.json'), JSON.stringify(evidence.attributionTraces, null, 2)),
    fs.writeFile(path.join(performanceRoot, 'threshold-failures.json'), JSON.stringify(evidence.performanceThresholdFailures, null, 2)),
    fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ ...evidence, status: 'passed' }, null, 2)),
  ]);
  if (assertPerformance && evidence.performanceThresholdFailures.length > 0) {
    throw new Error(`Performance threshold failures: ${JSON.stringify(evidence.performanceThresholdFailures)}`);
  }
} catch (error) {
  evidence.finishedAt = new Date().toISOString();
  evidence.fatalError = String(error?.stack ?? error);
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ ...evidence, status: 'failed' }, null, 2));
  await page.screenshot({ path: path.join(screenshotsRoot, 'error.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
}
