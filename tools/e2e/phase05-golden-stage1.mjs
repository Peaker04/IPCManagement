import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.')
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/stage1')
const runtimeUrl = 'http://127.0.0.1:3030'
const database = 'ipc_lane7'
const weekStartDate = '2026-08-10'
const visibleWeekStartDate = '10/08/2026'
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const requiredEnvironment = ['IPC_LANE7_COORDINATOR_PASSWORD', 'IPC_LANE7_MYSQL_PASSWORD']

for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`Missing in-memory credential ${name}`)
}

const evidence = {
  formatVersion: 1,
  runId: 'phase05-golden-stage1',
  lane: database,
  weekStartDate,
  verdict: 'RUNNING',
  startedAtUtc: new Date().toISOString(),
  protectedLaneConnectionAttempts: 0,
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
  requests: [],
  scopeProofs: [],
  customers: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  screenshots: [],
}

const redact = (value) => JSON.parse(JSON.stringify(value, (key, item) =>
  /password|token|authorization/i.test(key) ? '[REDACTED]' : item))

const mysqlQuery = (sql) => execFileSync(mysql, [
  '--host=localhost', '--port=3306', '--user=root', `--database=${database}`,
  '--batch', '--raw', `--execute=${sql}`,
], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } })

const login = async (page, username, password) => {
  await page.goto(`${runtimeUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click()
  await page.keyboard.type(username)
  await page.locator('#password').click()
  await page.keyboard.type(password)
  const response = page.waitForResponse((item) => item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/auth/login')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  const loginResponse = await response
  if (loginResponse.status() !== 200) throw new Error(`${username} login returned ${loginResponse.status()}`)
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
}

const capturePage = (page, actor) => {
  page.on('console', (message) => { if (message.type() === 'error') evidence.consoleErrors.push({ actor, text: message.text() }) })
  page.on('pageerror', (error) => evidence.pageErrors.push({ actor, text: error.message }))
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ actor, method: request.method(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText })
  })
  page.on('response', async (response) => {
    const pathname = new URL(response.url()).pathname
    if (!pathname.startsWith('/api/') || pathname === '/api/auth/login') return
    const includeResponseBody = pathname === '/api/coordination/customers'
    evidence.requests.push(redact({ actor, method: response.request().method(), path: pathname, query: new URL(response.url()).search, status: response.status(), body: includeResponseBody || response.request().method() !== 'GET' ? await response.json().catch(() => null) : undefined }))
  })
}

const installTrustedInputEvidence = async (context) => {
  await context.exposeBinding('__phase05RecordTrustedInput', (_source, kind) => {
    if (kind === 'pointer') evidence.physicalInput.pointerTrusted = true
    if (kind === 'keyboard') evidence.physicalInput.keyboardTrusted = true
  })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05RecordTrustedInput('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05RecordTrustedInput('keyboard') }, true)
  })
}

const selectScope = async (page, customerCode) => {
  await page.goto(`${runtimeUrl}/weekly-menu`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const customer = page.getByRole('combobox').first()
  if (!(await customer.innerText()).startsWith(`${customerCode} -`)) {
    if (await customer.getAttribute('aria-expanded') !== 'true') await customer.click()
    const option = page.getByRole('option', { name: new RegExp(`^${customerCode} -`) })
    await option.waitFor({ state: 'visible' })
    await option.click()
  }
  if (await customer.getAttribute('aria-expanded') === 'true') {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute('aria-expanded') === 'false')
  }
  const customerId = evidence.requests.findLast((item) => item.path === '/api/coordination/customers')
    ?.body?.data?.find((item) => item.customerCode === customerCode)?.customerId
  if (!customerId) throw new Error(`${customerCode} customer ID was not observed in the customer response`)
  const week = page.getByLabel('Tuần bắt đầu')
  const isExactScopeRequest = (item) => {
    const url = item.url ? new URL(item.url) : new URL(item.query || '', runtimeUrl)
    const path = item.url ? url.pathname : item.path
    return item.method === 'GET'
      && ['/api/coordination/weekly-menu', '/api/coordination/menu-schedules'].includes(path)
      && url.searchParams.get('customerId') === customerId
      && url.searchParams.get('weekStartDate') === weekStartDate
  }
  const schedulePanel = page.locator('#schedule-panel')
  let scopeResponse = evidence.requests.findLast(isExactScopeRequest)
  const projectionAlreadyExact = await schedulePanel.getByText(visibleWeekStartDate, { exact: false }).first().isVisible().catch(() => false)
  if (!scopeResponse || !projectionAlreadyExact) {
    const exactWeekResponse = page.waitForResponse((response) => isExactScopeRequest({ method: response.request().method(), url: response.url() }), { timeout: 15_000 })
    await week.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(visibleWeekStartDate)
    await page.keyboard.press('Tab')
    const scopeNetworkResponse = await exactWeekResponse
    scopeResponse = { method: 'GET', path: new URL(scopeNetworkResponse.url()).pathname, query: new URL(scopeNetworkResponse.url()).search, status: scopeNetworkResponse.status() }
  }
  if (scopeResponse.status !== 200) throw new Error(`${customerCode} exact customer/week request returned ${scopeResponse.status}`)
  await page.waitForTimeout(800)
  const visibleValue = await week.inputValue()
  if (visibleValue !== visibleWeekStartDate) throw new Error(`${customerCode} visible week scope is not exact ${visibleWeekStartDate}`)
  await schedulePanel.getByText(visibleWeekStartDate, { exact: false }).first().waitFor({ state: 'visible' })
  const scheduleText = await schedulePanel.innerText()
  if (!scheduleText.includes('Thứ Hai') || !scheduleText.includes(visibleWeekStartDate)) {
    throw new Error(`${customerCode} first-day DOM does not show Thứ Hai and ${visibleWeekStartDate}`)
  }
  evidence.scopeProofs.push({
    customerCode,
    visibleInput: visibleValue,
    request: { path: scopeResponse.path, query: scopeResponse.query, status: scopeResponse.status },
    firstDayDom: { weekday: 'Thứ Hai', date: visibleWeekStartDate },
  })
}

const setPositiveServing = async (page, input, value) => {
  const current = Number(await input.inputValue())
  if (current > 0) return current
  await input.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(String(value))
  await page.keyboard.press('Enter')
  return value
}

const activateDemandTab = async (page, customerCode) => {
  const demandTab = page.getByRole('tab', { name: 'Nhu cầu', exact: true })
  await demandTab.click()
  await page.waitForTimeout(1_500)
  let strategy = 'pointer'
  if (await demandTab.getAttribute('aria-selected') !== 'true') {
    strategy = 'keyboard-remediation'
    await demandTab.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1_500)
  }
  if (await demandTab.getAttribute('aria-selected') !== 'true') throw new Error(`${customerCode} demand tab physical dispatch failed`)
  await page.locator('#demand-panel').waitFor({ state: 'visible' })
  evidence.demandTabActivations ??= []
  evidence.demandTabActivations.push({ customerCode, strategy, selected: true })
}

const selectExactDay = async (page, targetDate) => {
  const dayObject = page.getByLabel('Điều hướng và trạng thái ngày đang xem')
  for (let guard = 0; guard < 8; guard += 1) {
    const text = await dayObject.innerText()
    if (text.includes(targetDate)) return text
    const visibleMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (!visibleMatch) throw new Error(`Current service date is not visible while selecting ${targetDate}`)
    const [day, month, year] = visibleMatch[1].split('/').map(Number)
    const [targetDay, targetMonth, targetYear] = targetDate.split('/').map(Number)
    const currentValue = new Date(year, month - 1, day).getTime()
    const targetValue = new Date(targetYear, targetMonth - 1, targetDay).getTime()
    const button = page.getByRole('button', { name: targetValue < currentValue ? 'Ngày trước' : 'Ngày sau', exact: true })
    if (!await button.isEnabled()) throw new Error(`Cannot navigate from ${visibleMatch[1]} to ${targetDate}`)
    await button.click()
    await page.waitForFunction((date) => document.querySelector('[aria-label="Điều hướng và trạng thái ngày đang xem"]')?.textContent?.includes(date), targetDate).catch(() => {})
  }
  throw new Error(`Failed to select exact service date ${targetDate}`)
}

const completeDay = async (page, customerCode, dayIndex) => {
  const target = new Date(`${weekStartDate}T00:00:00`)
  target.setDate(target.getDate() + dayIndex)
  const targetDate = `${String(target.getDate()).padStart(2, '0')}/${String(target.getMonth() + 1).padStart(2, '0')}/${target.getFullYear()}`
  const exactDayText = await selectExactDay(page, targetDate)
  const day = { dayIndex, dateText: exactDayText.slice(0, 180), shifts: [] }
  const dayAlreadyComplete = await page.getByText('2/2 ca hoàn tất', { exact: true }).first().isVisible().catch(() => false)
  for (const [shiftLabel, servings] of [['Ca Sáng', customerCode === 'ANV' ? 100 : 120], ['Ca Chiều', customerCode === 'ANV' ? 80 : 90]]) {
    if (!dayAlreadyComplete) {
      const completed = page.getByRole('button', { name: `Đã hoàn tất ${shiftLabel}`, exact: true })
      if (!await completed.count()) {
        const input = page.getByLabel(new RegExp(`^Số suất .* ${shiftLabel}$`)).first()
        await setPositiveServing(page, input, servings)
        const button = page.getByRole('button', { name: `Hoàn tất ${shiftLabel}`, exact: true })
        const response = page.waitForResponse((item) => item.request().method() === 'POST'
          && new URL(item.url()).pathname === '/api/coordination/meal-quantity-plans/quick-servings')
        await button.click()
        const result = await response
        if (result.status() !== 200) throw new Error(`${customerCode} ${shiftLabel} servings returned ${result.status()}`)
      }
    }
    day.shifts.push({ shiftLabel, completed: true })
  }
  await page.getByText('2/2 ca hoàn tất', { exact: true }).first().waitFor({ state: 'visible' })
  return day
}

const operateCustomer = async (page, customerCode) => {
  await selectScope(page, customerCode)
  await page.keyboard.press('Escape')
  await page.getByRole('listbox').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  await page.waitForTimeout(500)
  await activateDemandTab(page, customerCode)
  const customer = { code: customerCode, days: [] }
  for (let index = 0; index < 6; index += 1) {
    customer.days.push(await completeDay(page, customerCode, index))
  }
  const generate = page.getByRole('button', { name: /^(Tạo|Tính lại) nhu cầu/, exact: false })
  if (await generate.count()) {
    const responses = []
    const listener = (response) => { if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/material-demand/generate') responses.push(response.status()) }
    page.on('response', listener)
    await generate.click()
    await page.waitForTimeout(2_000)
    page.off('response', listener)
    if (!responses.length || responses.some((status) => status !== 200)) throw new Error(`${customerCode} weekly demand generation failed: ${responses.join(',')}`)
    customer.demand = { statuses: responses }
  } else {
    customer.demand = { statuses: ['EXISTING'] }
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await activateDemandTab(page, customerCode)
  const screenshot = path.join(output, `${customerCode.toLowerCase()}-demand-reload-1365x900.png`)
  await page.screenshot({ path: screenshot, fullPage: true })
  evidence.screenshots.push(path.relative(root, screenshot).replaceAll('\\', '/'))
  evidence.customers.push(customer)
}

await mkdir(output, { recursive: true })
const task1 = JSON.parse(await readFile(path.join(root, '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/preflight/task1-manifest.json'), 'utf8'))
evidence.task1ManifestSha256 = createHash('sha256').update(await readFile(path.join(root, '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/preflight/task1-manifest.json'))).digest('hex').toUpperCase()
if (task1.verdict !== 'PASS' || task1.lane !== database || task1.databaseFence.protectedLaneConnectionAttempts !== 0) {
  throw new Error('Task 1 precondition failed')
}
evidence.dbPreflight = mysqlQuery(`
SELECT DATABASE() databaseName, COUNT(*) migrationCount, MAX(MigrationId) migrationHead FROM __EFMigrationsHistory;
SELECT c.customerCode,mv.weekStartDate,mv.versionNo,mv.status,COUNT(DISTINCT ms.menuScheduleId) scheduleCount,COUNT(mi.menuItemId) itemCount FROM customers c JOIN menuversions mv ON mv.customerId=c.customerId LEFT JOIN menuschedules ms ON ms.menuVersionId=mv.menuVersionId LEFT JOIN menuitems mi ON mi.menuId=ms.menuId WHERE c.customerCode IN ('ANV','DAV') AND mv.weekStartDate='${weekStartDate}' GROUP BY c.customerCode,mv.weekStartDate,mv.versionNo,mv.status ORDER BY c.customerCode;
SELECT (SELECT COUNT(*) FROM productionplans) productionplans,(SELECT COUNT(*) FROM materialrequests) materialrequests,(SELECT COUNT(*) FROM purchaserequests) purchaserequests,(SELECT COUNT(*) FROM purchaseorders) purchaseorders,(SELECT COUNT(*) FROM inventoryreceipts) inventoryreceipts,(SELECT COUNT(*) FROM inventoryissues) inventoryissues,(SELECT COUNT(*) FROM serviceruns) serviceruns;
`).trim()

let coordinatorContext
let coordinatorBrowser
try {
  evidence.publish = 'ALREADY_ACTIVE_DB_PREFLIGHT'

  coordinatorBrowser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  coordinatorContext = await coordinatorBrowser.newContext({ viewport: { width: 1365, height: 900 } })
  await installTrustedInputEvidence(coordinatorContext)
  const coordinator = coordinatorContext.pages()[0] ?? await coordinatorContext.newPage()
  capturePage(coordinator, 'coordinator')
  await login(coordinator, 'dieuphoi', process.env.IPC_LANE7_COORDINATOR_PASSWORD)
  await operateCustomer(coordinator, 'ANV')
  await operateCustomer(coordinator, 'DAV')
  if (!evidence.physicalInput.pointerTrusted || !evidence.physicalInput.keyboardTrusted) throw new Error('Trusted physical input was not observed')

  evidence.dbPostflight = mysqlQuery(`
SELECT c.customerCode,mv.status,COUNT(DISTINCT mqp.quantityPlanId) quantityPlans,COUNT(DISTINCT CASE WHEN mqp.status='COMPLETED' THEN mqp.quantityPlanId END) completedQuantityPlans,COUNT(DISTINCT mr.requestId) demands FROM customers c JOIN menuversions mv ON mv.customerId=c.customerId AND mv.weekStartDate='${weekStartDate}' LEFT JOIN mealquantityplanlines mqpl ON mqpl.customerId=c.customerId LEFT JOIN mealquantityplans mqp ON mqp.quantityPlanId=mqpl.quantityPlanId AND mqp.serviceDate BETWEEN '${weekStartDate}' AND '2026-08-15' LEFT JOIN productionplans pp ON pp.customerId=c.customerId AND pp.planDate BETWEEN '${weekStartDate}' AND '2026-08-15' LEFT JOIN materialrequests mr ON mr.planId=pp.planId WHERE c.customerCode IN ('ANV','DAV') GROUP BY c.customerCode,mv.status ORDER BY c.customerCode;
SELECT (SELECT COUNT(*) FROM purchaserequests) purchaserequests,(SELECT COUNT(*) FROM purchaseorders) purchaseorders,(SELECT COUNT(*) FROM inventoryreceipts) inventoryreceipts,(SELECT COUNT(*) FROM inventoryissues) inventoryissues,(SELECT COUNT(*) FROM serviceruns) serviceruns;
`).trim()
  evidence.verdict = 'PASS'
} catch (error) {
  evidence.verdict = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (coordinatorContext) await coordinatorContext.close().catch(() => {})
  if (coordinatorBrowser) await coordinatorBrowser.close().catch(() => {})
  evidence.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(evidence)
  const containsCredential = requiredEnvironment.some((name) => serialized.includes(process.env[name]))
  if (containsCredential || /Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) {
    throw new Error('Secret self-check failed')
  }
  await writeFile(path.join(output, 'stage1.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}

if (evidence.verdict !== 'PASS') process.exitCode = 1
