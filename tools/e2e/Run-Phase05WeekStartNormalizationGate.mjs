import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/week-start-fix')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })
const evidence = { lane: 'ipc_lane7', mode: 'headed-read-only-week-normalization', protectedLaneConnectionAttempts: 0, api: [], consoleErrors: [], pageErrors: [], requestFailures: [], startedAtUtc: new Date().toISOString() }
const assert = (condition, message) => { if (!condition) throw new Error(message) }
let browser
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }) })
  page.on('response', async response => {
    const url = new URL(response.url())
    if (url.pathname === '/api/coordination/weekly-menu') evidence.api.push({ path: url.pathname, query: url.search, status: response.status(), body: await response.json().catch(() => null) })
  })
  await page.goto('http://127.0.0.1:3030/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([page.waitForURL(url => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/weekly-menu')
  await page.evaluate(() => window.localStorage.setItem('ipc.weeklyMenu.lastWeekStartDate', '2026-08-09'))
  await page.reload()

  const weekInput = page.getByRole('textbox', { name: 'Tuần bắt đầu' })
  await weekInput.waitFor()
  const storedWeek = await page.evaluate(() => window.localStorage.getItem('ipc.weeklyMenu.lastWeekStartDate'))
  evidence.normalization = { displayed: await weekInput.inputValue(), stored: storedWeek }
  assert(evidence.normalization.displayed === '10/08/2026' && storedWeek === '2026-08-10', 'Sunday stored scope was not normalized to Monday 10/08.')

  await page.getByRole('button', { name: 'Mở lịch chọn ngày' }).first().click()
  const calendar = page.getByRole('dialog', { name: 'Lịch chọn ngày' })
  const box = await calendar.boundingBox()
  evidence.calendar = {
    width: box?.width,
    height: box?.height,
    sunday9Disabled: await calendar.getByRole('button', { name: 'Chọn ngày 09/08/2026' }).isDisabled(),
    monday10Enabled: !(await calendar.getByRole('button', { name: 'Chọn ngày 10/08/2026' }).isDisabled()),
  }
  assert((box?.width ?? 999) <= 264 && evidence.calendar.sunday9Disabled && evidence.calendar.monday10Enabled, 'Compact week-start calendar contract failed.')
  await calendar.getByRole('button', { name: 'Đóng' }).click()

  const customerTrigger = page.getByRole('combobox').first()
  evidence.customers = []
  for (const customer of ['ANV - AMANN', 'DAV - Draxlmaier']) {
    await customerTrigger.click()
    await page.getByRole('option', { name: customer, exact: true }).click()
    const matrix = page.getByRole('region', { name: 'Bảng bố cục thực đơn theo file khách hàng' })
    await matrix.getByText('Món mặn 1', { exact: true }).first().waitFor({ timeout: 30000 })
    const facts = await matrix.evaluate(element => ({
      rowLabels: [...element.querySelectorAll('tbody tr td:first-child')].map(cell => cell.textContent?.trim()).filter(Boolean),
      dishNames: [...element.querySelectorAll('tbody tr td:not(:first-child)')].map(cell => cell.textContent?.replace(/\s+/g, ' ').trim()).filter(text => text && text !== '-'),
    }))
    assert(facts.dishNames.length > 0, `${customer} has no rendered dish names for 10/08.`)
    evidence.customers.push({ customer, dishCount: facts.dishNames.length, sampleDishes: [...new Set(facts.dishNames)].slice(0, 8) })
  }
  const committedRequests = evidence.api.filter(item => item.status === 200)
  assert(committedRequests.some(item => item.query.includes('weekStartDate=2026-08-10')), 'No committed-menu request used normalized week 10/08.')
  assert(!committedRequests.some(item => item.query.includes('weekStartDate=2026-08-09')), 'A committed-menu request still used Sunday 09/08.')
  await page.screenshot({ path: path.join(output, 'week-start-normalized-1365x900.png'), fullPage: true })
  assert(evidence.consoleErrors.length === 0 && evidence.pageErrors.length === 0 && evidence.requestFailures.length === 0, 'Browser errors occurred.')
  evidence.status = 'PASS'
  await context.close()
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (browser) await browser.close()
  evidence.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(evidence)
  if (/Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Evidence secret scan failed.')
  evidence.secretSelfCheck = 'PASS'
  await writeFile(path.join(output, 'week-start-normalization.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
