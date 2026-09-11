import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/create-issues');
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe';
const mq = (sql) =>
  execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
    encoding: 'utf8',
    env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
  });

const result = {
  verdict: 'RUNNING',
  lane: 'ipc_lane7',
  actor: 'thukho',
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
  const preflight = mq(`
    SELECT COUNT(DISTINCT mr.requestId) requestCount,COUNT(mrl.requestLineId) lineCount
    FROM materialrequests mr JOIN materialrequestlines mrl ON mrl.requestId=mr.requestId
    WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15' AND mr.status IN ('MANAGERAPPROVED','SENTTOWAREHOUSE','EXPORTED');
    SELECT COUNT(*) issueCount FROM inventoryissues ii JOIN materialrequests mr ON mr.requestId=ii.materialRequestId
    WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15';
  `).trim();
  if (!preflight.includes('12\t584')) throw new Error(`Issue preflight demand mismatch: ${preflight}`);

  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] });
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.exposeBinding('__p05issue', (_source, kind) => {
    result.physicalInput[`${kind}Trusted`] = true;
  });
  await context.addInitScript(() => {
    addEventListener(
      'pointerdown',
      (event) => {
        if (event.isTrusted) void globalThis.__p05issue('pointer');
      },
      true,
    );
    addEventListener(
      'keydown',
      (event) => {
        if (event.isTrusted) void globalThis.__p05issue('keyboard');
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
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText });
    }
  });
  page.on('response', (response) => {
    const request = response.request();
    const requestPath = new URL(response.url()).pathname;
    if (request.method() !== 'GET' && requestPath.startsWith('/api/')) {
      result.requests.push({ method: request.method(), path: requestPath, status: response.status() });
    }
  });

  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').click();
  await page.keyboard.type('thukho');
  await page.locator('#password').click();
  await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD);
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()]);
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  for (let guard = 0; guard < 12; guard += 1) {
    const pending = Number(
      mq(`
      SELECT COUNT(*) FROM materialrequests mr
      WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15'
        AND NOT EXISTS (SELECT 1 FROM inventoryissues ii WHERE ii.materialRequestId=mr.requestId);
    `)
        .trim()
        .split(/\r?\n/)
        .at(-1),
    );
    if (pending === 0) break;

    await page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo phiếu xuất kho' });
    const demandTrigger = dialog.getByRole('combobox', { name: 'Chọn nhu cầu nguyên liệu' });
    await demandTrigger.click();
    await page.getByRole('option').first().click();
    const selectedDemandLabel = (await demandTrigger.textContent())?.replace(/[▼▾⌄]\s*$/, '').trim();
    if (!/^Ngày \d{2}\/\d{2}\/\d{4} · \d+ nhóm nguyên liệu \(.+\)$/.test(selectedDemandLabel ?? '')) {
      throw new Error(`Issue candidate is not user-language first: ${selectedDemandLabel}`);
    }

    const warehouseTrigger = dialog.getByRole('combobox', { name: 'Chọn kho xuất' });
    await warehouseTrigger.click();
    await page.getByRole('option', { name: 'Kho mẫu gia vị BOM', exact: true }).click();
    const selectedWarehouseLabel = (await warehouseTrigger.textContent())?.replace(/[▼▾⌄]\s*$/, '').trim();
    const confirm = dialog.getByRole('button', { name: /^Xác nhận xuất \d+ dòng$/ });
    await confirm.waitFor({ state: 'visible' });
    try {
      await page.waitForFunction((button) => !button.disabled, await confirm.elementHandle(), { timeout: 30_000 });
    } catch (error) {
      const allocationStatus = await dialog.locator('[role="status"], [role="alert"]').allTextContents();
      throw new Error(`Issue allocation stayed disabled for ${selectedWarehouseLabel}: ${allocationStatus.join(' | ')}`, { cause: error });
    }
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory-issues');
    await confirm.click();
    const response = await responsePromise;
    const body = await response.json().catch(() => null);
    if (response.status() !== 201) throw new Error(`Issue create ${response.status()}: ${JSON.stringify(body)}`);
    result.actions.push({ issueCode: body?.data?.issueCode, demand: selectedDemandLabel });
    await dialog.waitFor({ state: 'detached' });
    await page.waitForTimeout(350);
  }

  result.dbPostflight = mq(`
    SELECT COUNT(DISTINCT ii.issueId) issueCount,COUNT(iil.issueLineId) lineCount,COUNT(DISTINCT ii.materialRequestId) demandCount
    FROM inventoryissues ii JOIN inventoryissuelines iil ON iil.issueId=ii.issueId JOIN materialrequests mr ON mr.requestId=ii.materialRequestId
    WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15';
    SELECT COUNT(*) movementCount FROM stockmovements sm JOIN inventoryissues ii ON ii.issueId=sm.refId JOIN materialrequests mr ON mr.requestId=ii.materialRequestId
    WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15' AND sm.movementType='ISSUE' AND sm.refTable='inventoryissues';
    SELECT mr.status,COUNT(*) FROM materialrequests mr WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15' GROUP BY mr.status;
    SELECT COUNT(*) missingSource FROM inventoryissuelines iil JOIN inventoryissues ii ON ii.issueId=iil.issueId JOIN materialrequests mr ON mr.requestId=ii.materialRequestId
    WHERE mr.requestDate BETWEEN '2026-08-10' AND '2026-08-15' AND iil.materialRequestLineId IS NULL;
  `).trim();
  if (!result.dbPostflight.includes('12\t584\t12') || !result.dbPostflight.includes('584') || !result.dbPostflight.includes('EXPORTED\t12') || !result.dbPostflight.endsWith('0')) {
    throw new Error(`Issue postflight mismatch: ${result.dbPostflight}`);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(output, 'warehouse-after-issues.png'), fullPage: true });
  if (!result.physicalInput.pointerTrusted || !result.physicalInput.keyboardTrusted || result.consoleErrors.length || result.pageErrors.length || result.requestFailures.length) {
    throw new Error('Issue browser/physical gate failed');
  }
  result.verdict = 'PASS';
} catch (error) {
  result.verdict = 'FAIL';
  result.failure = String(error?.stack ?? error);
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  result.finishedAtUtc = new Date().toISOString();
  const serialized = JSON.stringify(result);
  if (serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret detected in issue artifact');
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
}
if (result.verdict !== 'PASS') process.exitCode = 1;
