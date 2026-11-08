import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/stage1-diagnostic')
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', customer: 'ANV', requests: [], consoleErrors: [], pageErrors: [], protectedLaneConnectionAttempts: 0 }
let context
let browser
await mkdir(output, { recursive: true })
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = context.pages()[0] ?? await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('response', async (response) => {
    const pathname = new URL(response.url()).pathname
    if (!pathname.startsWith('/api/')) return
    const record = { method: response.request().method(), path: pathname, status: response.status() }
    if (pathname === '/api/coordination/customers') record.body = await response.json().catch(() => null)
    result.requests.push(record)
  })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.addInitScript(() => {
    globalThis.__phase05TabDiagnostic = { pointer: false, keyboard: false }
    addEventListener('pointerdown', (event) => { if (event.isTrusted) globalThis.__phase05TabDiagnostic.pointer = true }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) globalThis.__phase05TabDiagnostic.keyboard = true }, true)
  })
  await page.locator('#username').click()
  await page.keyboard.type('dieuphoi')
  await page.locator('#password').click()
  await page.keyboard.type(process.env.IPC_LANE7_COORDINATOR_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/weekly-menu', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const customerSelect = page.getByRole('combobox').first()
  await page.waitForResponse((response) => new URL(response.url()).pathname === '/api/coordination/customers', { timeout: 10_000 }).catch(() => null)
  await page.waitForTimeout(500)
  result.customerBefore = await customerSelect.innerText()
  result.customerControl = await customerSelect.evaluate((element) => ({
    disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
    ariaExpanded: element.getAttribute('aria-expanded'),
    outerHtml: element.outerHTML.slice(0, 1000),
  }))
  result.shellText = (await page.locator('body').innerText()).slice(0, 4000)
  if (!result.customerBefore.startsWith('ANV -')) {
    await customerSelect.focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)
    result.customerAfterClick = await customerSelect.evaluate((element) => ({
      disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
      ariaExpanded: element.getAttribute('aria-expanded'),
    }))
    result.customerOptions = await page.getByRole('option').allTextContents()
    const anvOption = page.getByRole('option').filter({ hasText: 'ANV' }).first()
    await anvOption.waitFor({ state: 'visible', timeout: 10_000 })
    await anvOption.focus()
    await page.keyboard.press('Enter')
  }
  if (await customerSelect.getAttribute('aria-expanded') === 'true') {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute('aria-expanded') === 'false')
  }
  const week = page.getByLabel('Tuần bắt đầu')
  if (await week.inputValue() !== '10/08/2026') {
    await week.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('10/08/2026')
    await page.keyboard.press('Tab')
  }
  await page.waitForTimeout(800)
  const demandTab = page.getByRole('tab', { name: 'Nhu cầu', exact: true })
  result.tabBefore = await demandTab.evaluate((element) => ({ selected: element.getAttribute('aria-selected'), controls: element.getAttribute('aria-controls'), focused: document.activeElement === element }))
  await demandTab.click()
  await page.waitForTimeout(1500)
  result.tabAfter = await demandTab.evaluate((element) => ({ selected: element.getAttribute('aria-selected'), controls: element.getAttribute('aria-controls'), focused: document.activeElement === element }))
  result.dispatch = await page.evaluate(() => globalThis.__phase05TabDiagnostic)
  result.visiblePanels = await page.locator('[role="tabpanel"]:visible').evaluateAll((items) => items.map((item) => ({ id: item.id, labelledBy: item.getAttribute('aria-labelledby'), text: item.textContent?.trim().slice(0, 200) })))
  result.loadingText = await page.getByText(/^Đang (chuẩn bị nội dung|cập nhật)$/).allTextContents()
  if (result.tabAfter.selected !== 'true' || !result.visiblePanels.some((item) => item.id === 'demand-panel')) throw new Error('Physical keyboard did not activate demand tab')
  await page.waitForTimeout(500)
  result.bodyText = (await page.locator('#demand-panel').innerText()).slice(0, 12000)
  result.inputs = await page.locator('#demand-panel input').evaluateAll((items) => items.map((item) => ({ type: item.type, ariaLabel: item.getAttribute('aria-label'), value: item.value, disabled: item.disabled })))
  result.buttons = await page.locator('#demand-panel button').evaluateAll((items) => items.map((item) => ({ text: item.textContent?.trim(), disabled: item.disabled })).filter((item) => item.text))
  result.activeCustomer = await page.getByRole('combobox').first().innerText()
  await page.screenshot({ path: path.join(output, 'anv-demand-1365x900.png'), fullPage: true })
  result.verdict = 'READ_ONLY_PASS'
} catch (error) {
  result.verdict = 'READ_ONLY_FAIL'
  result.failure = String(error?.stack ?? error)
  if (context) {
    const page = context.pages()[0]
    if (page) await page.screenshot({ path: path.join(output, 'failure-1365x900.png'), fullPage: true }).catch(() => {})
  }
} finally {
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_COORDINATOR_PASSWORD) || /Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
if (result.verdict !== 'READ_ONLY_PASS') process.exitCode = 1
