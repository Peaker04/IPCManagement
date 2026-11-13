import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';
import { loginRole } from '../fixtures/authHelpers';
import { readOwnedSnapshot } from '../core/ownedSnapshot';

const directory = () => process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(directory(), name), JSON.stringify(value, null, 2));

test('@G7-Desktop four desktop sizes and native Chrome zoom on actual warehouse controls', async ({ browser, adminPage, dieuphoiPage, thukhoPage, dbVerifier }) => {
  test.setTimeout(360_000);
  const scope = scenarioScope(dbVerifier, 10);
  const { batchId } = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  const url = `/warehouse?view=mrx-daily&batchId=${batchId}&date=${scope.weekStartDate}`;
  write('measurement-scope.json', { batchId, serviceDate: scope.weekStartDate });
  const measurements = [];
  for (const [width, height] of [[1280,720], [1366,768], [1440,900], [1920,1080]]) {
    await thukhoPage.setViewportSize({ width, height });
    await thukhoPage.goto(url);
    const fill = thukhoPage.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true });
    await fill.click();
    await thukhoPage.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click({ trial: true });
    const input = thukhoPage.getByRole('spinbutton').first();
    await expect(input).not.toHaveValue('');
    await input.focus();
    await thukhoPage.keyboard.press('Tab');
    expect(await thukhoPage.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
    const overflow = await thukhoPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    measurements.push({ width, height, overflow });
    await thukhoPage.screenshot({ path: path.join(directory(), `desktop-${width}.png`) });
  }
  const axe = await new AxeBuilder({ page: thukhoPage }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  write('desktop-axe.json', axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target }) => target) })));
  // Record all violations before asserting: no exclusion/disableRules padding.
  write('desktop-layout.json', measurements);
  const context = await browser.newContext({ viewport: null, deviceScaleFactor: undefined, baseURL: process.env.MRX_E2E_BASE_URL });
  const zoom = [];
  try {
    const page = await context.newPage();
    await loginRole(page, 'thukho');
    await page.goto(url);
    const cdp = await context.newCDPSession(page);
    const browserCdp = await browser.newBrowserCDPSession();
    const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
    const browserPid = processInfo.find((item) => item.type === 'browser')!.id;
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', width: 1280, height: 720 } });
    const geometry = () => page.evaluate(() => ({ outerWidth, outerHeight, innerWidth, innerHeight, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    const nativeZoom = (steps: number) => execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/mrx-evidence/Set-MrxChromeZoom.ps1'), '-BrowserPid', String(browserPid), '-Steps', String(steps)], { windowsHide: true });
    await page.bringToFront();
    nativeZoom(0);
    await page.waitForTimeout(300);
    const baseline = await geometry();
    for (const [percent, steps] of [[125,2],[150,3],[200,5]]) {
      nativeZoom(steps);
      await page.waitForTimeout(350);
      const actual = await geometry();
      expect(Math.abs(actual.dpr / baseline.dpr - percent / 100)).toBeLessThan(0.03);
      expect(actual.outerWidth).toBe(baseline.outerWidth);
      expect(actual.overflow).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: 'Điền đủ toàn bộ', exact: true }).click();
      await page.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click({ trial: true });
      zoom.push({ percent, baseline, actual });
      await page.screenshot({ path: path.join(directory(), `native-zoom-${percent}.png`) });
    }
    nativeZoom(0);
    await browserCdp.detach();
  } finally { write('desktop-native-zoom.json', zoom); await context.close(); }
  expect(axe.violations).toEqual([]);
});

