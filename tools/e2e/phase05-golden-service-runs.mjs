import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/service-runs')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, [
  '--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`,
], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } })
const days = [
  ['2026-08-10', 'Thứ Hai'], ['2026-08-11', 'Thứ Ba'], ['2026-08-12', 'Thứ Tư'],
  ['2026-08-13', 'Thứ Năm'], ['2026-08-14', 'Thứ Sáu'], ['2026-08-15', 'Thứ Bảy'],
]
const plans = mq("SELECT planCode, DATE_FORMAT(planDate,'%Y-%m-%d'), COALESCE(c.customerCode,'') FROM productionplans pp LEFT JOIN customers c ON c.customerId=pp.customerId WHERE planDate BETWEEN '2026-08-10' AND '2026-08-15' ORDER BY planDate,c.customerCode;")
  .trim().split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
    const [planCode, date, customerCode] = line.split('\t')
    return { planCode, date, customerCode }
  })

const result = {
  verdict: 'RUNNING', stage: 'service-runs', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0,
  requests: [], actions: [], consoleErrors: [], pageErrors: [], requestFailures: [],
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, dbPostflight: null,
}
await mkdir(output, { recursive: true })

const openActor = async (actor, passwordKey, task) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05ServiceInput', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05ServiceInput('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05ServiceInput('keyboard') }, true)
  })
  const page = context.pages()[0] ?? await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => {
    const request = response.request(); const requestPath = new URL(response.url()).pathname
    if (requestPath.startsWith('/api/') && request.method() !== 'GET') result.requests.push({ actor, method: request.method(), path: requestPath, status: response.status() })
  })
  try {
    await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
    await page.locator('#username').click(); await page.keyboard.type(actor)
    await page.locator('#password').click(); await page.keyboard.type(process.env[passwordKey])
    await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
    await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const currentCards = page.locator('section[aria-label="Ca phục vụ thực tế"] article')
    await currentCards.first().waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Ca phục vụ thực tế"] article')]
      .every((element) => element.getAttribute('aria-busy') === 'false'))
    await task(page)
  } finally {
    await context.close()
    await browser.close()
  }
}

const selectDay = async (page, date, label) => {
  const trigger = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' })
  if (!(await trigger.textContent())?.includes(label)) {
    await trigger.click()
    await page.locator('[data-slot="select-item"]', { hasText: label }).filter({ hasText: new RegExp(`^${label}$`) }).click()
    await trigger.filter({ hasText: label }).waitFor()
  }
  for (const plan of plans.filter((item) => item.date === date)) {
    const card = page.getByText(plan.planCode, { exact: true }).locator('xpath=ancestor::article[1]')
    await card.waitFor()
    await card.evaluate((element) => new Promise((resolve) => {
      if (element.getAttribute('aria-busy') === 'false') return resolve(undefined)
      const observer = new MutationObserver(() => {
        if (element.getAttribute('aria-busy') === 'false') { observer.disconnect(); resolve(undefined) }
      })
      observer.observe(element, { attributes: true, attributeFilter: ['aria-busy'] })
    }))
  }
}

const waitForCardReady = async (card) => {
  await card.waitFor()
  await card.evaluate((element) => new Promise((resolve) => {
    if (element.getAttribute('aria-busy') === 'false') return resolve(undefined)
    const observer = new MutationObserver(() => {
      if (element.getAttribute('aria-busy') === 'false') { observer.disconnect(); resolve(undefined) }
    })
    observer.observe(element, { attributes: true, attributeFilter: ['aria-busy'] })
  }))
}

