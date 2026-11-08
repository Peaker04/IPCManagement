import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/sticky-header-fix')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })
const evidence = { mode: 'headed-read-only-sticky-header-probe', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, consoleErrors: [], pageErrors: [], requestFailures: [], startedAtUtc: new Date().toISOString() }
const assert = (condition, message) => { if (!condition) throw new Error(message) }
let browser
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }) })
  await page.goto('http://127.0.0.1:3030/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([page.waitForURL(url => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/weekly-menu')
  const weekInput = page.getByRole('textbox', { name: 'Tuần bắt đầu' })
  await weekInput.fill('10/08/2026')
  await weekInput.press('Tab')
  const customer = page.getByRole('combobox').first()
  await customer.click()
  await page.getByRole('option', { name: 'ANV - AMANN', exact: true }).click()
  const matrix = page.getByRole('region', { name: 'Bảng bố cục thực đơn theo file khách hàng' })
  await matrix.getByText('Món mặn 1', { exact: true }).first().waitFor({ timeout: 30000 })
  await matrix.evaluate(element => { element.scrollTop = 260 })
  evidence.main = await matrix.evaluate(element => {
    const table = element.querySelector('table')
    const thead = table?.querySelector('thead')
    const th = table?.querySelector('th')
    const viewport = element.getBoundingClientRect()
    const header = th?.getBoundingClientRect()
    return {
      scrollTop: element.scrollTop,
      borderCollapse: table ? getComputedStyle(table).borderCollapse : null,
      theadPosition: thead ? getComputedStyle(thead).position : null,
      thPosition: th ? getComputedStyle(th).position : null,
      thBackground: th ? getComputedStyle(th).backgroundColor : null,
      thBoxShadow: th ? getComputedStyle(th).boxShadow : null,
      stickyTopDelta: header ? Math.abs(header.top - viewport.top) : null,
    }
  })
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  await dialog.getByRole('combobox', { name: 'Khách hàng' }).click()
  await page.getByRole('option', { name: 'ANV - AMANN', exact: true }).click()
  const dialogWeek = dialog.getByRole('textbox', { name: 'Tuần bắt đầu' })
  await dialogWeek.fill('10/08/2026')
  await dialogWeek.press('Tab')
  await dialog.locator('#weekly-menu-import-file').setInputFiles(path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/current-week-import/fixtures/weekly-menu-golden-ANV.xlsx'))
  await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
  await dialog.getByRole('button', { name: 'Kiểm tra', exact: true }).click()
  const modalMatrix = dialog.getByRole('region', { name: 'Bảng bố cục thực đơn theo file khách hàng' })
  await modalMatrix.getByText('Món mặn 1', { exact: true }).first().waitFor({ timeout: 30000 })
  await modalMatrix.evaluate(element => { element.scrollTop = 180 })
  evidence.modal = await modalMatrix.evaluate(element => {
    const table = element.querySelector('table')
    const thead = table?.querySelector('thead')
    const th = table?.querySelector('th')
    const viewport = element.getBoundingClientRect()
    const header = th?.getBoundingClientRect()
    return {
      scrollTop: element.scrollTop,
      borderCollapse: table ? getComputedStyle(table).borderCollapse : null,
      theadPosition: thead ? getComputedStyle(thead).position : null,
      thPosition: th ? getComputedStyle(th).position : null,
      thBackground: th ? getComputedStyle(th).backgroundColor : null,
      thBoxShadow: th ? getComputedStyle(th).boxShadow : null,
      stickyTopDelta: header ? Math.abs(header.top - viewport.top) : null,
    }
  })
  await page.screenshot({ path: path.join(output, 'sticky-header-probe.png'), fullPage: true })
  for (const [scope, facts] of Object.entries({ main: evidence.main, modal: evidence.modal })) {
    assert(facts.borderCollapse === 'separate', `${scope}: sticky matrix still uses collapsed borders.`)
    assert(facts.theadPosition === 'static' && facts.thPosition === 'sticky', `${scope}: sticky ownership is duplicated between thead and th.`)
    assert((facts.stickyTopDelta ?? 99) <= 1, `${scope}: header cells are not pinned to the viewport top.`)
    assert(facts.thBackground !== 'rgba(0, 0, 0, 0)' && facts.thBoxShadow !== 'none', `${scope}: sticky header does not have an opaque paint layer and bottom separator.`)
  }
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
  await writeFile(path.join(output, 'sticky-header-probe.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