test('@G7-Memory thirty comparable route/dialog/Escape cycles with settled post-GC snapshots', async ({ adminPage }) => {
  test.setTimeout(840_000);
  const scope = JSON.parse(fs.readFileSync(path.join(directory(), 'measurement-scope.json'), 'utf8')) as { batchId: string; serviceDate: string };
  const weeklyUrl = `/weekly-menu?view=mrx-batch&weekStartDate=${scope.serviceDate}`;
  const privateDirectory = process.env.MRX_E2E_PRIVATE_ARTIFACT_DIRECTORY;
  if (!privateDirectory) throw new Error('Heap snapshots require run-private storage, never Git or public traces.');
  fs.mkdirSync(privateDirectory, { recursive: true });
  const cdp = await adminPage.context().newCDPSession(adminPage);
  await cdp.send('HeapProfiler.enable');
  const checkpoints: { cycle: number; metrics: { documents: number; nodes: number; jsEventListeners: number }; heap: { usedSize: number; totalSize: number }; detachedNames: Record<string, number>; failedRequests: number; snapshotBytes: number }[] = [];
  let failedRequests = 0;
  adminPage.on('requestfailed', () => { failedRequests++; });
  await adminPage.goto(weeklyUrl);
  await expect(adminPage.getByRole('button', { name: 'Nhập Excel', exact: true })).toBeVisible();
  await expect(adminPage.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue(scope.serviceDate.split('-').reverse().join('/'));
  await adminPage.waitForLoadState('networkidle');
  const timeOrigin = await adminPage.evaluate(() => performance.timeOrigin);
  const checkpoint = async (cycle: number) => {
    await adminPage.waitForLoadState('networkidle');
    await cdp.send('HeapProfiler.collectGarbage');
    await adminPage.waitForTimeout(300);
    const metrics = await cdp.send('Memory.getDOMCounters');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const file = path.join(privateDirectory, `cycle-${cycle}.heapsnapshot`);
    const descriptor = fs.openSync(file, 'wx+');
    const receive = (entry: { chunk: string }) => fs.writeSync(descriptor, entry.chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', receive);
    let ownedSnapshot: ReturnType<typeof readOwnedSnapshot>;
    try {
      await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      ownedSnapshot = readOwnedSnapshot(descriptor);
    }
    finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', receive); fs.closeSync(descriptor); }
    const snapshot = JSON.parse(ownedSnapshot.content);
    const fields: string[] = snapshot.snapshot.meta.node_fields;
    const detachedIndex = fields.indexOf('detachedness');
    const nameIndex = fields.indexOf('name');
    expect(detachedIndex, 'Chrome detachedness metadata is required; unavailable is not zero.').toBeGreaterThanOrEqual(0);
    const names: Record<string, number> = {};
    if (detachedIndex >= 0) for (let index = 0; index < snapshot.nodes.length; index += fields.length) {
      if (snapshot.nodes[index + detachedIndex] === 2) {
        const name: string = snapshot.strings[snapshot.nodes[index + nameIndex]];
        names[name] = (names[name] ?? 0) + 1;
      }
    }
    expect(await adminPage.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    checkpoints.push({ cycle, metrics, heap, detachedNames: names, failedRequests, snapshotBytes: ownedSnapshot.bytes });
    write('memory-checkpoints.json', { checkpoints, limitation: 'Same-document SPA route/filter/modal/Escape cycles only; no export cancellation, exhaustive retaining-path or managed-allocation certification. Raw snapshots retained in run-user-only private diagnostics.' });
    console.log(`[MEMORY] ${cycle}/30 settled same-document cycles, private post-GC snapshot recorded.`);
  };
  // Warm up the same modal and route before comparable checkpoints.
  for (let cycle = -2; cycle <= 30; cycle++) {
    if (cycle >= 0 && cycle % 10 === 0) await checkpoint(cycle);
    if (cycle === 30) break;
    const reconciliationGroup = adminPage.getByRole('button', { name: 'Đối soát nguyên liệu', exact: true });
    if (await reconciliationGroup.getAttribute('aria-expanded') !== 'true') await reconciliationGroup.click();
    await adminPage.getByRole('link', { name: 'Rà soát dòng ngày', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: 'Đối soát nguyên liệu', exact: true })).toBeVisible();
    await adminPage.waitForTimeout(3000);
    await adminPage.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' }).fill('Bí');
    await adminPage.waitForTimeout(3000);
    await adminPage.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' }).clear();
    await adminPage.waitForTimeout(3000);
    const weeklyGroup = adminPage.getByRole('button', { name: 'Thực đơn tuần', exact: true });
    if (await weeklyGroup.getAttribute('aria-expanded') !== 'true') await weeklyGroup.click();
    await adminPage.getByRole('link', { name: 'Chuẩn bị lô đối soát', exact: true }).click();
    await expect(adminPage.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue(scope.serviceDate.split('-').reverse().join('/'));
    await adminPage.waitForTimeout(3000);
    await adminPage.getByRole('button', { name: 'Nhập Excel', exact: true }).click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();
    await adminPage.waitForTimeout(3000);
    await adminPage.keyboard.press('Escape');
    await expect(adminPage.getByRole('dialog')).toHaveCount(0);
    // Real think time at each action keeps memory diagnostics separate from saturation.
    await adminPage.waitForTimeout(3000);
  }
  expect(checkpoints.map((item) => item.cycle)).toEqual([0,10,20,30]);
  await cdp.detach();
});
