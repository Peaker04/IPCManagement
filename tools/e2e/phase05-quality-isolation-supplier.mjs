import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/quality-isolation/supplier')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const requestCode = 'PR-SUP-20260813-6F77'
const supplementalCode = 'SUP-20260813-153511-4FF3'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, requests: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [] }
let browser, context
await mkdir(output, { recursive: true })
try {
  result.dbPreflight = mq(`SELECT pr.purchaseRequestCode,pr.status,COUNT(prl.purchaseRequestLineId),COUNT(po.purchaseOrderId) FROM purchaserequests pr JOIN purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId LEFT JOIN purchaseorders po ON po.purchaseRequestId=pr.purchaseRequestId WHERE pr.purchaseRequestCode='${requestCode}' GROUP BY pr.purchaseRequestId;`)
  if (!result.dbPreflight.replaceAll('\r', '').includes(`${requestCode}\tDRAFT\t1\t0`)) throw new Error(`Supplier preflight drifted: ${result.dbPreflight}`)
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05qualitySupplier', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => { addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05qualitySupplier('pointer') }, true); addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05qualitySupplier('keyboard') }, true) })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => { const pathname = new URL(response.url()).pathname; if (pathname.startsWith('/api/') && response.request().method() !== 'GET') result.requests.push({ method: response.request().method(), path: pathname, status: response.status() }) })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thumua')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_PURCHASING_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/purchasing?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const supplementalRow = page.getByRole('row').filter({ hasText: supplementalCode })
  await supplementalRow.waitFor({ state: 'visible' })
  if (await supplementalRow.getByRole('button', { name: 'Mở xử lý' }).isVisible().catch(() => false)) await supplementalRow.getByRole('button', { name: 'Mở xử lý' }).click()
  const panel = page.locator('#supplemental-purchase-decision-panel')
  await panel.getByText('Cá hố', { exact: true }).waitFor()
  const sectionText = await panel.locator('xpath=ancestor::section[1]').innerText()
  if (!sectionText.includes('Ca chiều') || !sectionText.includes('0,001 kg') || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(sectionText) || sectionText.includes('FULLDAY') || sectionText.includes('Kilogram')) throw new Error(`Supplemental purchasing copy drifted: ${sectionText}`)
  const choose = panel.getByRole('button', { name: /^Chọn / }).first()
  await choose.click()
  const delivery = panel.getByLabel('Ngày giao'); await delivery.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('10/08/2026'); await page.keyboard.press('Tab')
  const warehouse = panel.getByRole('combobox', { name: 'Kho nhận' }); await warehouse.click(); await page.getByRole('option').first().click()
  const terms = panel.getByLabel('Điều khoản mua'); await terms.click(); await page.keyboard.type('Giao tại kho')
  await panel.getByRole('button', { name: 'Xác nhận nhà cung cấp', exact: true }).click()
  const decisionDialog = page.getByRole('dialog', { name: 'Xác nhận nhà cung cấp' })
  const decisionPromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/supplier-decision'))
  await decisionDialog.getByRole('button', { name: 'Xác nhận nhà cung cấp', exact: true }).click()
  const decision = await decisionPromise
  if (decision.status() !== 200) throw new Error(`Supplier decision ${decision.status()}: ${JSON.stringify(await decision.json().catch(() => null))}`)
  await decisionDialog.waitFor({ state: 'detached' })
  const submit = panel.getByRole('button', { name: 'Gửi đề xuất mua', exact: true })
  await submit.waitFor({ state: 'visible' }); await submit.click()
  const submitDialog = page.getByRole('dialog', { name: 'Gửi đề xuất mua' })
  const submitPromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/submit'))
  await submitDialog.getByRole('button', { name: 'Gửi đề xuất mua', exact: true }).click()
  const submitted = await submitPromise
  if (submitted.status() !== 200) throw new Error(`Submit ${submitted.status()}: ${JSON.stringify(await submitted.json().catch(() => null))}`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  result.uiReload = await page.getByRole('row').filter({ hasText: supplementalCode }).innerText()
  await page.screenshot({ path: path.join(output, 'supplemental-sent-for-approval.png'), fullPage: true })
  result.dbPostflight = mq(`SELECT pr.purchaseRequestCode,pr.status,COUNT(prl.purchaseRequestLineId),SUM(prl.supplierId IS NOT NULL),SUM(prl.expectedDeliveryDate='2026-08-10') FROM purchaserequests pr JOIN purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId WHERE pr.purchaseRequestCode='${requestCode}' GROUP BY pr.purchaseRequestId;`)
  const passed = result.dbPostflight.replaceAll('\r', '').includes(`${requestCode}\tSENTTOSUPPLIER\t1\t1\t1`) && result.uiReload.includes(requestCode) && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
  result.verdict = passed ? 'PASS' : 'FAIL'
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error) }
finally {
  if (context) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {})
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_PURCHASING_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
if (result.verdict !== 'PASS') process.exitCode = 1
