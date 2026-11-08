import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(
  '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/kitchen-acknowledgement',
);
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe';
const mq = (sql) =>
  execFileSync(
    mysql,
    ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`],
    {
      encoding: 'utf8',
      env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
    },
  );
const days = [
  ['2026-08-10', 'Thứ Hai'],
  ['2026-08-11', 'Thứ Ba'],
  ['2026-08-12', 'Thứ Tư'],
  ['2026-08-13', 'Thứ Năm'],
  ['2026-08-14', 'Thứ Sáu'],
  ['2026-08-15', 'Thứ Bảy'],
];
const result = {
  verdict: 'RUNNING',
  lane: 'ipc_lane7',
  actor: 'beptruong',
  protectedLaneConnectionAttempts: 0,
  actions: [],
  requests: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
};
let browser;
let context;
await mkdir(output, { recursive: true });
try {
  const preflight = mq(
    `SELECT COUNT(*) issueCount,SUM(receivedAt IS NOT NULL) receivedCount FROM inventoryissues ii JOIN materialrequests mr ON mr.requestId=ii.materialRequestId WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15';`,
  ).trim();
  const [issueCount, receivedCount] = preflight.split(/\r?\n/).at(-1).split('\t').map(Number);
  if (issueCount !== 12 || receivedCount < 0 || receivedCount > issueCount) throw new Error(`Kitchen preflight mismatch: ${preflight}`);
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] });
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.exposeBinding('__p05kitchen', (_source, kind) => {
    result.physicalInput[`${kind}Trusted`] = true;
  });
  await context.addInitScript(() => {
    addEventListener(
      'pointerdown',
      (event) => {
        if (event.isTrusted) void globalThis.__p05kitchen('pointer');
      },
      true,
    );
    addEventListener(
      'keydown',
      (event) => {
        if (event.isTrusted) void globalThis.__p05kitchen('keyboard');
      },
      true,
    );
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED')
      result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText });
  });
  page.on('response', (response) => {
    const request = response.request();
    const requestPath = new URL(response.url()).pathname;
    if (request.method() !== 'GET' && requestPath.startsWith('/api/'))
      result.requests.push({ method: request.method(), path: requestPath, status: response.status() });
  });
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').click();
  await page.keyboard.type('beptruong');
  await page.locator('#password').click();
  await page.keyboard.type(process.env.IPC_LANE7_CHEF_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login')),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ]);
  await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  for (const [date, label] of days) {
    const dayTrigger = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' });
    if (!(await dayTrigger.textContent())?.includes(label)) {
      const scopeResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === '/api/workflow-reports/kitchen-issues/page' &&
          (url.searchParams.get('dateFrom') === date || url.searchParams.get('DateFrom') === date);
      });
      await dayTrigger.click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await scopeResponse;
      await page.waitForFunction(([expectedLabel]) => document.querySelector('[role="combobox"][aria-label="Chọn ngày sản xuất"]')?.textContent?.includes(expectedLabel), [label]);
      await page.waitForTimeout(250);
    }
    for (let guard = 0; guard < 2; guard += 1) {
      const pending = Number(
        mq(
          `SELECT COUNT(*) FROM inventoryissues ii JOIN materialrequests mr ON mr.requestId=ii.materialRequestId WHERE mr.requestDate='${date}' AND ii.receivedAt IS NULL;`,
        )
          .trim()
          .split(/\r?\n/)
          .at(-1),
      );
      if (pending === 0) break;
      const expand = page.getByRole('button', { name: /^Mở \d+ dòng nguồn của / }).first();
      if (await expand.count()) await expand.click();
      const checkbox = page.locator('[role="checkbox"][aria-label^="Ký nhận "]:not([aria-disabled="true"])').first();
      await checkbox.waitFor({ state: 'visible', timeout: 30_000 });
      await checkbox.click();
      const dialog = page.getByRole('dialog', { name: 'Xác nhận đã nhận nguyên liệu?' });
      const issueCode = (await dialog.locator('p').textContent())?.match(/ISS-[A-Z0-9-]+/)?.[0] ?? 'unknown';
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/inventory-issues\/[^/]+\/confirm-receipt$/.test(new URL(response.url()).pathname),
      );
      await dialog.getByRole('button', { name: 'Đã kiểm đếm và nhận', exact: true }).click();
      const response = await responsePromise;
      if (response.status() !== 200) throw new Error(`${date} kitchen acknowledgement ${response.status()}`);
      result.actions.push({ date, issueCode });
      await dialog.waitFor({ state: 'detached' });
      await page.waitForTimeout(500);
    }
  }
  result.dbPostflight = mq(
    `SELECT COUNT(*) issueCount,SUM(receivedAt IS NOT NULL) receivedCount,COUNT(DISTINCT receivedBy) actorCount FROM inventoryissues ii JOIN materialrequests mr ON mr.requestId=ii.materialRequestId WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15'; SELECT COUNT(*) receivedLines FROM inventoryissuelines iil JOIN inventoryissues ii ON ii.issueId=iil.issueId JOIN materialrequests mr ON mr.requestId=ii.materialRequestId WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15' AND ii.receivedAt IS NOT NULL;`,
  ).trim();
  if (!result.dbPostflight.includes('12\t12\t1') || !result.dbPostflight.endsWith('584'))
    throw new Error(`Kitchen postflight mismatch: ${result.dbPostflight}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(output, 'chef-after-acknowledgement.png'), fullPage: true });
  if (
    !result.physicalInput.pointerTrusted ||
    !result.physicalInput.keyboardTrusted ||
    result.consoleErrors.length ||
    result.pageErrors.length ||
    result.requestFailures.length
  )
    throw new Error('Kitchen browser/physical gate failed');
  result.verdict = 'PASS';
} catch (error) {
  result.verdict = 'FAIL';
  result.failure = String(error?.stack ?? error);
  if (context) {
    const page = context.pages()[0];
    if (page) {
      result.failureUi = {
        url: page.url(),
        day: await page.getByRole('combobox', { name: 'Chọn ngày sản xuất' }).textContent().catch(() => null),
        checkboxes: await page.locator('[role="checkbox"][aria-label^="Ký nhận "]').count(),
        bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 4000),
      };
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    }
  }
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  result.finishedAtUtc = new Date().toISOString();
  const serialized = JSON.stringify(result);
  if (serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized))
    throw new Error('Secret detected in kitchen artifact');
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
}
if (result.verdict !== 'PASS') process.exitCode = 1;
