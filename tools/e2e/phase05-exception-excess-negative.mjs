import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/excess-negative')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const sourceLineHex = '77436B29BB29D145803429901CD750D0'
const mq = (sql) => execFileSync(mysql, [
  '--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`,
], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()

const result = {
  verdict: 'RUNNING',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  actor: 'thukho',
  mode: 'headed-read-only-permission-proof',
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
  dispositionRequests: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
}

await mkdir(output, { recursive: true })
const durableSnapshot = () => mq(`
SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
SELECT COUNT(*) dispositions FROM inventoryallocationdispositions WHERE sourceIssueLineId=UNHEX('${sourceLineHex}');
SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('${sourceLineHex}');
SELECT COUNT(*) transitions FROM lifecycletransitions WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('${sourceLineHex}');
SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('${sourceLineHex}');
SELECT COUNT(*) audits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='InventoryAllocationDisposition' AND entityId=UNHEX('${sourceLineHex}');
`)
result.dbBefore = durableSnapshot()

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__p05excessNegative', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05excessNegative('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05excessNegative('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => {
  if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText })
})
page.on('request', (request) => {
  if (new URL(request.url()).pathname === '/api/inventory-returns/allocation-dispositions') {
    result.dispositionRequests.push({ method: request.method(), path: new URL(request.url()).pathname })
  }
})

try {
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click()
  await page.keyboard.type('thukho')
  await page.locator('#password').click()
  await page.keyboard.type(process.env.IPC_LANE7_THUKHO_PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login')),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  const balanceResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/inventory-returns/allocation-balances')
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const balanceResponse = await balanceResponsePromise
  const payload = await balanceResponse.json()
  const source = payload?.data?.find((item) => item.customerCode === 'ANV'
    && item.serviceDate === '2026-08-10'
    && item.shiftName === 'AFTERNOON'
    && item.ingredientName === 'Cá hố')
  result.balanceResponse = {
    status: balanceResponse.status(),
    sourceFound: Boolean(source),
    allowedActions: source?.allowedActions ?? null,
    customerLabel: source ? `${source.customerName} (${source.customerCode})` : null,
    ingredientName: source?.ingredientName ?? null,
  }

  const section = page.getByText('Đối soát nguyên liệu đã xuất', { exact: true }).locator('xpath=ancestor::section[1]')
  const row = section.getByRole('row')
    .filter({ hasText: 'AMANN (ANV)' })
    .filter({ hasText: '10/08/2026' })
    .filter({ hasText: 'Ca chiều' })
    .filter({ hasText: 'Cá hố' })
  await row.waitFor()
  result.ui = {
    sourceRow: await row.innerText(),
    dispositionButtonCount: await section.getByRole('button', { name: 'Điều phối phần dư', exact: true }).count(),
    readOnlyActionCount: await section.getByText('Chưa cần thao tác', { exact: true }).count(),
  }
  await row.click()
  await page.keyboard.press('Tab')
  await page.screenshot({ path: path.join(output, 'thukho-no-cross-customer-disposition.png'), fullPage: true })
} finally {
  await context.close()
  await browser.close()
}

result.dbAfter = durableSnapshot()
const normalizedBefore = result.dbBefore.replaceAll('\r', '')
const passed = normalizedBefore.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions')
  && result.dbAfter === result.dbBefore
  && result.balanceResponse.status === 200
  && result.balanceResponse.sourceFound
  && Array.isArray(result.balanceResponse.allowedActions)
  && result.balanceResponse.allowedActions.length === 0
  && result.ui.dispositionButtonCount === 0
  && result.ui.readOnlyActionCount > 0
  && result.dispositionRequests.length === 0
  && result.physicalInput.pointerTrusted
  && result.physicalInput.keyboardTrusted
  && !result.consoleErrors.length
  && !result.pageErrors.length
  && !result.requestFailures.length

result.verdict = passed ? 'PASS' : 'FAIL'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into excess negative evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
if (!passed) process.exitCode = 1