try {
  if (plans.length !== 12 || plans.some((plan) => !['ANV', 'DAV'].includes(plan.customerCode))) throw new Error(`Expected 12 ANV/DAV plans, got ${plans.length}`)
  const existingScopes = mq("SELECT CONCAT(DATE_FORMAT(sr.serviceDate,'%Y-%m-%d'),'|',c.customerCode,'|',sr.shiftName,'|',CAST(sr.priceTierAmount AS UNSIGNED)) FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId ORDER BY sr.serviceDate,c.customerCode;")
    .trim().split(/\r?\n/).slice(1).filter(Boolean)
  const allowedScopes = new Set(plans.map((plan) => `${plan.date}|${plan.customerCode}|MORNING|25000`))
  if (existingScopes.some((scope) => !allowedScopes.has(scope))) throw new Error(`Unexpected existing ServiceRun scope: ${existingScopes.join(', ')}`)

  const confirmedCount = Number(mq('SELECT COUNT(*) FROM serviceruns WHERE serviceConfirmedAt IS NOT NULL;').trim().split(/\r?\n/).at(-1))
  if (confirmedCount < 12) await openActor('beptruong', 'IPC_LANE7_CHEF_PASSWORD', async (page) => {
    for (const [date, label] of days) {
      await selectDay(page, date, label)
      const receive = page.getByRole('button', { name: 'Nhận kế hoạch', exact: true })
      if (await receive.count()) {
        const response = page.waitForResponse((item) => new URL(item.url()).pathname === '/api/production-plans/daily/send-to-kitchen' && item.request().method() === 'POST')
        await receive.click(); if ((await response).status() !== 200) throw new Error(`${date}: receive plan failed`)
        result.actions.push({ actor: 'beptruong', date, action: 'Nhận kế hoạch' })
      }
      for (const plan of plans.filter((item) => item.date === date)) {
        const card = page.getByText(plan.planCode, { exact: true }).locator('xpath=ancestor::article[1]')
        await waitForCardReady(card)
        if ((await card.getByText('Sẵn sàng đóng ca', { exact: true }).count()) ||
            (await card.getByText('Đã đóng ca', { exact: true }).count())) continue
        if (!(await card.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).count()) &&
            !(await card.getByText(/Sẵn sàng đóng ca|Đã đóng ca/, { exact: true }).count())) {
          await page.waitForTimeout(300)
          await waitForCardReady(card)
        }
        const open = card.getByRole('button', { name: 'Mở Ca phục vụ', exact: true })
        if (await open.count()) {
          const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/service-runs' && response.request().method() === 'POST')
          await open.click()
          const response = await responsePromise
          if (response.status() >= 400) throw new Error(`${date}/${plan.customerCode}: open failed ${response.status()} ${await response.text()}`)
          await card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true }).waitFor()
          result.actions.push({ actor: 'beptruong', date, customer: plan.customerCode, action: 'Mở Ca phục vụ' })
        }
        const start = card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true })
        if (await start.count()) { await start.click(); await card.getByLabel('Số suất thực tế').waitFor(); result.actions.push({ actor: 'beptruong', date, customer: plan.customerCode, action: 'Bắt đầu phục vụ' }) }
        const actual = card.getByLabel('Số suất thực tế')
        if (await actual.count()) {
          const planned = Number((await card.getByText(/ suất$/).first().textContent())?.replace(/\D/g, ''))
          await actual.click(); await page.keyboard.type(String(planned))
          await card.getByRole('button', { name: 'Ghi nhận', exact: true }).click()
          await card.getByRole('button', { name: 'Xác nhận phục vụ', exact: true }).waitFor()
          result.actions.push({ actor: 'beptruong', date, customer: plan.customerCode, action: 'Ghi nhận', actualServings: planned })
        }
        const confirm = card.getByRole('button', { name: 'Xác nhận phục vụ', exact: true })
        if (await confirm.count()) { await confirm.click(); await card.getByText('Sẵn sàng đóng ca', { exact: true }).waitFor(); result.actions.push({ actor: 'beptruong', date, customer: plan.customerCode, action: 'Xác nhận phục vụ' }) }
      }
    }
    await page.screenshot({ path: path.join(output, 'chef-ready-to-close.png'), fullPage: true })
  })

  const readyRows = mq("SELECT c.customerCode, sr.serviceDate, sr.shiftName, sr.priceTierAmount, sr.actualServings, sr.closedAt FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId ORDER BY sr.serviceDate,c.customerCode;")
  if (readyRows.trim().split(/\r?\n/).slice(1).length !== 12) throw new Error('Expected 12 independent ServiceRuns before close')

  await openActor('quanly', 'IPC_LANE7_MANAGER_PASSWORD', async (page) => {
    for (const [date, label] of days) {
      await selectDay(page, date, label)
      for (const plan of plans.filter((item) => item.date === date)) {
        const card = page.getByText(plan.planCode, { exact: true }).locator('xpath=ancestor::article[1]')
        const close = card.getByRole('button', { name: 'Đóng ca', exact: true })
        await close.waitFor(); await close.click(); await card.getByText('Đã đóng ca', { exact: true }).waitFor()
        result.actions.push({ actor: 'quanly', date, customer: plan.customerCode, action: 'Đóng ca' })
      }
    }
    await page.screenshot({ path: path.join(output, 'manager-closed.png'), fullPage: true })
  })

  result.dbPostflight = mq("SELECT c.customerCode, COUNT(*) runCount, SUM(sr.closedAt IS NOT NULL) closedCount, COUNT(DISTINCT sr.serviceDate) dayCount, GROUP_CONCAT(DISTINCT sr.shiftName), GROUP_CONCAT(DISTINCT sr.priceTierAmount) FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId GROUP BY c.customerCode ORDER BY c.customerCode; SELECT fieldName, COUNT(*) FROM auditlogs WHERE businessArea='ServiceRun' GROUP BY fieldName ORDER BY fieldName; SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='ServiceRun'; SELECT COUNT(*) transitions FROM lifecycletransitions WHERE aggregateType='ServiceRun'; SELECT COUNT(*) outboxMessages FROM lifecycleoutboxmessages WHERE aggregateType='ServiceRun';")
  const closed = Number(mq('SELECT COUNT(*) FROM serviceruns WHERE closedAt IS NOT NULL;').trim().split(/\r?\n/).at(-1))
  const transitions = Number(mq("SELECT COUNT(*) FROM lifecycletransitions WHERE aggregateType='ServiceRun';").trim().split(/\r?\n/).at(-1))
  const receipts = Number(mq("SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='ServiceRun';").trim().split(/\r?\n/).at(-1))
  const outbox = Number(mq("SELECT COUNT(*) FROM lifecycleoutboxmessages WHERE aggregateType='ServiceRun';").trim().split(/\r?\n/).at(-1))
  const badResponses = result.requests.filter((item) => item.status >= 400)
  result.verdict = closed === 12 && transitions === 60 && receipts === 60 && outbox === 60 && badResponses.length === 0 && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.requestFailures.length === 0 && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted ? 'PASS' : 'FAIL'
} catch (error) {
  result.verdict = 'FAIL'; result.error = error instanceof Error ? error.message : String(error)
} finally {
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
}
if (result.verdict !== 'PASS') throw new Error(JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
