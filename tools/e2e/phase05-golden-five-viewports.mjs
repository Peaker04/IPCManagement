import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/viewports')
const allViewports = [[1920,1080],[1440,900],[1366,768],[1365,900],[1280,900]]
const onlyWidth = Number(process.env.IPC_VIEWPORT_ONLY ?? 0)
const viewports = onlyWidth ? allViewports.filter(([width]) => width === onlyWidth) : allViewports
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, viewports: [] }
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
await context.addInitScript(() => {
  globalThis.__p05Viewport = { cls: 0, longTasks: [] }
  new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__p05Viewport.cls += entry.value }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((list) => { for (const entry of list.getEntries()) globalThis.__p05Viewport.longTasks.push({ startTime: entry.startTime, duration: entry.duration }) }).observe({ type: 'longtask', buffered: true })
})
try {
  const bootstrap = await context.newPage()
  let activeRow = null
  bootstrap.on('console', (message) => { if (activeRow && message.type() === 'error') activeRow.consoleErrors.push(message.text()) })
  bootstrap.on('pageerror', (error) => { if (activeRow) activeRow.pageErrors.push(error.message) })
  bootstrap.on('requestfailed', (request) => { if (activeRow && request.failure()?.errorText !== 'net::ERR_ABORTED') activeRow.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  bootstrap.on('response', (response) => { if (activeRow && response.status() >= 400) activeRow.failedResponses.push({ path: new URL(response.url()).pathname, status: response.status() }) })
  await bootstrap.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await bootstrap.locator('#username').click(); await bootstrap.keyboard.type('quanly')
  await bootstrap.locator('#password').click(); await bootstrap.keyboard.type(process.env.IPC_LANE7_MANAGER_PASSWORD)
  const loginResponse = bootstrap.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST')
  await bootstrap.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  if ((await loginResponse).status() !== 200) throw new Error('Manager login failed before viewport gate')
  for (const [width, height] of viewports) {
    const row = { width, height, consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [], cls: 0, longTasks: [], timeOrigin: null, focus: null, horizontalOverflow: null, closedCards: 0, technicalCopy: [] }
    activeRow = row
    const page = bootstrap
    await page.setViewportSize({ width, height })
    await page.goto(`http://127.0.0.1:3030/chef-dashboard?viewport=${width}x${height}&sample=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const section = page.getByRole('region', { name: 'Ca phục vụ thực tế' })
    await section.waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Ca phục vụ thực tế"] article')].every((element) => element.getAttribute('aria-busy') === 'false'))
    await page.getByRole('combobox', { name: 'Chọn ngày sản xuất' }).focus()
    await page.keyboard.press('Tab')
    row.focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 80), ariaLabel: document.activeElement?.getAttribute('aria-label') }))
    row.closedCards = await section.getByText('Đã đóng ca', { exact: true }).count()
    row.technicalCopy = await section.getByText(/\b(?:MORNING|AFTERNOON|PLANNED|CLOSED|waiver|blocker|append-only)\b/i).allTextContents()
    row.horizontalOverflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
    await page.waitForTimeout(250)
    const perf = await page.evaluate(() => globalThis.__p05Viewport)
    row.cls = perf.cls; row.longTasks = perf.longTasks
    row.timeOrigin = await page.evaluate(() => performance.timeOrigin)
    await page.screenshot({ path: path.join(output, `${width}x${height}.png`), fullPage: true })
    row.pass = row.closedCards === 2 && row.technicalCopy.length === 0 && row.horizontalOverflow.overflow <= 1 && row.cls <= 0.1 && row.consoleErrors.length === 0 && row.pageErrors.length === 0 && row.requestFailures.length === 0 && row.failedResponses.length === 0
    result.viewports.push(row)
  }
  await bootstrap.close()
  const distinctDocuments = new Set(result.viewports.map((row) => row.timeOrigin)).size === viewports.length
  result.verdict = distinctDocuments && result.viewports.every((row) => row.pass) ? 'PASS' : 'FAIL'
} finally {
  await context.close()
  await browser.close()
  await writeFile(path.join(output, onlyWidth ? `result-${onlyWidth}.json` : 'result.json'), JSON.stringify(result, null, 2))
}
if (result.verdict !== 'PASS') throw new Error(JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
