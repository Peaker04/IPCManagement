import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/demand-tab-probe')
const result = { verdict: 'RUNNING', requests: [], consoleErrors: [], pageErrors: [], nonGetRequests: [] }
let context
let browser
let chromeProcess

const startCdpChrome = async () => {
  const port = 9337
  const profile = path.join(output, `cdp-profile-${Date.now()}`)
  chromeProcess = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1365,900',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: false })
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return `http://127.0.0.1:${port}`
    } catch { /* Chrome is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Run-owned Chrome CDP endpoint did not start')
}

await mkdir(output, { recursive: true })
try {
  const endpoint = await startCdpChrome()
  browser = await chromium.connectOverCDP(endpoint)
  context = browser.contexts()[0]
  const page = context.pages()[0] ?? await context.newPage()
  const cdp = await context.newCDPSession(page)
  const nativeClick = async (locator) => {
    await page.bringToFront()
    await cdp.send('Page.bringToFront')
    await page.waitForTimeout(500)
    const box = await locator.boundingBox()
    if (!box) throw new Error('Native pointer target has no bounding box')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
  }
  await page.addInitScript(() => {
    globalThis.__phase05Probe = { pointer: false, keyboard: false }
    addEventListener('pointerdown', (event) => { if (event.isTrusted) globalThis.__phase05Probe.pointer = true }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) globalThis.__phase05Probe.keyboard = true }, true)
  })
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/')) return
    const record = { method: response.request().method(), path: url.pathname, query: url.search, status: response.status() }
    result.requests.push(record)
    if (record.method !== 'GET' && record.path !== '/api/auth/login') result.nonGetRequests.push(record)
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

  const customer = page.getByRole('combobox').first()
  result.customerBefore = { text: await customer.innerText(), expanded: await customer.getAttribute('aria-expanded') }
  if (result.customerBefore.expanded !== 'true') {
    const box = await customer.boundingBox()
    if (!box) throw new Error('Customer select has no pointer target')
    result.customerHitTest = await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y)
      return target ? { tag: target.tagName, role: target.getAttribute('role'), text: target.textContent?.trim(), pointerEvents: getComputedStyle(target).pointerEvents, outerHtml: target.outerHTML.slice(0, 500) } : null
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    await nativeClick(customer)
    await page.waitForTimeout(300)
    result.customerAfterNativeClick = { expanded: await customer.getAttribute('aria-expanded'), dispatch: await page.evaluate(() => globalThis.__phase05Probe) }
  }
  if (await customer.getAttribute('aria-expanded') !== 'true') throw new Error('Physical pointer did not open customer select')
  const option = page.getByRole('option').filter({ hasText: 'ANV' }).first()
  await option.waitFor({ state: 'visible' })
  await nativeClick(option)

  const week = page.getByLabel('Tuần bắt đầu')
  await week.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('10/08/2026')
  await page.keyboard.press('Tab')
  await page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/api/coordination/meal-quantity-plans'
      && url.searchParams.get('weekStartDate') === '2026-08-10'
  }, { timeout: 15_000 }).catch(() => null)
  await page.locator('#schedule-panel').getByText('10/08/2026', { exact: false }).first().waitFor({ state: 'visible' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})

  const demandTab = page.getByRole('tab', { name: 'Nhu cầu', exact: true })
  result.before = await demandTab.evaluate((element) => ({ selected: element.getAttribute('aria-selected'), rect: element.getBoundingClientRect().toJSON(), active: document.activeElement === element }))
  await nativeClick(demandTab)
  await page.locator('#demand-panel').waitFor({ state: 'visible', timeout: 10_000 })
  result.after = await demandTab.evaluate((element) => ({ selected: element.getAttribute('aria-selected'), active: document.activeElement === element }))
  result.dispatch = await page.evaluate(() => globalThis.__phase05Probe)
  result.scope = { customer: await customer.innerText(), week: await week.inputValue(), day: await page.locator('#demand-panel').getByText(/Thứ Hai 10\/08\/2026/).first().innerText() }
  if (result.after.selected !== 'true' || !result.dispatch.pointer) throw new Error('Demand tab physical pointer proof failed')
  if (result.nonGetRequests.length) throw new Error('Read-only probe observed an unexpected mutation')
  result.verdict = 'PASS'
} catch (error) {
  result.verdict = 'FAIL'
  result.failure = String(error?.stack ?? error)
} finally {
  if (browser) await browser.close().catch(() => {})
  if (chromeProcess && chromeProcess.exitCode === null) chromeProcess.kill()
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_COORDINATOR_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}

if (result.verdict !== 'PASS') process.exitCode = 1
