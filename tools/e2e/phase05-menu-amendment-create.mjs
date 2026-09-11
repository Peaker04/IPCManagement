import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/menu-amendment')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const query = (sql) => execFileSync(mysql, [
  '--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`,
], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const businessSnapshotSql = `SELECT
  (SELECT COUNT(*) FROM menuschedules) menuschedules,
  (SELECT COUNT(*) FROM menuitems) menuitems,
  (SELECT COUNT(*) FROM menuversions) menuversions,
  (SELECT COUNT(*) FROM materialrequests) materialrequests,
  (SELECT COUNT(*) FROM purchaserequests) purchaserequests,
  (SELECT COUNT(*) FROM purchaseorders) purchaseorders,
  (SELECT COUNT(*) FROM inventoryreceipts) inventoryreceipts,
  (SELECT COUNT(*) FROM inventoryissues) inventoryissues;`

const result = {
  verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0,
  requests: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
  consoleErrors: [], pageErrors: [], requestFailures: [],
}
await mkdir(output, { recursive: true })
let browser
let context
try {
  result.before = {
    business: query(businessSnapshotSql),
    amendment: query('SELECT COUNT(*) amendments,(SELECT COUNT(*) FROM menuamendmentlines) amendmentLines,(SELECT COUNT(*) FROM menuamendmentreconciliationcases) reconciliationCases,(SELECT COUNT(*) FROM servicerundecisionitems) decisionItems FROM menuamendments;'),
    exactSlot: query("SELECT HEX(mi.DishId),d.DishName FROM menuschedules ms JOIN menuitems mi ON mi.MenuId=ms.MenuId JOIN dishes d ON d.DishId=mi.DishId WHERE ms.CustomerId=UNHEX('3E0FE4B1A5BD164CBE27EA7146E10D37') AND ms.ServiceDate='2026-08-10' AND ms.ShiftName='AFTERNOON' AND mi.DishSlot='savory-main';"),
  }
  if (!result.before.amendment.includes('0\t0\t0')) throw new Error(`Amendment preflight is not empty: ${result.before.amendment}`)
  if (!result.before.exactSlot.includes('A16E1E7FEF7EDA4D92B9863B691C824A\tCá hố kho')) throw new Error(`Exact slot drifted: ${result.before.exactSlot}`)

  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05amendment', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05amendment('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05amendment('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname
    if (pathname.startsWith('/api/') && response.request().method() !== 'GET') result.requests.push({ method: response.request().method(), path: pathname, status: response.status() })
  })

  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click()
  await page.keyboard.type('dieuphoi')
  await page.locator('#password').click()
  await page.keyboard.type(process.env.IPC_LANE7_COORDINATOR_PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login')),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ])
  await page.goto('http://127.0.0.1:3030/weekly-menu', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /^ANV -/ }).click()
  const week = page.getByLabel('Tuần bắt đầu')
  await week.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('10/08/2026')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Chỉnh sửa thực đơn' }).click()
  const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa thực đơn tuần' })
  const afternoonSavory = dialog.getByRole('heading', { name: 'MENU MẶN - CA CHIỀU' }).locator('..')
  const monday = afternoonSavory.locator('div.rounded-md').first()
  if (!(await monday.innerText()).includes('Cá hố kho')) throw new Error(`Monday afternoon savory UI drifted: ${await monday.innerText()}`)
  await monday.getByRole('combobox').click()
  const replacement = page.getByRole('option').filter({ hasNotText: /^Cá hố kho$/ }).first()
  result.replacementDish = (await replacement.innerText()).trim()
  await replacement.click()
  result.selectedAfterClick = (await monday.getByRole('combobox').innerText()).trim()
  result.selectedDishIdAfterClick = await monday.getByRole('combobox').getAttribute('data-dish-id')
  result.selectedAttributes = await monday.getByRole('combobox').evaluate((element) => Object.fromEntries(Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value])))
  if (result.selectedAfterClick !== result.replacementDish) throw new Error(`Dish selection did not update: ${result.selectedAfterClick}`)
  await dialog.getByText('1 thay đổi đang chờ lưu', { exact: true }).waitFor()
  const reason = dialog.getByLabel('Lý do thay đổi lịch đã khóa')
  await reason.click()
  await page.keyboard.type('Khách hàng yêu cầu thay món mặn ca chiều; cần đối soát chứng từ đã phát sinh.')
  result.afterReason = {
    pendingCopy: await dialog.getByText(/thay đổi đang chờ lưu|Chưa có thay đổi/).innerText(),
    draftDishId: await monday.getByRole('combobox').getAttribute('data-dish-id'),
    currentDishId: await monday.getByRole('combobox').getAttribute('data-current-dish-id'),
  }
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await page.waitForTimeout(3_000)
  result.postClickUi = (await page.locator('body').innerText()).slice(-2_500)
  const matchingRequest = result.requests.find((item) => item.path === '/api/coordination/weekly-menu/amendments')
  if (!matchingRequest) throw new Error(`No amendment request after save. UI: ${result.postClickUi}`)
  const response = await page.waitForResponse((candidate) => candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/api/coordination/weekly-menu/amendments', { timeout: 1 }).catch(() => null)
  if (!response) throw new Error(`Amendment request completed before body capture with status ${matchingRequest.status}`)
  result.createResponse = { status: response.status(), body: await response.json().catch(() => null) }
  if (response.status() !== 200) throw new Error(`Create amendment returned ${response.status()}`)
  await dialog.waitFor({ state: 'detached' })
  await page.screenshot({ path: path.join(output, 'created.png'), fullPage: true })

  result.after = {
    business: query(businessSnapshotSql),
    amendment: query("SELECT HEX(ma.menuAmendmentId),ma.status,mal.serviceDate,mal.shiftName,mal.dishSlot,HEX(mal.oldDishId),HEX(mal.newDishId),HEX(marc.menuAmendmentReconciliationCaseId) FROM menuamendments ma JOIN menuamendmentlines mal ON mal.menuAmendmentId=ma.menuAmendmentId LEFT JOIN menuamendmentreconciliationcases marc ON marc.menuAmendmentId=ma.menuAmendmentId;"),
    appendCounts: query("SELECT (SELECT COUNT(*) FROM menuamendments) amendments,(SELECT COUNT(*) FROM menuamendmentlines) amendmentLines,(SELECT COUNT(*) FROM menuamendmentreconciliationcases) reconciliationCases,(SELECT COUNT(*) FROM servicerundecisionitems) decisionItems,(SELECT COUNT(*) FROM auditlogs WHERE entityName='MenuAmendment') amendmentAudits;"),
    exactSlot: query("SELECT HEX(mi.DishId),d.DishName FROM menuschedules ms JOIN menuitems mi ON mi.MenuId=ms.MenuId JOIN dishes d ON d.DishId=mi.DishId WHERE ms.CustomerId=UNHEX('3E0FE4B1A5BD164CBE27EA7146E10D37') AND ms.ServiceDate='2026-08-10' AND ms.ShiftName='AFTERNOON' AND mi.DishSlot='savory-main';"),
  }
  const createBody = result.createResponse.body?.data
  result.verdict = result.before.business === result.after.business
    && result.before.exactSlot === result.after.exactSlot
    && result.after.amendment.includes('\tRECONCILIATION_REQUIRED\t2026-08-10\tAFTERNOON\tsavory-main\tA16E1E7FEF7EDA4D92B9863B691C824A\t')
    && createBody?.requiresReconciliation === true
    && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted
    && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.requestFailures.length === 0
    && result.requests.every((item) => item.status >= 200 && item.status < 300)
    ? 'PASS' : 'FAIL'
} catch (error) {
  result.verdict = 'FAIL'
  result.failure = String(error?.stack ?? error)
} finally {
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_COORDINATOR_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'create-result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
console.log(JSON.stringify(result, null, 2))
if (result.verdict !== 'PASS') process.exitCode = 1
