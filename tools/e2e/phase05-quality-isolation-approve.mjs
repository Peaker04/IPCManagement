import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/quality-isolation/approve')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const code = 'PR-SUP-20260813-6F77'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, requests: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [] }
let browser, context
await mkdir(output, { recursive: true })
try {
  result.dbPreflight = mq(`SELECT purchaseRequestCode,status FROM purchaserequests WHERE purchaseRequestCode='${code}';`)
  if (!result.dbPreflight.replaceAll('\r', '').endsWith(`${code}\tSENTTOSUPPLIER`)) throw new Error(`Approval preflight drifted: ${result.dbPreflight}`)
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05qualityApprove', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => { addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05qualityApprove('pointer') }, true); addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05qualityApprove('keyboard') }, true) })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => { const pathname = new URL(response.url()).pathname; if (pathname.startsWith('/api/') && response.request().method() !== 'GET') result.requests.push({ method: response.request().method(), path: pathname, status: response.status() }) })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('quanly')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_MANAGER_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/approvals?targetType=purchase-request', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const search = page.locator('#approval-inbox-search'); await search.click(); await page.keyboard.type(code); await page.waitForTimeout(350)
  const rows = page.locator('article.ipc-approval-record').filter({ hasText: code })
  if (await rows.count() !== 1) throw new Error(`Expected one approval row for ${code}, found ${await rows.count()}`)
  const row = rows.first(); await row.getByRole('button', { name: 'Duyệt chứng từ', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt đề xuất mua?' })
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.includes('/api/approvals/purchase-request/'))
  await dialog.getByRole('button', { name: 'Duyệt chứng từ', exact: true }).click()
  const response = await responsePromise
  if (response.status() !== 200) throw new Error(`Approval ${response.status()}: ${JSON.stringify(await response.json().catch(() => null))}`)
  await dialog.waitFor({ state: 'detached' })
  result.dbPostflight = mq(`SELECT purchaseRequestCode,status FROM purchaserequests WHERE purchaseRequestCode='${code}';`)
  result.verdict = result.dbPostflight.replaceAll('\r', '').endsWith(`${code}\tAPPROVED`) && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length ? 'PASS' : 'FAIL'
  await page.screenshot({ path: path.join(output, 'approved.png'), fullPage: true })
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error) }
finally { if (context) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {}); result.finishedAtUtc = new Date().toISOString(); const serialized = JSON.stringify(result); if (serialized.includes(process.env.IPC_LANE7_MANAGER_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed'); await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`) }
if (result.verdict !== 'PASS') process.exitCode = 1
